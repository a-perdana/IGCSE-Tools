import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  orderBy,
  updateDoc,
  deleteField,
  getDoc,
  setDoc,
  writeBatch,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import type { Assessment, Question, Folder, Resource, ResourceType, SyllabusCache, PastPaperCache, ImportedQuestion, DiagramPoolEntry, PracticeAttempt, ExamAttempt, SharedAssignment, AssignmentAttempt, QuestionItem, UserProfile, DailyChallenge, IgcseRole } from './types'
import type { ExamViewQuestion, ExamViewImage } from './examview'

/** Remove undefined values from an object shallowly (Firestore rejects undefined). */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = stripUndefined(v as Record<string, unknown>)
    } else {
      result[k] = v
    }
  }
  return result
}


function serializeQuestionDiagram(q: unknown): unknown {
  if (!q || typeof q !== 'object') return q
  return stripUndefined({ ...(q as Record<string, unknown>) })
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// --- Firestore Error Handling Spec ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
// --------------------------------------

export const signInWithGoogle = async () => {
  await signInWithPopup(auth, googleProvider);
};

export const logout = () => auth.signOut();

export const saveAssessment = async (
  data: Omit<Assessment, 'id' | 'createdAt' | 'userId'>
): Promise<string> => {
  if (!auth.currentUser) throw new Error("User must be authenticated to save")
  const assessmentsRef = collection(db, 'assessments')
  const payload: any = {
    ...data,
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    questions: data.questions?.map(serializeQuestionDiagram),
  }
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
  try {
    const docRef = await addDoc(assessmentsRef, payload)
    return docRef.id
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'assessments')
    throw error
  }
}

/** Atomically saves assessment + questions in a single writeBatch commit.
 *  Prevents orphaned assessments when question saving fails. */
export const saveAssessmentWithQuestions = async (
  assessmentData: Omit<Assessment, 'id' | 'createdAt' | 'userId'>,
  questions: Array<Omit<Question, 'id' | 'createdAt' | 'userId'>>,
): Promise<string> => {
  if (!auth.currentUser) throw new Error('User must be authenticated to save')
  const uid = auth.currentUser.uid
  const batch = writeBatch(db)

  const assessmentRef = doc(collection(db, 'assessments'))
  const assessmentPayload: any = {
    ...assessmentData,
    userId: uid,
    createdAt: serverTimestamp(),
    questions: assessmentData.questions?.map(serializeQuestionDiagram),
  }
  Object.keys(assessmentPayload).forEach(k => assessmentPayload[k] === undefined && delete assessmentPayload[k])
  batch.set(assessmentRef, assessmentPayload)

  for (const q of questions) {
    const questionRef = doc(collection(db, 'questions'))
    const questionPayload: any = { ...(serializeQuestionDiagram(q) as object), userId: uid, assessmentId: assessmentRef.id, createdAt: serverTimestamp() }
    Object.keys(questionPayload).forEach(k => questionPayload[k] === undefined && delete questionPayload[k])
    batch.set(questionRef, questionPayload)
  }

  try {
    await batch.commit()
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'assessments+questions')
    throw error
  }
  return assessmentRef.id
}

export const getSavedAssessments = async (folderId?: string): Promise<Assessment[]> => {
  if (!auth.currentUser) return []
  const uid = auth.currentUser.uid
  const assessmentsRef = collection(db, 'assessments')
  const foldersRef = collection(db, 'folders')

  const ownQuery = folderId
    ? query(assessmentsRef, where('userId', '==', uid), where('folderId', '==', folderId), orderBy('createdAt', 'desc'))
    : query(assessmentsRef, where('userId', '==', uid), orderBy('createdAt', 'desc'))

  try {
    const ownSnap = await getDocs(ownQuery)
    const own = ownSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assessment)).filter(a => Array.isArray(a.questions))

    let shared: Assessment[] = []
    try {
      // Find users who have public folders, then fetch all their assessments
      const publicFolderSnap = await getDocs(query(foldersRef, where('isPublic', '==', true)))
      const sharedUserIds = [...new Set(
        publicFolderSnap.docs
          .map(d => (d.data() as Folder).userId)
          .filter(id => id !== uid)
      )]
      const chunks = await Promise.all(
        sharedUserIds.map(sharedUid =>
          getDocs(query(assessmentsRef, where('userId', '==', sharedUid), orderBy('createdAt', 'desc')))
            .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Assessment)).filter(a => Array.isArray(a.questions)))
        )
      )
      shared = chunks.flat()
    } catch {
      // Shared query may fail if rules are still propagating
    }

    const ownIds = new Set(own.map(a => a.id))
    return [...own, ...shared.filter(a => !ownIds.has(a.id))]
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assessments')
    return []
  }
}

export const deleteAssessment = async (id: string) => {
  const docRef = doc(db, 'assessments', id);
  try {
    return await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `assessments/${id}`);
  }
};

export const createFolder = async (name: string, parentId?: string) => {
  if (!auth.currentUser) throw new Error("User must be authenticated to create folder");
  const payload: Record<string, unknown> = {
    name,
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  };
  if (parentId) payload.parentId = parentId;
  return addDoc(collection(db, 'folders'), payload);
};

export const getFolders = async () => {
  if (!auth.currentUser) return [];
  const uid = auth.currentUser.uid;
  const foldersRef = collection(db, 'folders');
  const ownQuery = query(foldersRef, where('userId', '==', uid), orderBy('createdAt', 'asc'));
  const publicRootQuery = query(foldersRef, where('isPublic', '==', true));
  const sortFolders = (folders: Folder[]) => folders.sort((a, b) => {
    const aHas = a.order !== undefined, bHas = b.order !== undefined
    if (aHas && bHas) return (a.order as number) - (b.order as number)
    if (aHas) return -1
    if (bHas) return 1
    return 0
  });
  try {
    const ownSnap = await getDocs(ownQuery);
    const own = ownSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Folder[];
    let sharedAll: Folder[] = [];
    try {
      // Step 1: find which users have public root folders
      const publicRootSnap = await getDocs(publicRootQuery);
      const publicRootFolders = publicRootSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Folder))
        .filter(f => f.userId !== uid);
      // Step 2: for each such user fetch ALL their folders (so child folders are included)
      const sharedUserIds = [...new Set(publicRootFolders.map(f => f.userId))];
      const chunks: Folder[][] = await Promise.all(
        sharedUserIds.map(async sharedUid => {
          const snap = await getDocs(query(foldersRef, where('userId', '==', sharedUid), orderBy('createdAt', 'asc')));
          return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Folder));
        })
      );
      sharedAll = chunks.flat();
    } catch {
      // Shared query may fail if rules are still propagating
    }
    const ownIds = new Set(own.map(f => f.id));
    return sortFolders([...own, ...sharedAll.filter(f => !ownIds.has(f.id))]);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'folders');
    return [];
  }
};

/** Persist a new order for a list of sibling folders (same parent). */
export const reorderFolders = async (orderedIds: string[]): Promise<void> => {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, 'folders', id), { order: index })
  })
  await batch.commit()
};

export const deleteFolder = async (id: string) => {
  const docRef = doc(db, 'folders', id);
  try {
    return await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `folders/${id}`);
  }
};

export const updateFolder = async (id: string, name: string) => {
  const docRef = doc(db, 'folders', id);
  try {
    return await updateDoc(docRef, { name });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `folders/${id}`);
  }
};

export const moveFolderParent = async (id: string, parentId: string | null) => {
  const docRef = doc(db, 'folders', id);
  try {
    return await updateDoc(docRef, { parentId: parentId ?? deleteField() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `folders/${id}`);
  }
};

export const saveResource = async (
  file: { name: string; data: ArrayBuffer; mimeType: string },
  subject: string,
  resourceType?: ResourceType
): Promise<Resource> => {
  if (!auth.currentUser) throw new Error("User must be authenticated to save resource")
  const uid = auth.currentUser.uid
  const resourcesRef = collection(db, 'resources')
  const docRef = doc(resourcesRef)
  const resourceId = docRef.id
  const path = `resources/${uid}/${resourceId}/${file.name}`
  const sRef = storageRef(storage, path)
  await uploadBytes(sRef, file.data, { contentType: file.mimeType })
  const downloadURL = await getDownloadURL(sRef)
  const metadata: any = {
    name: file.name,
    subject,
    storagePath: path,
    downloadURL,
    mimeType: file.mimeType,
    userId: uid,
    createdAt: serverTimestamp(),
  }
  if (resourceType) metadata.resourceType = resourceType
  await setDoc(docRef, metadata)
  return { id: resourceId, ...metadata, createdAt: Timestamp.now() }
}

export const updateResourceType = async (id: string, resourceType: ResourceType): Promise<void> => {
  await updateDoc(doc(db, 'resources', id), { resourceType })
}

export const updateResourceGeminiUri = async (id: string, uri: string): Promise<void> => {
  await updateDoc(doc(db, 'resources', id), {
    geminiFileUri: uri,
    geminiFileUploadedAt: serverTimestamp(),
  })
}

export const toggleResourceShared = async (id: string, isShared: boolean): Promise<void> => {
  await updateDoc(doc(db, 'resources', id), { isShared })
}

export const saveSyllabusCache = async (
  resourceId: string,
  subject: string,
  topics: Record<string, string>
): Promise<void> => {
  await setDoc(doc(db, 'syllabusCache', resourceId), {
    resourceId,
    subject,
    topics,
    processedAt: serverTimestamp(),
    userId: auth.currentUser?.uid ?? null,
  })
}

export const getSyllabusCache = async (resourceId: string): Promise<SyllabusCache | null> => {
  const snap = await getDoc(doc(db, 'syllabusCache', resourceId))
  return snap.exists() ? (snap.data() as SyllabusCache) : null
}

export const savePastPaperCache = async (
  resourceId: string,
  subject: string,
  data: {
    examples?: string
    items?: PastPaperCache['items']
    summary?: string
    version?: number
  }
): Promise<void> => {
  await setDoc(doc(db, 'pastPaperCache', resourceId), {
    resourceId,
    subject,
    ...data,
    processedAt: serverTimestamp(),
    userId: auth.currentUser?.uid ?? null,
  })
}

export const getPastPaperCache = async (resourceId: string): Promise<PastPaperCache | null> => {
  const snap = await getDoc(doc(db, 'pastPaperCache', resourceId))
  return snap.exists() ? (snap.data() as PastPaperCache) : null
}

export const getResources = async (subject?: string) => {
  if (!auth.currentUser) return [];
  const uid = auth.currentUser.uid;
  const resourcesRef = collection(db, 'resources');

  const ownQ = subject
    ? query(resourcesRef, where('userId', '==', uid), where('subject', '==', subject), orderBy('createdAt', 'desc'))
    : query(resourcesRef, where('userId', '==', uid), orderBy('createdAt', 'desc'));

  const sharedQ = subject
    ? query(resourcesRef, where('isShared', '==', true), where('subject', '==', subject), orderBy('createdAt', 'desc'))
    : query(resourcesRef, where('isShared', '==', true), orderBy('createdAt', 'desc'));

  try {
    const [ownSnap, sharedSnap] = await Promise.all([getDocs(ownQ), getDocs(sharedQ)]);
    const own = ownSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Resource).filter(r => !!r.downloadURL);
    const ownIds = new Set(own.map(r => r.id));
    const shared = sharedSnap.docs
      .map(d => ({ id: d.id, ...d.data() }) as Resource)
      .filter(r => !!r.downloadURL && !ownIds.has(r.id));
    return [...own, ...shared].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'resources');
    return [];
  }
};

export const deleteResource = async (resource: Resource): Promise<void> => {
  // Delete from Storage first (if it fails, still clean up Firestore)
  try {
    const sRef = storageRef(storage, resource.storagePath)
    await deleteObject(sRef)
  } catch (e) {
    console.warn('Storage delete failed, continuing with Firestore cleanup:', e)
  }
  const docRef = doc(db, 'resources', resource.id)
  try {
    await deleteDoc(docRef)
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `resources/${resource.id}`)
  }
}

export const moveAssessment = async (assessmentId: string, folderId: string | null) => {
  const docRef = doc(db, 'assessments', assessmentId);
  try {
    return await updateDoc(docRef, {
      folderId: folderId ? folderId : deleteField()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `assessments/${assessmentId}`);
  }
};

export const updateAssessment = async (
  id: string,
  updates: Partial<Omit<Assessment, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  const docRef = doc(db, 'assessments', id)
  try {
    const payload = stripUndefined(updates as Record<string, unknown>)
    if (Array.isArray(payload.questions)) {
      payload.questions = (payload.questions as unknown[]).map(q => serializeQuestionDiagram(q))
    }
    await updateDoc(docRef, payload as any)
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `assessments/${id}`)
  }
}

export const saveQuestion = async (
  data: Omit<Question, 'id' | 'createdAt' | 'userId'>
): Promise<string> => {
  if (!auth.currentUser) throw new Error("User must be authenticated to save question")
  const questionsRef = collection(db, 'questions')
  try {
    const payload: any = {
      ...data,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    }
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
    const docRef = await addDoc(questionsRef, payload)
    return docRef.id
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'questions')
    throw error
  }
}

export const getQuestions = async (folderId?: string): Promise<Question[]> => {
  if (!auth.currentUser) return []
  const uid = auth.currentUser.uid
  const questionsRef = collection(db, 'questions')
  const foldersRef = collection(db, 'folders')

  const ownQuery = folderId
    ? query(questionsRef, where('userId', '==', uid), where('folderId', '==', folderId), orderBy('createdAt', 'desc'))
    : query(questionsRef, where('userId', '==', uid), orderBy('createdAt', 'desc'))

  try {
    const ownSnap = await getDocs(ownQuery)
    const own = ownSnap.docs.map(d => ({ id: d.id, ...d.data() } as Question)).filter(q => typeof (q as any).text === 'string')

    let shared: Question[] = []
    try {
      // Find users who have public folders, then fetch all their questions
      const publicFolderSnap = await getDocs(query(foldersRef, where('isPublic', '==', true)))
      const sharedUserIds = [...new Set(
        publicFolderSnap.docs
          .map(d => (d.data() as Folder).userId)
          .filter(id => id !== uid)
      )]
      const chunks = await Promise.all(
        sharedUserIds.map(sharedUid =>
          getDocs(query(questionsRef, where('userId', '==', sharedUid), orderBy('createdAt', 'desc')))
            .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Question)).filter(q => typeof (q as any).text === 'string'))
        )
      )
      shared = chunks.flat()
    } catch {
      // Shared query may fail if rules are still propagating
    }

    const ownIds = new Set(own.map(q => q.id))
    return [...own, ...shared.filter(q => !ownIds.has(q.id))]
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'questions')
    return []
  }
}

export interface QuestionPageFilters {
  folderId?: string | null  // null = root (no folder), undefined = all folders
  subject?: string
  topic?: string
}

export interface QuestionPageResult {
  questions: Question[]
  cursor: QueryDocumentSnapshot<DocumentData> | null  // null = no more pages
}

/**
 * Fetches one page of questions from Firestore.
 * Filters (folderId, subject, topic) run server-side via Firestore where clauses.
 * Pass `afterCursor` to get the next page; omit for the first page.
 * Returns `cursor: null` when there are no more results.
 *
 * Requires composite indexes:
 *   questions: userId ASC, subject ASC, createdAt DESC
 *   questions: userId ASC, topic ASC, createdAt DESC
 *   questions: userId ASC, folderId ASC, createdAt DESC
 *   (all combinations you actually use)
 */
export const getQuestionPage = async (
  filters: QuestionPageFilters,
  pageSize: number,
  afterCursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<QuestionPageResult> => {
  if (!auth.currentUser) return { questions: [], cursor: null }
  const uid = auth.currentUser.uid
  const questionsRef = collection(db, 'questions')

  const constraints: Parameters<typeof query>[1][] = [
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),  // fetch one extra to know if more pages exist
  ]

  if (filters.folderId === null) {
    // root — questions with no folderId field (or folderId == null)
    constraints.splice(1, 0, where('folderId', '==', null))
  } else if (filters.folderId) {
    constraints.splice(1, 0, where('folderId', '==', filters.folderId))
  }

  if (filters.subject) {
    constraints.splice(1, 0, where('subject', '==', filters.subject))
  }

  if (filters.topic) {
    constraints.splice(1, 0, where('topic', '==', filters.topic))
  }

  if (afterCursor) {
    constraints.push(startAfter(afterCursor))
  }

  try {
    const snap = await getDocs(query(questionsRef, ...constraints))
    const docs = snap.docs
    const hasMore = docs.length > pageSize
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs
    const questions = pageDocs
      .map(d => ({ id: d.id, ...d.data() } as Question))
      .filter(q => typeof (q as any).text === 'string')
    const cursor = hasMore ? pageDocs[pageDocs.length - 1] : null
    return { questions, cursor }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'questions')
    return { questions: [], cursor: null }
  }
}

export const deleteQuestion = async (id: string) => {
  const docRef = doc(db, 'questions', id);
  try {
    return await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `questions/${id}`);
  }
};

export const moveQuestion = async (questionId: string, folderId: string | null) => {
  const docRef = doc(db, 'questions', questionId);
  try {
    return await updateDoc(docRef, {
      folderId: folderId ? folderId : deleteField()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `questions/${questionId}`);
  }
};

export const updateQuestion = async (
  id: string,
  updates: Partial<Omit<Question, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  const docRef = doc(db, 'questions', id)
  try {
    await updateDoc(docRef, stripUndefined(serializeQuestionDiagram(updates) as Record<string, unknown>) as any)
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `questions/${id}`)
  }
}

export const togglePublicFolder = async (id: string, isPublic: boolean) => {
  const docRef = doc(db, 'folders', id)
  try {
    await updateDoc(docRef, { isPublic: isPublic || deleteField() })
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `folders/${id}`)
  }
}

export const togglePublicAssessment = async (id: string, isPublic: boolean, preparedBy: string) => {
  const docRef = doc(db, 'assessments', id)
  try {
    await updateDoc(docRef, { isPublic, preparedBy: isPublic ? preparedBy : deleteField() })
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `assessments/${id}`)
  }
}

export const togglePublicQuestion = async (id: string, isPublic: boolean, preparedBy: string) => {
  const docRef = doc(db, 'questions', id)
  try {
    await updateDoc(docRef, { isPublic, preparedBy: isPublic ? preparedBy : deleteField() })
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `questions/${id}`)
  }
}

// ─── Imported questions ───────────────────────────────────────────────────────

/** Fetch all active imported questions, optionally filtered by topic and/or subject. */
export const getImportedQuestions = async (opts: {
  subject?: string
  topic?: string
} = {}): Promise<ImportedQuestion[]> => {
  if (!auth.currentUser) return []
  const col = collection(db, 'importedQuestions')

  let q
  if (opts.subject && opts.topic) {
    q = query(col,
      where('subject', '==', opts.subject),
      where('topic', '==', opts.topic),
      where('status', '==', 'active'),
      orderBy('rawCode', 'asc')
    )
  } else if (opts.subject) {
    q = query(col,
      where('subject', '==', opts.subject),
      where('status', '==', 'active'),
      orderBy('rawCode', 'asc')
    )
  } else {
    q = query(col, where('status', '==', 'active'), orderBy('rawCode', 'asc'))
  }

  try {
    const snap = await getDocs(q)
    return snap.docs.map(d => (d.data() as ImportedQuestion))
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'importedQuestions')
    return []
  }
}

/** Update editorial fields on an imported question (topic, subtopic, questionText, options, correctAnswer, type). */
export const updateImportedQuestion = async (
  uid: string,
  updates: Partial<Pick<ImportedQuestion, 'questionText' | 'options' | 'correctAnswer' | 'topic' | 'subtopic' | 'type'>>
): Promise<void> => {
  const docRef = doc(db, 'importedQuestions', uid)
  try {
    await updateDoc(docRef, stripUndefined(updates as Record<string, unknown>) as any)
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `importedQuestions/${uid}`)
  }
}

/** Return the distinct list of topics present in importedQuestions for a given subject. */
export const getImportedTopics = async (subject: string): Promise<string[]> => {
  if (!auth.currentUser) return []
  const col = collection(db, 'importedQuestions')
  const q = query(col, where('subject', '==', subject), where('status', '==', 'active'))
  try {
    const snap = await getDocs(q)
    const topics = new Set(snap.docs.map(d => d.data().topic as string).filter(Boolean))
    return [...topics].sort()
  } catch {
    return []
  }
}

/** Fetch diagram pool entries, optionally filtered by subject. */
export const getDiagramPool = async (subject?: string): Promise<DiagramPoolEntry[]> => {
  if (!auth.currentUser) return []
  const col = collection(db, 'diagramPool')
  // Note: docs written by build_diagram_pool.py use 'updatedAt' not 'createdAt',
  // so we avoid orderBy to prevent Firestore filtering out docs without 'createdAt'.
  const q = subject
    ? query(col, where('subject', '==', subject))
    : query(col)
  try {
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DiagramPoolEntry))
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'diagramPool')
    return []
  }
}

/** Update editable fields on a diagram pool entry. */
export const updateDiagramPoolEntry = async (
  id: string,
  updates: Partial<Pick<DiagramPoolEntry, 'description' | 'category' | 'tags' | 'topics' | 'subject'>>
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'diagramPool', id), stripUndefined(updates as Record<string, unknown>) as any)
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `diagramPool/${id}`)
  }
}

/** Add a new diagram pool entry (for manually uploaded diagrams). */
export const addDiagramPoolEntry = async (
  entry: Omit<DiagramPoolEntry, 'id' | 'createdAt'>
): Promise<string> => {
  const col = collection(db, 'diagramPool')
  const docRef = await addDoc(col, { ...stripUndefined(entry as Record<string, unknown>), createdAt: serverTimestamp() })
  return docRef.id
}

/** Delete a diagram pool entry from Firestore (does not delete Storage file). */
export const deleteDiagramPoolEntry = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'diagramPool', id))
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `diagramPool/${id}`)
  }
}

/** Upload a diagram image to Storage and return its public URL + storage path. */
export const uploadDiagramImage = async (
  file: File,
  subject: string,
): Promise<{ imageURL: string; storagePath: string; imageName: string }> => {
  const imageName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const path = `diagrams/${subject.toLowerCase()}/${imageName}`
  const ref = storageRef(storage, path)
  await uploadBytes(ref, file)
  const imageURL = await getDownloadURL(ref)
  return { imageURL, storagePath: path, imageName }
}

/** GDPR: delete all Firestore data owned by a user, then delete their Auth account.
 *  Iterates in batches of 400 to stay under the 500-op batch limit. */
export const deleteUserData = async (): Promise<void> => {
  const user = auth.currentUser
  if (!user) throw new Error('No authenticated user')
  const uid = user.uid

  const collectionsToClean: string[] = ['assessments', 'questions', 'folders', 'resources']
  for (const col of collectionsToClean) {
    const q = query(collection(db, col), where('userId', '==', uid))
    let snap = await getDocs(q)
    while (!snap.empty) {
      const batch = writeBatch(db)
      snap.docs.slice(0, 400).forEach(d => batch.delete(d.ref))
      await batch.commit()
      if (snap.docs.length <= 400) break
      snap = await getDocs(q)
    }
  }

  // Delete cache docs owned by the user
  for (const col of ['syllabusCache', 'pastPaperCache']) {
    const q = query(collection(db, col), where('userId', '==', uid))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const batch = writeBatch(db)
      snap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
    }
  }

  // Delete all Storage files under resources/{uid}/
  try {
    const userStorageRef = storageRef(storage, `resources/${uid}`)
    const listResult = await listAll(userStorageRef)
    // listAll only lists top-level; recurse one level (resourceId folders)
    await Promise.all(
      listResult.prefixes.map(async (folderRef) => {
        const files = await listAll(folderRef)
        await Promise.all(files.items.map(item => deleteObject(item).catch(() => {})))
      })
    )
  } catch (e) {
    console.warn('Storage cleanup failed, continuing with Auth deletion:', e)
  }

  // Finally delete the Auth account
  await user.delete()
}

// ─── ExamView cleanup ─────────────────────────────────────────────────────────

const DIAGRAM_PLACEHOLDER_RE = /\[diagram:[^\]]*\]/g

/** One-time migration: strip legacy [diagram:...] placeholders from ExamView question text/options. */
export const cleanExamViewPlaceholders = async (): Promise<number> => {
  if (!auth.currentUser) return 0
  const uid = auth.currentUser.uid
  const snap = await getDocs(query(
    collection(db, 'questions'),
    where('userId', '==', uid),
    where('source', '==', 'examview'),
  ))
  let fixed = 0
  const BATCH_SIZE = 400
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const d of snap.docs.slice(i, i + BATCH_SIZE)) {
      const data = d.data()
      const text: string = data.text ?? ''
      const options: string[] | undefined = data.options
      const cleanText = text.replace(DIAGRAM_PLACEHOLDER_RE, '').trim()
      const cleanOptions = options?.map((o: string) => o.replace(DIAGRAM_PLACEHOLDER_RE, '').trim())
      const hasChange =
        cleanText !== text ||
        (cleanOptions && JSON.stringify(cleanOptions) !== JSON.stringify(options))
      if (!hasChange) continue
      const update: Record<string, unknown> = { text: cleanText }
      if (cleanOptions) update.options = cleanOptions
      batch.update(d.ref, update)
      fixed++
    }
    await batch.commit()
  }
  return fixed
}

// ─── ExamView import ──────────────────────────────────────────────────────────

export interface ExamViewImportOptions {
  subject: string
  folderId?: string
  /** Called after each question is saved, with count of completed so far */
  onProgress?: (done: number, total: number) => void
}

/**
 * Imports a batch of ExamView questions into Firestore.
 * Images are uploaded to Firebase Storage under examview/{uid}/{sourceFile}/{filename}.
 * Returns the number of questions saved.
 */
export const importExamViewQuestions = async (
  questions: ExamViewQuestion[],
  imageMap: Map<string, ExamViewImage>,
  sourceFile: string,
  opts: ExamViewImportOptions,
): Promise<number> => {
  if (!auth.currentUser) throw new Error('User must be authenticated to import')
  const uid = auth.currentUser.uid
  const { subject, folderId, onProgress } = opts

  // Sanitise source filename for use in Storage paths
  const safeSource = sourceFile.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.zip$/i, '')

  // Upload images in parallel (5 concurrent) — much faster than sequential
  const imageURLs = new Map<string, string>()
  const imageEntries = Array.from(imageMap.entries())
  const UPLOAD_CONCURRENCY = 5
  for (let i = 0; i < imageEntries.length; i += UPLOAD_CONCURRENCY) {
    await Promise.all(
      imageEntries.slice(i, i + UPLOAD_CONCURRENCY).map(async ([filename, img]) => {
        const path = `examview/${uid}/${safeSource}/${filename}`
        const ref = storageRef(storage, path)
        try {
          // File already exists — reuse its URL
          imageURLs.set(filename, await getDownloadURL(ref))
        } catch {
          // File doesn't exist yet — upload it
          await uploadBytes(ref, img.data, { contentType: img.mimeType })
          imageURLs.set(filename, await getDownloadURL(ref))
        }
      })
    )
  }

  // Fetch already-imported sourceIds for this sourceFile to skip duplicates
  const existingSnap = await getDocs(
    query(collection(db, 'questions'),
      where('userId', '==', uid),
      where('sourceFile', '==', safeSource),
    )
  )
  const existingSourceIds = new Set(existingSnap.docs.map(d => d.data().sourceId as string))

  // Save questions in batches of 400 (Firestore writeBatch limit)
  const BATCH_SIZE = 400
  let saved = 0

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    const slice = questions.slice(i, i + BATCH_SIZE)

    for (const q of slice) {
      // Skip questions with no usable text or already imported from this ZIP
      if (!q.text.trim()) continue
      if (existingSourceIds.has(q.sourceId)) continue

      const qRef = doc(collection(db, 'questions'))

      // Build diagram field if question has exactly one image
      let diagram: Record<string, unknown> | undefined
      if (q.hasDiagram && q.images.length > 0) {
        const url = imageURLs.get(q.images[0].filename)
        if (url) {
          diagram = { diagramType: 'raster', url, maxWidth: 480 }
        }
      }

      const payload: Record<string, unknown> = {
        text: q.text.slice(0, 9900),
        answer: q.correctAnswer,
        markScheme: '',
        marks: 1,
        commandWord: q.type === 'mcq' ? 'Choose' : 'Write',
        type: q.type,
        hasDiagram: q.hasDiagram && !!diagram,
        options: q.options.length > 0
          ? q.options.map(o => o.replace(/\[examview-img:([^\]]+)\]/g, (_, fn) => {
              const url = imageURLs.get(fn)
              return url ? `![](${url})` : ''
            }).trim())
          : undefined,
        syllabusObjective: q.syllabusObjective || undefined,
        difficultyStars: q.difficultyStars,
        topic: q.topic || 'Uncategorised',
        subject,
        difficulty: q.difficultyStars === 1 ? 'Easy' : q.difficultyStars === 3 ? 'Hard' : 'Medium',
        userId: uid,
        createdAt: serverTimestamp(),
        source: 'examview',
        sourceId: q.sourceId,
        keywords: q.keywords.length > 0 ? q.keywords : undefined,
        sourceFile: safeSource,
      }
      if (diagram) payload.diagram = diagram
      if (folderId) payload.folderId = folderId

      // Don't run stripUndefined on the full payload — it corrupts FieldValue sentinels
      // (serverTimestamp is an object; stripUndefined would recurse into it and return {}).
      // Instead, remove undefined keys manually at the top level only.
      const cleanPayload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(payload)) {
        if (v !== undefined) cleanPayload[k] = v
      }
      batch.set(qRef, cleanPayload)
    }

    await batch.commit()
    saved += slice.filter(q => q.text.trim() && !existingSourceIds.has(q.sourceId)).length
    onProgress?.(saved, questions.length)
  }

  return saved
}

// ─── Practice Attempts ────────────────────────────────────────────────────────

export async function savePracticeAttempt(
  data: Omit<PracticeAttempt, 'id' | 'completedAt' | 'userId'>
): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  try {
    const payload: Record<string, unknown> = {
      ...stripUndefined(data as unknown as Record<string, unknown>),
      userId: uid,
      completedAt: serverTimestamp(),
    }
    const ref = await addDoc(collection(db, 'practiceAttempts'), payload)
    return ref.id
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'practiceAttempts')
    throw error
  }
}

export async function saveExamAttempt(
  data: Omit<ExamAttempt, 'id' | 'completedAt' | 'userId'>
): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  try {
    const payload: Record<string, unknown> = {
      ...stripUndefined(data as unknown as Record<string, unknown>),
      userId: uid,
      completedAt: serverTimestamp(),
    }
    const ref = await addDoc(collection(db, 'examAttempts'), payload)
    return ref.id
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'examAttempts')
    throw error
  }
}

export async function getExamAttempts(assessmentId?: string): Promise<ExamAttempt[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []
  try {
    const constraints = [
      where('userId', '==', uid),
      ...(assessmentId ? [where('assessmentId', '==', assessmentId)] : []),
      orderBy('completedAt', 'desc'),
    ]
    const snap = await getDocs(query(collection(db, 'examAttempts'), ...constraints))
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt))
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'examAttempts')
    throw error
  }
}

export async function getPracticeAttempts(assessmentId?: string): Promise<PracticeAttempt[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []
  try {
    const constraints = [
      where('userId', '==', uid),
      ...(assessmentId ? [where('assessmentId', '==', assessmentId)] : []),
      orderBy('completedAt', 'desc'),
    ]
    const snap = await getDocs(query(collection(db, 'practiceAttempts'), ...constraints))
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PracticeAttempt))
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'practiceAttempts')
    throw error
  }
}

// ─── Shared Assignments (Class Mode) ─────────────────────────────────────────

/** Generate a short human-readable join code like "BIO-5Q-X7K". */
function generateJoinCode(subject: string, questionCount: number): string {
  const subjectCode = subject.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
  const countPart = `${questionCount}Q`
  const random = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${subjectCode}-${countPart}-${random}`
}

export async function createSharedAssignment(
  assessmentId: string,
  assessment: Assessment,
  timeLimitSeconds?: number,
): Promise<{ id: string; code: string }> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const code = generateJoinCode(assessment.subject, assessment.questions.length)
  const snapshot: SharedAssignment['assessmentSnapshot'] = {
    subject: assessment.subject,
    topic: assessment.topic,
    difficulty: assessment.difficulty,
    questions: assessment.questions.map(q => stripUndefined(q as unknown as Record<string, unknown>) as unknown as QuestionItem),
    code: assessment.code,
  }
  const payload: Record<string, unknown> = {
    code,
    assessmentId,
    assessmentSnapshot: stripUndefined(snapshot as unknown as Record<string, unknown>),
    teacherId: user.uid,
    teacherName: user.displayName ?? user.email ?? 'Teacher',
    createdAt: serverTimestamp(),
    studentIds: [],
  }
  if (timeLimitSeconds) payload.timeLimitSeconds = timeLimitSeconds
  const ref = await addDoc(collection(db, 'sharedAssignments'), payload)
  return { id: ref.id, code }
}

export async function getSharedAssignmentByCode(code: string): Promise<SharedAssignment | null> {
  const snap = await getDocs(
    query(collection(db, 'sharedAssignments'), where('code', '==', code.toUpperCase().trim()))
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as SharedAssignment
}

export async function joinSharedAssignment(assignmentId: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  const ref = doc(db, 'sharedAssignments', assignmentId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Assignment not found')
  const data = snap.data() as SharedAssignment
  if (!data.studentIds.includes(uid)) {
    await updateDoc(ref, { studentIds: [...data.studentIds, uid] })
  }
}

export async function saveAssignmentAttempt(
  data: Omit<AssignmentAttempt, 'id' | 'completedAt'>
): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not authenticated')
  const payload: Record<string, unknown> = {
    ...stripUndefined(data as unknown as Record<string, unknown>),
    completedAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'assignmentAttempts'), payload)
  return ref.id
}

/** Fetch all attempts for a given assignment (teacher view). */
export async function getAssignmentAttempts(assignmentId: string): Promise<AssignmentAttempt[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'assignmentAttempts'), where('assignmentId', '==', assignmentId), orderBy('completedAt', 'desc'))
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentAttempt))
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assignmentAttempts')
    throw error
  }
}

/** Fetch all shared assignments created by the current teacher. */
export async function getTeacherAssignments(): Promise<SharedAssignment[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []
  try {
    const snap = await getDocs(
      query(collection(db, 'sharedAssignments'), where('teacherId', '==', uid), orderBy('createdAt', 'desc'))
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SharedAssignment))
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'sharedAssignments')
    return []
  }
}

export async function deleteSharedAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'sharedAssignments', id))
}

/** Fetch all attempts submitted by the current student. */
export async function getStudentAssignmentAttempts(): Promise<AssignmentAttempt[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []
  try {
    const snap = await getDocs(
      query(collection(db, 'assignmentAttempts'), where('userId', '==', uid), orderBy('completedAt', 'desc'))
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentAttempt))
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assignmentAttempts')
    return []
  }
}

/** Admin: list all user profiles. Only callable by admins (enforced by Firestore rules). */
export async function getAllUserProfiles(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'userProfiles'))
    return snap.docs.map(d => ({ uid: d.id, role_igcsetools: 'student', ...d.data() } as UserProfile))
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'userProfiles')
    return []
  }
}

/** Admin: set the role of any user by uid. */
export async function setUserRoleById(uid: string, role: IgcseRole): Promise<void> {
  await updateDoc(doc(db, 'userProfiles', uid), { role_igcsetools: role, updatedAt: Date.now() })
}

// ─── Workspace Config ─────────────────────────────────────────────────────────
// Single doc: workspaceConfig/main — admin-writable, all-auth-readable.
// Stores shared API key for users who haven't set their own.

const WORKSPACE_CONFIG_DOC = doc(db, 'workspaceConfig', 'main')

export interface WorkspaceConfig {
  geminiKey?: string
  updatedAt?: number
}

export async function getWorkspaceConfig(): Promise<WorkspaceConfig> {
  try {
    const snap = await getDoc(WORKSPACE_CONFIG_DOC)
    return snap.exists() ? (snap.data() as WorkspaceConfig) : {}
  } catch {
    return {}
  }
}

export async function saveWorkspaceConfig(config: WorkspaceConfig): Promise<void> {
  await setDoc(WORKSPACE_CONFIG_DOC, { ...config, updatedAt: Date.now() }, { merge: true })
}

// ─── Gamification ─────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: Omit<UserProfile, 'uid'> = {
  role_igcsetools: 'student',
  xp: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  totalQuestionsAnswered: 0,
  totalMarksAwarded: 0,
  totalMarksPossible: 0,
  badges: [],
  subjectQuestionCounts: {},
  dailyChallengesCompleted: 0,
  updatedAt: 0,
}

/** Set or update the role for the current user. */
export async function setUserRole(role: IgcseRole): Promise<void> {
  await updateUserProfile({ role_igcsetools: role })
}

/** Load the current user's gamification profile. Creates a default one if missing. */
export async function getUserProfile(): Promise<UserProfile | null> {
  const uid = auth.currentUser?.uid
  if (!uid) return null
  try {
    const snap = await getDoc(doc(db, 'userProfiles', uid))
    const authUser = auth.currentUser
    const displayName = authUser?.displayName ?? undefined
    const email = authUser?.email ?? undefined
    if (snap.exists()) {
      const data = snap.data()
      // Keep displayName/email fresh in case they changed
      const patch: Record<string, unknown> = {}
      if (displayName && data.displayName !== displayName) patch.displayName = displayName
      if (email && data.email !== email) patch.email = email
      if (Object.keys(patch).length > 0) {
        updateDoc(doc(db, 'userProfiles', uid), patch).catch(console.error)
      }
      return { uid, role_igcsetools: 'student', ...data } as UserProfile
    }
    // First time — create default
    const profile: UserProfile = { uid, ...DEFAULT_PROFILE, updatedAt: Date.now() }
    const payload = stripUndefined({ ...(profile as unknown as Record<string, unknown>), displayName, email })
    await setDoc(doc(db, 'userProfiles', uid), payload)
    return profile
  } catch (e) {
    console.error('getUserProfile error', e)
    return null
  }
}

/** Overwrite the user's profile document. */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  try {
    await setDoc(
      doc(db, 'userProfiles', uid),
      stripUndefined({ ...profile, updatedAt: Date.now() } as unknown as Record<string, unknown>),
    )
  } catch (e) {
    console.error('saveUserProfile error', e)
  }
}

/** Partial update — merges into existing profile. */
export async function updateUserProfile(patch: Partial<Omit<UserProfile, 'uid'>>): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  try {
    await updateDoc(doc(db, 'userProfiles', uid), stripUndefined({ ...patch, updatedAt: Date.now() } as Record<string, unknown>))
  } catch (e) {
    // Doc might not exist yet — use setDoc with merge
    await setDoc(doc(db, 'userProfiles', uid), stripUndefined({ uid, ...DEFAULT_PROFILE, ...patch, updatedAt: Date.now() } as unknown as Record<string, unknown>))
  }
}

/** Get or create today's daily challenge for the user. */
export async function getDailyChallenge(
  today: string,  // 'YYYY-MM-DD'
  questionIds: string[],  // caller passes 3 random IDs
): Promise<DailyChallenge> {
  const uid = auth.currentUser?.uid
  if (!uid) return { date: today, questionIds }
  const docId = `${uid}_${today}`
  try {
    const snap = await getDoc(doc(db, 'dailyChallenges', docId))
    if (snap.exists()) return snap.data() as DailyChallenge
    const challenge: DailyChallenge = { date: today, questionIds }
    await setDoc(doc(db, 'dailyChallenges', docId), challenge)
    return challenge
  } catch (e) {
    console.error('getDailyChallenge error', e)
    return { date: today, questionIds }
  }
}

/** Mark today's daily challenge as completed. */
export async function completeDailyChallenge(
  today: string,
  marksAwarded: number,
  totalMarks: number,
): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return
  const docId = `${uid}_${today}`
  try {
    await updateDoc(doc(db, 'dailyChallenges', docId), {
      completedAt: Date.now(),
      marksAwarded,
      totalMarks,
    })
  } catch (e) {
    console.error('completeDailyChallenge error', e)
  }
}
