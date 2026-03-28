import { useState, useCallback, useRef } from "react";
import type { User } from "firebase/auth";
import type { Assessment, Question, Folder } from "../lib/types";
import type { NotifyFn } from "./useNotifications";
import { generateAssessmentCode } from "../lib/gemini";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import {
  saveAssessmentWithQuestions,
  getSavedAssessments,
  deleteAssessment as fbDelete,
  updateAssessment as fbUpdate,
  moveAssessment as fbMove,
  saveQuestion as fbSaveQ,
  getQuestions,
  getQuestionPage,
  deleteQuestion as fbDeleteQ,
  moveQuestion as fbMoveQ,
  updateQuestion as fbUpdateQ,
  createFolder as fbCreateFolder,
  getFolders,
  deleteFolder as fbDeleteFolder,
  updateFolder as fbUpdateFolder,
  moveFolderParent as fbMoveFolderParent,
  reorderFolders as fbReorderFolders,
  togglePublicAssessment as fbTogglePublicAssessment,
  togglePublicQuestion as fbTogglePublicQuestion,
  togglePublicFolder as fbTogglePublicFolder,
} from "../lib/firebase";
import type { QuestionPageFilters } from "../lib/firebase";

const QUESTIONS_PAGE_SIZE = 20;

export function useAssessments(user: User | null, notify: NotifyFn) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Paginated question loading ──────────────────────────────────────────────
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false);
  const questionCursor = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const activeFilters = useRef<QuestionPageFilters>({});

  const loadAll = useCallback(
    async () => {
      if (!user) return;
      setLoading(true);
      setAssessments([]);
      setQuestions([]);
      try {
        const [a, f] = await Promise.all([
          getSavedAssessments(),
          getFolders(),
        ]);
        setAssessments(a);
        setFolders(f);
        // Questions are now loaded via loadQuestions() with pagination
        // Reset paginated questions state
        questionCursor.current = null;
        activeFilters.current = {};
        const result = await getQuestionPage({}, QUESTIONS_PAGE_SIZE);
        setQuestions(result.questions);
        questionCursor.current = result.cursor;
        setHasMoreQuestions(result.cursor !== null);
      } catch (e) {
        notify("Failed to load library", "error");
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [user, notify],
  );

  /**
   * Load (or reload) questions with new filters from page 1.
   * Call this when subject/topic/folder filters change.
   */
  const loadQuestions = useCallback(
    async (filters: QuestionPageFilters) => {
      if (!user) return;
      setQuestionsLoading(true);
      activeFilters.current = filters;
      questionCursor.current = null;
      try {
        const result = await getQuestionPage(filters, QUESTIONS_PAGE_SIZE);
        setQuestions(result.questions);
        questionCursor.current = result.cursor;
        setHasMoreQuestions(result.cursor !== null);
      } catch (e) {
        notify("Failed to load questions", "error");
      } finally {
        setQuestionsLoading(false);
      }
    },
    [user, notify],
  );

  /**
   * Append the next page of questions to the existing list.
   * Call this when user clicks "Load more" / next page.
   */
  const loadMoreQuestions = useCallback(
    async () => {
      if (!user || !questionCursor.current) return;
      setQuestionsLoading(true);
      try {
        const result = await getQuestionPage(
          activeFilters.current,
          QUESTIONS_PAGE_SIZE,
          questionCursor.current,
        );
        setQuestions(prev => {
          const ids = new Set(prev.map(q => q.id));
          return [...prev, ...result.questions.filter(q => !ids.has(q.id))];
        });
        questionCursor.current = result.cursor;
        setHasMoreQuestions(result.cursor !== null);
      } catch (e) {
        notify("Failed to load more questions", "error");
      } finally {
        setQuestionsLoading(false);
      }
    },
    [user, notify],
  );

  const saveAssessment = useCallback(
    async (assessment: Assessment): Promise<string | null> => {
      try {
        const { id, createdAt, userId, ...data } = assessment;
        if (!data.code)
          data.code = generateAssessmentCode(
            assessment.subject,
            assessment.difficulty,
          );

        // Filter out questions already in the bank to avoid duplicates
        const existingIds = new Set(questions.map((q) => q.id));
        const newQuestions = assessment.questions
          .filter((q) => !existingIds.has(q.id))
          .map((q) => {
            const { id: _id, ...qData } = q;
            return {
              ...qData,
              subject: assessment.subject,
              topic: assessment.topic,
              difficulty: assessment.difficulty,
            };
          });

        // Atomic: assessment + questions saved in a single batch commit
        const newId = await saveAssessmentWithQuestions(data, newQuestions);
        notify("Assessment saved to library", "success");
        return newId;
      } catch (e) {
        notify("Failed to save assessment", "error");
        console.error(e);
        return null;
      }
    },
    [notify, questions],
  );

  const saveQuestions = useCallback(async (qs: Question[]): Promise<void> => {
    try {
      await Promise.all(
        qs.map((q) => {
          const { id, createdAt, userId, ...data } = q;
          return fbSaveQ(data);
        }),
      );
    } catch (e) {
      console.error("Failed to save questions:", e);
    }
  }, []);

  const deleteAssessment = useCallback(
    async (id: string) => {
      try {
        await fbDelete(id);
        setAssessments((a) => a.filter((x) => x.id !== id));
        notify("Assessment deleted", "info");
      } catch (e) {
        notify("Failed to delete assessment", "error");
      }
    },
    [notify],
  );

  const updateAssessment = useCallback(
    async (
      id: string,
      data: Partial<Omit<Assessment, "id" | "userId" | "createdAt">>,
    ) => {
      // Optimistic update with rollback on failure
      const original = assessments.find((x) => x.id === id);
      setAssessments((a) =>
        a.map((x) => (x.id === id ? { ...x, ...data } : x)),
      );
      try {
        await fbUpdate(id, data);
      } catch (e) {
        setAssessments((a) =>
          a.map((x) => (x.id === id ? (original ?? x) : x)),
        );
        notify("Failed to update assessment", "error");
      }
    },
    [notify, assessments],
  );

  const moveAssessment = useCallback(
    async (id: string, folderId: string | null) => {
      const original = assessments.find((x) => x.id === id);
      setAssessments((a) =>
        a.map((x) =>
          x.id === id ? { ...x, folderId: folderId ?? undefined } : x,
        ),
      );
      try {
        await fbMove(id, folderId);
      } catch (e) {
        setAssessments((a) =>
          a.map((x) => (x.id === id ? (original ?? x) : x)),
        );
        notify("Failed to move assessment", "error");
      }
    },
    [notify, assessments],
  );

  const updateQuestion = useCallback(
    async (
      id: string,
      updates: Partial<Omit<Question, "id" | "userId" | "createdAt">>,
    ) => {
      const original = questions.find((x) => x.id === id);
      setQuestions((q) =>
        q.map((x) => (x.id === id ? { ...x, ...updates } : x)),
      );
      try {
        await fbUpdateQ(id, updates);
      } catch (e) {
        setQuestions((q) => q.map((x) => (x.id === id ? (original ?? x) : x)));
        notify("Failed to update question", "error");
      }
    },
    [notify, questions],
  );

  const deleteQuestion = useCallback(
    async (id: string) => {
      try {
        await fbDeleteQ(id);
        setQuestions((q) => q.filter((x) => x.id !== id));
        notify("Question deleted", "info");
      } catch (e) {
        notify("Failed to delete question", "error");
      }
    },
    [notify],
  );

  const moveQuestion = useCallback(
    async (id: string, folderId: string | null) => {
      const original = questions.find((x) => x.id === id);
      setQuestions((q) =>
        q.map((x) =>
          x.id === id ? { ...x, folderId: folderId ?? undefined } : x,
        ),
      );
      try {
        await fbMoveQ(id, folderId);
      } catch (e) {
        setQuestions((q) => q.map((x) => (x.id === id ? (original ?? x) : x)));
        notify("Failed to move question", "error");
      }
    },
    [notify, questions],
  );

  const createFolder = useCallback(
    async (name: string, parentId?: string) => {
      try {
        await fbCreateFolder(name, parentId);
        await loadAll();
        notify(`Folder "${name}" created`, "success");
      } catch (e) {
        notify("Failed to create folder", "error");
      }
    },
    [loadAll, notify],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      try {
        await fbDeleteFolder(id);
        setFolders((f) => f.filter((x) => x.id !== id));
        notify("Folder deleted", "info");
      } catch (e) {
        notify("Failed to delete folder", "error");
      }
    },
    [notify],
  );

  const moveFolder = useCallback(
    async (id: string, parentId: string | null) => {
      const original = folders.find((x) => x.id === id);
      setFolders((f) => f.map((x) => (x.id === id ? { ...x, parentId: parentId ?? undefined } : x)));
      try {
        await fbMoveFolderParent(id, parentId);
      } catch (e) {
        setFolders((f) => f.map((x) => (x.id === id ? (original ?? x) : x)));
        notify("Failed to move folder", "error");
      }
    },
    [notify, folders],
  );

  const reorderFolders = useCallback(
    async (orderedIds: string[]) => {
      // Optimistic update
      setFolders(prev => {
        const byId = Object.fromEntries(prev.map(f => [f.id, f]))
        const reordered = orderedIds.map((id, i) => ({ ...byId[id], order: i })).filter(Boolean)
        const rest = prev.filter(f => !orderedIds.includes(f.id))
        return [...reordered, ...rest]
      })
      try {
        await fbReorderFolders(orderedIds)
      } catch (e) {
        notify("Failed to reorder folders", "error")
        await loadAll()
      }
    },
    [notify, loadAll],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      const original = folders.find((x) => x.id === id);
      setFolders((f) => f.map((x) => (x.id === id ? { ...x, name } : x)));
      try {
        await fbUpdateFolder(id, name);
      } catch (e) {
        setFolders((f) => f.map((x) => (x.id === id ? (original ?? x) : x)));
        notify("Failed to rename folder", "error");
      }
    },
    [notify, folders],
  );

  const togglePublicFolder = useCallback(
    async (id: string, isPublic: boolean) => {
      const original = folders.find((x) => x.id === id)
      setFolders((f) => f.map((x) => (x.id === id ? { ...x, isPublic } : x)))
      try {
        await fbTogglePublicFolder(id, isPublic)
      } catch (e) {
        setFolders((f) => f.map((x) => (x.id === id ? (original ?? x) : x)))
        notify("Failed to update folder visibility", "error")
      }
    },
    [notify, folders],
  )

  const togglePublicAssessment = useCallback(
    async (id: string, isPublic: boolean, preparedBy: string) => {
      const original = assessments.find((x) => x.id === id);
      setAssessments((a) =>
        a.map((x) =>
          x.id === id
            ? { ...x, isPublic, preparedBy: isPublic ? preparedBy : undefined }
            : x,
        ),
      );
      try {
        await fbTogglePublicAssessment(id, isPublic, preparedBy);
      } catch (e) {
        setAssessments((a) =>
          a.map((x) => (x.id === id ? (original ?? x) : x)),
        );
        notify("Failed to update visibility", "error");
      }
    },
    [notify, assessments],
  );

  const togglePublicQuestion = useCallback(
    async (id: string, isPublic: boolean, preparedBy: string) => {
      const original = questions.find((x) => x.id === id);
      setQuestions((q) =>
        q.map((x) =>
          x.id === id
            ? { ...x, isPublic, preparedBy: isPublic ? preparedBy : undefined }
            : x,
        ),
      );
      try {
        await fbTogglePublicQuestion(id, isPublic, preparedBy);
      } catch (e) {
        setQuestions((q) => q.map((x) => (x.id === id ? (original ?? x) : x)));
        notify("Failed to update visibility", "error");
      }
    },
    [notify, questions],
  );

  const toggleAssessmentLike = useCallback(
    async (id: string, isLiked: boolean) => {
      const original = assessments.find((x) => x.id === id);
      setAssessments((a) =>
        a.map((x) => (x.id === id ? { ...x, isLiked } : x)),
      );
      try {
        await fbUpdate(id, { isLiked } as any);
      } catch (e) {
        setAssessments((a) =>
          a.map((x) => (x.id === id ? (original ?? x) : x)),
        );
        notify("Failed to update like status", "error");
      }
    },
    [notify, assessments],
  );

  const toggleQuestionLike = useCallback(
    async (id: string, isLiked: boolean) => {
      const original = questions.find((x) => x.id === id);
      setQuestions((q) => q.map((x) => (x.id === id ? { ...x, isLiked } : x)));
      try {
        await fbUpdateQ(id, { isLiked } as any);
      } catch (e) {
        setQuestions((q) => q.map((x) => (x.id === id ? (original ?? x) : x)));
        notify("Failed to update like status", "error");
      }
    },
    [notify, questions],
  );

  return {
    assessments,
    questions,
    folders,
    loading,
    questionsLoading,
    hasMoreQuestions,
    loadAll,
    loadQuestions,
    loadMoreQuestions,
    saveAssessment,
    saveQuestions,
    deleteAssessment,
    updateAssessment,
    moveAssessment,
    deleteQuestion,
    updateQuestion,
    moveQuestion,
    createFolder,
    deleteFolder,
    renameFolder,
    moveFolder,
    reorderFolders,
    togglePublicFolder,
    togglePublicAssessment,
    togglePublicQuestion,
    toggleAssessmentLike,
    toggleQuestionLike,
  };
}
