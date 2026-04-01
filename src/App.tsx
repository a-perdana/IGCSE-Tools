import React, { useState, useEffect, useCallback, useRef } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { BookOpen, LogIn, LogOut, Library as LibraryIcon, FilePlus, AlertTriangle, X, KeyRound, RefreshCw, Minus, Sparkles, Trash2, ChevronLeft, Wand2, LayoutDashboard, TrendingUp, Users, ChevronDown, GraduationCap, UserCog, Shield } from 'lucide-react'
import type { AIError, ImportedQuestion, DiagramPoolEntry, DiagramCategory, PracticeAttempt, ExamAttempt, IgcseRole } from './lib/types'
import { auth, signInWithGoogle, logout, deleteUserData, getImportedQuestions, updateImportedQuestion, getDiagramPool, updateDiagramPoolEntry, addDiagramPoolEntry, deleteDiagramPoolEntry, uploadDiagramImage, getPracticeAttempts, getExamAttempts, setUserRole, getWorkspaceConfig } from './lib/firebase'
import { IGCSE_SUBJECTS, IGCSE_TOPICS, DIFFICULTY_LEVELS } from './lib/gemini'
import { Timestamp } from 'firebase/firestore'
import type { GenerationConfig, Assessment, Question, QuestionItem } from './lib/types'
import { DEFAULT_MODELS } from './lib/providers'
import { useNotifications } from './hooks/useNotifications'
import { useAssessments } from './hooks/useAssessments'
import { useGeneration } from './hooks/useGeneration'
import { useResources } from './hooks/useResources'
import { useApiSettings } from './hooks/useApiSettings'
import { Sidebar } from './components/Sidebar'
import { AssessmentView } from './components/AssessmentView'
import { Library as LibraryView } from './components/Library'
import { DiagramLibrary } from './components/DiagramLibrary'
import { Dashboard } from './components/Dashboard'
import { Notifications } from './components/Notifications'
import { PracticeMode } from './components/PracticeMode'
import { ExamMode } from './components/ExamMode'
import { ProgressDashboard } from './components/ProgressDashboard'
import { ClassDashboard, ShareAssessmentPanel } from './components/ClassMode'
import { AdminPanel } from './components/AdminPanel'
import { BadgeUnlockModal } from './components/BadgeUnlockModal'
import { LevelUpModal } from './components/LevelUpModal'
import { useGamification } from './hooks/useGamification'
import { useDailyChallenge } from './hooks/useDailyChallenge'
import { useMascot } from './hooks/useMascot'
import { copyToClipboard } from './lib/clipboard'
import { repairQuestionItem } from './lib/sanitize'
import { regenerateDiagramsForQuestions, repairQuestionText } from './lib/gemini'

const DEFAULT_CONFIG: GenerationConfig = {
  provider: 'gemini',
  subject: 'Mathematics',
  topic: 'Mixed Topics',
  difficulty: 'Balanced',
  count: 4,
  type: 'Mixed',
  calculator: true,
  model: DEFAULT_MODELS['gemini'],
  syllabusContext: '',
  useDiagramPool: true,
}

function ErrorBanner({ error, onDismiss, onRetry, onOpenApiSettings }: {
  error: AIError
  onDismiss: () => void
  onRetry: () => void
  onOpenApiSettings: () => void
}) {
  const isRateLimit = error.type === 'rate_limit'
  const isOverloaded = error.type === 'model_overloaded'

  return (
    <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-amber-800">
            {isRateLimit ? 'API Rate Limit Reached' : isOverloaded ? 'Model Overloaded' : 'Generation Failed'}
          </p>
          <button onClick={onDismiss} className="text-amber-400 hover:text-amber-600 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-amber-700 mt-1">
          {isRateLimit
            ? 'Your API key has hit its per-minute or daily limit. Wait a moment and try again, or:'
            : isOverloaded
            ? 'The selected model is currently overloaded. To fix this:'
            : error.message}
        </p>
        {(isRateLimit || isOverloaded) && (
          <ol className="mt-2 flex flex-col gap-1.5 text-xs text-amber-800">
            {isRateLimit && (
              <li className="flex items-start gap-1.5">
                <span className="font-bold shrink-0">1.</span>
                <span>
                  <button
                    onClick={onOpenApiSettings}
                    className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-amber-900"
                  >
                    <KeyRound className="w-3 h-3" /> Add your own API key
                  </button>
                  {' '}— available free from your provider's console.
                </span>
              </li>
            )}
            {isOverloaded && (
              <li className="flex items-start gap-1.5">
                <span className="font-bold shrink-0">1.</span>
                <span>
                  Open{' '}
                  <button onClick={onOpenApiSettings} className="font-semibold underline underline-offset-2 hover:text-amber-900">
                    API Settings
                  </button>
                  {' '}and switch to a lighter model (e.g. <code className="bg-amber-100 px-0.5 rounded">gemini-2.0-flash</code> or <code className="bg-amber-100 px-0.5 rounded">gpt-4o-mini</code>).
                </span>
              </li>
            )}
            <li className="flex items-start gap-1.5">
              <span className="font-bold shrink-0">2.</span>
              <span>Wait a few minutes, then try again.</span>
            </li>
            {isRateLimit && (
              <li className="flex items-start gap-1.5">
                <span className="font-bold shrink-0">3.</span>
                <span>Reduce the number of questions in the sidebar.</span>
              </li>
            )}
          </ol>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50"
          >
            <Minus className="w-3 h-3" /> Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

function NewAssessmentModal({ availableQuestions, folderName, onConfirm, onClose }: {
  availableQuestions: Question[]
  folderName: string
  onConfirm: (questions: Question[]) => void
  onClose: () => void
}) {
  const maxCount = availableQuestions.length
  const defaultCount = Math.min(10, maxCount)
  const [count, setCount] = useState(defaultCount)

  // Topic breakdown for display
  const topicCounts = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const q of availableQuestions) {
      map[q.topic] = (map[q.topic] ?? 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [availableQuestions])

  function handleCreate() {
    const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5)
    onConfirm(shuffled.slice(0, count))
  }

  if (maxCount === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={onClose}
        onKeyDown={e => e.key === 'Escape' && onClose()}
        role="dialog"
        aria-modal="true"
        aria-label="New Assessment"
      >
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
          <h2 className="text-sm font-semibold text-stone-800">New Assessment</h2>
          <p className="text-xs text-stone-500">
            No saved questions in <span className="font-medium text-stone-700">{folderName}</span>. Save some questions to the library first.
          </p>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200">Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      onKeyDown={e => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="New Assessment"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div>
          <h2 className="text-sm font-semibold text-stone-800">New Assessment</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Random questions from <span className="font-medium text-stone-700">{folderName}</span>
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-stone-600">
            Number of questions
            <span className="ml-1 text-stone-400 font-normal">(max {maxCount})</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={maxCount}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="flex-1 accent-emerald-600"
            />
            <input
              type="number"
              min={1}
              max={maxCount}
              value={count}
              onChange={e => setCount(Math.min(maxCount, Math.max(1, Number(e.target.value))))}
              className="w-14 text-sm text-center border border-stone-300 rounded-lg px-2 py-1 font-medium"
            />
          </div>
        </div>

        {topicCounts.length > 1 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-stone-600">Topics in this folder</p>
            <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto pr-1">
              {topicCounts.map(([topic, n]) => (
                <div key={topic} className="flex items-center justify-between text-xs text-stone-500">
                  <span className="truncate">{topic}</span>
                  <span className="ml-2 shrink-0 text-stone-400">{n}q</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200">Cancel</button>
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
          >
            Create ({count} questions)
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteAccountModal({ onConfirm, onClose, isDeleting }: {
  onConfirm: () => void
  onClose: () => void
  isDeleting: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={!isDeleting ? onClose : undefined}
      onKeyDown={e => !isDeleting && e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Delete Account"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-stone-800">Delete Account</h2>
            <p className="text-xs text-stone-500 mt-1">
              This permanently deletes your account and all data — assessments, questions, folders, and resources. This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60 flex items-center gap-1.5"
          >
            {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            {isDeleting ? 'Deleting…' : 'Delete everything'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [pendingRole, setPendingRole] = useState<IgcseRole>('student')
  const [view, setViewRaw] = useState<'dashboard' | 'main' | 'library' | 'diagrams' | 'practice' | 'exam' | 'progress' | 'class' | 'admin'>('dashboard')
  const [practiceAssessment, setPracticeAssessment] = useState<Assessment | null>(null)
  const [examAssessment, setExamAssessment] = useState<Assessment | null>(null)
  const [previousView, setPreviousView] = useState<'library' | null>(null)
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG)
  const [syllabusContext, setSyllabusContext] = useState('')
  const [studentMode, setStudentMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'questions' | 'answerKey' | 'markScheme'>('questions')
  const [isEditing, setIsEditing] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(undefined)
  const [showNewAssessmentModal, setShowNewAssessmentModal] = useState(false)
  const [importedQuestions, setImportedQuestions] = useState<ImportedQuestion[]>([])
  const [importedLoading, setImportedLoading] = useState(false)
  const [diagramPool, setDiagramPool] = useState<DiagramPoolEntry[]>([])
  const [diagramPoolLoading, setDiagramPoolLoading] = useState(false)
  const [practiceAttempts, setPracticeAttempts] = useState<PracticeAttempt[]>([])
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([])
  const [shareAssessment, setShareAssessment] = useState<Assessment | null>(null)
  const [libraryEditAssessment, setLibraryEditAssessment] = useState<Assessment | null>(null)
  const [libraryWeakTopicFilter, setLibraryWeakTopicFilter] = useState<{ topic: string; subject: string } | null>(null)
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const roleMenuRef = useRef<HTMLDivElement>(null)
  const [workspaceGeminiKey, setWorkspaceGeminiKey] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [practiceReturnView, setPracticeReturnView] = useState<'library' | 'class'>('library')

  const { notifications, notify, dismiss } = useNotifications()
  const { provider, setProvider, apiKeys, setApiKey, currentApiKey: userApiKey, customModel, setCustomModel, defaultModel } = useApiSettings()
  // Use user's own key first; fall back to workspace key if user hasn't set one
  const currentApiKey = userApiKey || (provider === 'gemini' ? workspaceGeminiKey : '')
  const library = useAssessments(user, notify)
  const resources = useResources(user, notify)
  const generation = useGeneration(notify, provider, currentApiKey || undefined, resources.updateGeminiUri)
  const gamification = useGamification()
  const dailyChallenge = useDailyChallenge()
  const mascot = useMascot(gamification.profile)

  // Role-guarded view setter
  const setView = useCallback((v: typeof view) => {
    const role = gamification.profile?.role_igcsetools ?? 'student'
    const teacherOnly: (typeof view)[] = ['main', 'library', 'diagrams']
    const adminOnly: (typeof view)[] = ['admin']
    if (role === 'student' && teacherOnly.includes(v)) return
    if (role !== 'admin' && adminOnly.includes(v)) return
    setViewRaw(v)
  }, [gamification.profile?.role_igcsetools]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      const wasLoggedIn = user !== undefined && user !== null
      setUser(u)
      if (u) {
        library.loadAll()
        resources.loadResources(config.subject)
        gamification.reload()
        // Load workspace config (shared Gemini key set by admin)
        getWorkspaceConfig().then(cfg => {
          if (cfg.geminiKey) setWorkspaceGeminiKey(cfg.geminiKey)
        }).catch(console.error)
        // Persist role chosen on login screen for new/first-time users
        import('./lib/firebase').then(({ getUserProfile }) =>
          getUserProfile().then(profile => {
            if (!profile || profile.role_igcsetools === 'student') {
              setUserRole(pendingRole).catch(console.error)
            }
          })
        ).catch(console.error)
      } else if (wasLoggedIn) {
        // Clear API keys from localStorage only on real logout (not initial load)
        // so the next user doesn't see a previous user's keys.
        localStorage.removeItem('igcse_tools_api_keys')
        localStorage.removeItem('igcse_tools_provider')
        localStorage.removeItem('igcse_tools_custom_model')
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) resources.loadResources(config.subject)
  }, [config.subject, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch workspace key whenever user has no personal key set (e.g. after admin saves it)
  useEffect(() => {
    if (!user || userApiKey || provider !== 'gemini') return
    getWorkspaceConfig().then(cfg => {
      if (cfg.geminiKey) setWorkspaceGeminiKey(cfg.geminiKey)
    }).catch(console.error)
  }, [user, userApiKey, provider]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show onboarding modal for brand-new students (xp=0, not seen before)
  useEffect(() => {
    const profile = gamification.profile
    if (!profile || !user) return
    if (profile.role_igcsetools !== 'student') return
    if (profile.xp !== 0) return
    const key = `igcse_onboarded_${user.uid}`
    if (localStorage.getItem(key)) return
    setShowOnboarding(true)
  }, [gamification.profile, user])

  useEffect(() => {
    if (user && (view === 'library' || view === 'dashboard')) library.loadAll()
  }, [view, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && (view === 'dashboard' || view === 'progress')) {
      getPracticeAttempts().then(setPracticeAttempts).catch(console.error)
      getExamAttempts().then(setExamAttempts).catch(console.error)
    }
  }, [view, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && config.useDiagramPool) {
      getDiagramPool(config.subject).then(setDiagramPool).catch(console.error)
    }
  }, [config.subject, config.useDiagramPool, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showRoleMenu) return
    const handler = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showRoleMenu])

  useEffect(() => {
    if (user && view === 'dashboard') {
      getDiagramPool().then(setDiagramPool).catch(console.error)
      if (importedQuestions.length === 0 && !importedLoading) handleLoadImported()
      // Load daily challenge once we have questions
      if (library.questions.length >= 3) {
        dailyChallenge.load(library.questions, importedQuestions)
      }
    }
  }, [view, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = useCallback(async () => {
    if (!currentApiKey) {
      notify('No API key set. Open API Settings and add your key to get started.', 'error')
      setApiSettingsOpen(true)
      return
    }
    setView('main')
    setPreviousView(null)
    const effectiveModel = customModel.trim() || config.model

    // If diagram pool is enabled, ensure it's loaded before generating
    let pool = diagramPool
    if (config.useDiagramPool && pool.length === 0) {
      try {
        pool = await getDiagramPool(config.subject)
        setDiagramPool(pool)
      } catch (e) {
        console.error('Failed to load diagram pool:', e)
      }
    }

    // Block generation if pool is enabled but has no diagrams for the selected subject
    if (config.useDiagramPool) {
      const subjectPool = pool.filter(e => e.subject === config.subject)
      if (subjectPool.length === 0) {
        notify(
          `No diagrams in pool for "${config.subject}". Upload diagrams in the Diagram Gallery or uncheck "Use Diagram Pool" to generate TikZ diagrams instead.`,
          'error',
        )
        return
      }
    }

    generation.generate({ ...config, provider, model: effectiveModel, syllabusContext, diagramPool: config.useDiagramPool ? pool : undefined } as any, resources.knowledgeBase, resources.getBase64)
  }, [config, provider, customModel, syllabusContext, currentApiKey, resources.knowledgeBase, resources.getBase64, generation, notify, diagramPool])

  // Smart save: update if already in Firestore, else create new
  const handleSave = useCallback(async () => {
    const assessment = generation.generatedAssessment
    if (!assessment) return
    const alreadySaved = library.assessments.some(a => a.id === assessment.id)
    if (alreadySaved) {
      await library.updateAssessment(assessment.id, {
        questions: assessment.questions,
        topic: assessment.topic,
        subject: assessment.subject,
        difficulty: assessment.difficulty,
      })
      notify('Assessment updated', 'success')
    } else {
      const savedId = await library.saveAssessment(assessment)
      if (savedId) generation.setGeneratedAssessment({ ...assessment, id: savedId })
    }
  }, [generation, library, notify])


  const handleRemoveQuestion = useCallback((questionId: string) => {
    const assessment = generation.generatedAssessment
    if (!assessment) return
    generation.setGeneratedAssessment({
      ...assessment,
      questions: assessment.questions.filter(q => q.id !== questionId),
    })
  }, [generation])

  const handleMoveQuestion = useCallback((questionId: string, direction: 'up' | 'down') => {
    const assessment = generation.generatedAssessment
    if (!assessment) return
    const idx = assessment.questions.findIndex(q => q.id === questionId)
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx === -1 || newIdx < 0 || newIdx >= assessment.questions.length) return
    const questions = [...assessment.questions]
    ;[questions[idx], questions[newIdx]] = [questions[newIdx], questions[idx]]
    generation.setGeneratedAssessment({ ...assessment, questions })
  }, [generation])

  const handleAddQuestionsToCurrentAssessment = useCallback((questions: QuestionItem[]) => {
    const assessment = generation.generatedAssessment
    if (!assessment) return
    generation.setGeneratedAssessment({
      ...assessment,
      questions: [...assessment.questions, ...questions],
    })
  }, [generation])

  const handleStartPractice = useCallback((assessment: Assessment) => {
    if (assessment.questions.length === 0) {
      notify('This assessment has no questions to practice.', 'error')
      return
    }
    setPracticeReturnView('library')
    setPracticeAssessment(assessment)
    setView('practice')
  }, [notify])

  const handleStartExam = useCallback((assessment: Assessment) => {
    if (assessment.questions.length === 0) {
      notify('This assessment has no questions.', 'error')
      return
    }
    setExamAssessment(assessment)
    setView('exam')
  }, [notify])

  const handleLoadImported = useCallback(async () => {
    if (!user || importedLoading) return
    setImportedLoading(true)
    try {
      const qs = await getImportedQuestions()
      setImportedQuestions(qs)
    } catch (e) {
      console.error('Failed to load imported questions:', e)
    } finally {
      setImportedLoading(false)
    }
  }, [user, importedLoading])

  const handleUpdateImported = useCallback(async (uid: string, updates: Partial<ImportedQuestion>) => {
    await updateImportedQuestion(uid, updates)
    setImportedQuestions(prev => prev.map(q => q.uid === uid ? { ...q, ...updates } : q))
  }, [])

  const handleLoadDiagramPool = useCallback(async (subject?: string) => {
    setDiagramPoolLoading(true)
    try {
      const pool = await getDiagramPool(subject)
      setDiagramPool(pool)
    } finally {
      setDiagramPoolLoading(false)
    }
  }, [])

  const handleUpdateDiagramEntry = useCallback(async (id: string, updates: Partial<DiagramPoolEntry>) => {
    await updateDiagramPoolEntry(id, updates)
    setDiagramPool(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }, [])

  const handleDeleteDiagramEntry = useCallback(async (id: string) => {
    await deleteDiagramPoolEntry(id)
    setDiagramPool(prev => prev.filter(e => e.id !== id))
  }, [])

  const handleUploadDiagram = useCallback(async (
    file: File,
    subject: string,
    meta: { description: string; category: DiagramCategory; topics: string[]; tags: string[] }
  ) => {
    try {
      const { imageURL, storagePath, imageName } = await uploadDiagramImage(file, subject)
      const id = await addDiagramPoolEntry({
        imageName,
        storagePath,
        imageURL,
        subject,
        topics: meta.topics,
        tags: meta.tags,
        description: meta.description,
        category: meta.category,
        usedInQuestionUids: [],
      })
      const newEntry: DiagramPoolEntry = {
        id,
        imageName,
        storagePath,
        imageURL,
        subject,
        topics: meta.topics,
        tags: meta.tags,
        description: meta.description,
        category: meta.category,
        usedInQuestionUids: [],
        createdAt: null as any,
      }
      setDiagramPool(prev => [newEntry, ...prev])
      notify('Diagram uploaded successfully', 'success')
    } catch (e: unknown) {
      notify(`Upload failed: ${(e as Error).message ?? 'Unknown error'}`, 'error')
      throw e // re-throw so PdfDiagramExtractor can show per-item error
    }
  }, [notify])

  const handleCreateAssessmentFromQuestions = useCallback((questions: Question[]) => {
    const assessment: Assessment = {
      id: crypto.randomUUID(),
      subject: questions[0]?.subject ?? 'Mixed',
      topic: 'Custom Selection',
      difficulty: questions[0]?.difficulty ?? 'Mixed',
      questions,
      userId: '',
      createdAt: Timestamp.now(),
    }
    generation.setGeneratedAssessment(assessment)
    setPreviousView('library')
    setView('main')
  }, [generation])

  const handleAddQuestionsToAssessment = useCallback(async (assessmentId: string, newQuestions: Question[]) => {
    const target = library.assessments.find(a => a.id === assessmentId)
    if (!target) return
    await library.updateAssessment(assessmentId, { questions: [...target.questions, ...newQuestions] })
  }, [library])

  const handleUpdateQuestion = useCallback((questionId: string, updates: Partial<QuestionItem>) => {
    const assessment = generation.generatedAssessment
    if (!assessment) return
    generation.setGeneratedAssessment({
      ...assessment,
      questions: assessment.questions.map(q => q.id === questionId ? { ...q, ...updates } : q),
    })
  }, [generation])

  const handleRegenerateDiagrams = useCallback(async (questions: QuestionItem[], renderErrors?: Record<string, string>) => {
    if (!questions.length) return
    // Diagram generation always uses Gemini regardless of the selected provider
    const geminiKey = apiKeys['gemini']
    if (!geminiKey) {
      notify('Diagram generation requires a Gemini API key. Open API Settings → Google Gemini and add your free key.', 'error')
      setApiSettingsOpen(true)
      return
    }
    const assessment = generation.generatedAssessment
    if (!assessment) return
    try {
      const regenerated = await regenerateDiagramsForQuestions(
        questions.map(repairQuestionItem),
        assessment.subject,
        customModel.trim() || DEFAULT_MODELS['gemini'],
        geminiKey,
        undefined,
        undefined,
        renderErrors,
      )
      if (!regenerated.length) {
        notify('Diagram regenerate could not produce a valid diagram for this question.', 'error')
        return
      }
      const byId = new Map(regenerated.map(item => [item.id, item.diagram]))
      generation.setGeneratedAssessment({
        ...assessment,
        questions: assessment.questions.map(q => {
          const diagram = byId.get(q.id)
          if (!diagram) return q
          return { ...q, diagram, hasDiagram: true, diagramMissing: undefined }
        }),
      })
      notify(`Regenerated ${regenerated.length} diagram${regenerated.length > 1 ? 's' : ''}.`, 'success')
    } catch (e: any) {
      notify(e?.message || 'Failed to regenerate diagram.', 'error')
    }
  }, [currentApiKey, generation, notify, customModel, config.model])

  const handleRepairQuestion = useCallback(async (question: QuestionItem) => {
    const geminiKey = apiKeys['gemini']
    if (!geminiKey) {
      notify('Question improvement requires a Gemini API key.', 'error')
      setApiSettingsOpen(true)
      return null
    }
    const assessment = generation.generatedAssessment
    if (!assessment) return null
    try {
      const updates = await repairQuestionText(
        question,
        assessment.subject,
        customModel.trim() || DEFAULT_MODELS['gemini'],
        geminiKey,
      )
      if (!updates) {
        notify('No issues found to fix.', 'success')
        return null
      }
      return updates
    } catch (e: any) {
      notify(e?.message || 'Failed to improve question.', 'error')
      return null
    }
  }, [apiKeys, generation, notify, customModel])

  const handleDeleteAccount = useCallback(async () => {
    setIsDeleting(true)
    try {
      await deleteUserData()
      // Auth state change fires automatically after account deletion
    } catch (e) {
      notify('Failed to delete account. You may need to re-login first.', 'error')
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }, [notify])

  const handleCopy = useCallback(async (text: string) => {
    const ok = await copyToClipboard(text)
    notify(ok ? 'Copied to clipboard' : 'Copy failed', ok ? 'success' : 'error')
  }, [notify])

  const displayAssessment = generation.generatedAssessment
    ? {
        ...generation.generatedAssessment,
        questions: generation.generatedAssessment.questions.map(repairQuestionItem),
      }
    : null

  if (!user) {
    const roleOptions: { id: IgcseRole; label: string; desc: string; icon: string }[] = [
      { id: 'student', label: 'Student',  desc: 'Practice & track my progress',     icon: '🎓' },
      { id: 'teacher', label: 'Teacher',  desc: 'Generate & assign assessments',    icon: '📋' },
      { id: 'admin',   label: 'Admin',    desc: 'Manage workspace & users',         icon: '🛡️' },
    ]
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 50%, #fdf4ff 100%)' }}>
        <div className="text-center max-w-sm w-full anim-pop">
          {/* Logo */}
          <div className="flex items-center justify-center w-20 h-20 rounded-3xl mx-auto mb-6 shadow-xl"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#a855f7)' }}>
            <BookOpen className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">IGCSE Tools</h1>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">
            AI-powered Cambridge IGCSE assessment platform<br />for teachers, students, and institutions.
          </p>

          {/* Feature highlights */}
          <div className="grid grid-cols-3 gap-2 mb-6 text-xs text-slate-500">
            <div className="bg-white/70 rounded-xl p-2.5 flex flex-col items-center gap-1">
              <span className="text-lg">✨</span>
              <span className="font-semibold">AI Generation</span>
              <span className="text-slate-400">For teachers</span>
            </div>
            <div className="bg-white/70 rounded-xl p-2.5 flex flex-col items-center gap-1">
              <span className="text-lg">📊</span>
              <span className="font-semibold">Progress</span>
              <span className="text-slate-400">For students</span>
            </div>
            <div className="bg-white/70 rounded-xl p-2.5 flex flex-col items-center gap-1">
              <span className="text-lg">🏫</span>
              <span className="font-semibold">Class Mode</span>
              <span className="text-slate-400">Share & assign</span>
            </div>
          </div>

          {/* Role selection */}
          <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">I am a…</p>
          <div className="flex gap-2 mb-5">
            {roleOptions.map(r => (
              <button
                key={r.id}
                onClick={() => setPendingRole(r.id)}
                className={[
                  'flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border-2 text-xs font-bold transition-all',
                  pendingRole === r.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300',
                ].join(' ')}
              >
                <span className="text-xl">{r.icon}</span>
                <span>{r.label}</span>
                <span className="text-[10px] font-normal text-slate-400 leading-tight">{r.desc}</span>
              </button>
            ))}
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full px-6 py-3.5 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 hover:opacity-90 transition-all shadow-xl"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
          >
            <LogIn className="w-5 h-5" /> Continue with Google
          </button>
          <p className="mt-4 text-xs text-slate-400">Free to use · No credit card required</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f8f9ff' }}>
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* ── Top nav ─────────────────────────────────────────────────────── */}
        <header className="shrink-0 bg-white border-b border-indigo-100 px-4 py-2.5 flex items-center gap-3 shadow-sm">

          {/* Logo */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-xl shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-black text-slate-800 hidden sm:block">IGCSE Tools</span>
            {view === 'main' && previousView === 'library' && (
              <button
                onClick={() => { setPreviousView(null); setView('library') }}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold ml-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Library
              </button>
            )}
          </div>

          {/* Centre: pill nav */}
          {(() => {
            const userRole = gamification.profile?.role_igcsetools ?? 'student'
            const allTabs = [
              { id: 'dashboard', label: 'Home',     icon: <LayoutDashboard className="w-3.5 h-3.5" />, roles: ['student','teacher','admin'] as IgcseRole[] },
              { id: 'main',      label: 'Generate', icon: <Wand2 className="w-3.5 h-3.5" />,           roles: ['teacher','admin'] as IgcseRole[] },
              { id: 'library',   label: 'Library',  icon: <LibraryIcon className="w-3.5 h-3.5" />,     roles: ['teacher','admin'] as IgcseRole[] },
              { id: 'diagrams',  label: 'Diagrams', icon: <Sparkles className="w-3.5 h-3.5" />,        roles: ['teacher','admin'] as IgcseRole[] },
              { id: 'progress',  label: 'Progress', icon: <TrendingUp className="w-3.5 h-3.5" />,      roles: ['student','teacher','admin'] as IgcseRole[] },
              { id: 'class',     label: 'Class',    icon: <Users className="w-3.5 h-3.5" />,           roles: ['student','teacher','admin'] as IgcseRole[] },
              { id: 'admin',     label: 'Admin',    icon: <Shield className="w-3.5 h-3.5" />,          roles: ['admin'] as IgcseRole[] },
            ]
            const tabs = allTabs.filter(t => t.roles.includes(userRole))
            return (
              <nav className="flex items-center gap-1 mx-auto bg-slate-100 rounded-2xl p-1">
                {tabs.map(tab => {
                  const active = view === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setPreviousView(null); setView(tab.id as typeof view) }}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                        active
                          ? 'text-white shadow-md'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-white/60',
                      ].join(' ')}
                      style={active ? { background: 'linear-gradient(135deg,#6366f1,#a855f7)' } : {}}
                    >
                      {tab.icon}
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            )
          })()}

          {/* Right: user */}
          <div className="flex items-center gap-1.5 shrink-0 relative">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full ring-2 ring-indigo-200" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-700">
                {(user.displayName?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            {/* Role badge — clickable for non-admins to switch role */}
            {gamification.profile && gamification.profile.role_igcsetools !== 'admin' && (
              <div ref={roleMenuRef} className="relative hidden md:block">
                <button
                  onClick={() => setShowRoleMenu(v => !v)}
                  className={[
                    'flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none cursor-pointer hover:opacity-80 transition-opacity',
                    gamification.profile.role_igcsetools === 'teacher' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700',
                  ].join(' ')}
                  title="Switch role"
                >
                  {gamification.profile.role_igcsetools === 'teacher' ? 'Teacher' : 'Student'}
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
                {showRoleMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 min-w-[140px]">
                    <button
                      onClick={async () => {
                        await setUserRole('student')
                        gamification.reload()
                        setShowRoleMenu(false)
                        setViewRaw('dashboard')
                        notify('Switched to Student', 'success')
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-600" /> Student
                    </button>
                    <button
                      onClick={async () => {
                        await setUserRole('teacher')
                        gamification.reload()
                        setShowRoleMenu(false)
                        notify('Switched to Teacher', 'success')
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <UserCog className="w-3.5 h-3.5 text-indigo-600" /> Teacher
                    </button>
                  </div>
                )}
              </div>
            )}
            {gamification.profile?.role_igcsetools === 'admin' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none bg-amber-100 text-amber-700 hidden md:inline">
                Admin
              </span>
            )}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
              title="Delete account"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Error banner */}
        {generation.error && (
          <ErrorBanner
            error={generation.error}
            onDismiss={() => generation.setError(null)}
            onRetry={() => { generation.setError(null); handleGenerate() }}
            onOpenApiSettings={() => { setApiSettingsOpen(true) }}
          />
        )}

        {/* Main content */}
        {/* Safety net: redirect unauthorised views */}
        {(() => {
          const role = gamification.profile?.role_igcsetools ?? 'student'
          if (role === 'student' && (['main', 'library', 'diagrams', 'admin'] as (typeof view)[]).includes(view)) {
            setViewRaw('dashboard')
          } else if (role !== 'admin' && view === 'admin') {
            setViewRaw('dashboard')
          }
          return null
        })()}
        {view === 'admin' ? (
          <AdminPanel
            currentUserId={user.uid}
            notify={notify}
          />
        ) : view === 'progress' ? (
          <ProgressDashboard
            practiceAttempts={practiceAttempts}
            examAttempts={examAttempts}
            onPracticeWeakTopic={(topic, subject) => {
              setLibraryWeakTopicFilter({ topic, subject })
              setView('library')
            }}
          />
        ) : view === 'class' ? (
          <ClassDashboard
            assessments={library.assessments}
            currentUser={{ uid: user.uid, displayName: user.displayName, email: user.email }}
            userRole={gamification.profile?.role_igcsetools ?? 'student'}
            provider={provider}
            apiKey={currentApiKey}
            model={customModel.trim() || defaultModel}
            notify={notify}
            onStartPractice={a => { setPracticeReturnView('class'); setPracticeAssessment(a); setView('practice') }}
          />
        ) : view === 'dashboard' ? (
          <Dashboard
            assessments={library.assessments}
            questions={library.questions}
            importedQuestions={importedQuestions}
            diagramPool={diagramPool}
            resources={resources.resources}
            practiceAttempts={practiceAttempts}
            currentUserId={user.uid}
            currentUserName={user.displayName ?? user.email ?? ''}
            userProfile={gamification.profile}
            userRole={gamification.profile?.role_igcsetools ?? 'student'}
            dailyChallenge={dailyChallenge.challenge}
            mascotMood={mascot.mood}
            onNavigate={v => { setPreviousView(null); setView(v) }}
            onStartDailyChallenge={() => {
              // Pick first 3 available MCQ questions and open practice
              const mcqs = library.questions.filter(q => q.type === 'mcq').slice(0, 3)
              const pool = mcqs.length >= 3 ? mcqs : library.questions.slice(0, 3)
              if (pool.length === 0) { notify('No questions in library yet', 'error'); return }
              const fakeAssessment = {
                id: `daily_${new Date().toISOString().slice(0, 10)}`,
                subject: pool[0].subject ?? 'Mixed',
                topic: 'Daily Challenge',
                difficulty: 'Balanced',
                questions: pool.map(q => ({ ...q })),
                userId: user.uid,
                folderId: undefined,
                createdAt: null as any,
              }
              setPracticeAssessment(fakeAssessment)
              setView('practice')
            }}
          />
        ) : view === 'diagrams' ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <DiagramLibrary
              entries={diagramPool}
              loading={diagramPoolLoading}
              onLoad={handleLoadDiagramPool}
              onUpdate={handleUpdateDiagramEntry}
              onDelete={handleDeleteDiagramEntry}
              onUpload={handleUploadDiagram}
              geminiApiKey={apiKeys['gemini']}
              onSaveQuestions={async (questions, subject, topic) => {
                const full = questions.map(q => ({
                  ...q,
                  id: crypto.randomUUID(),
                  subject,
                  topic,
                  difficulty: 'Medium',
                  userId: '',
                  createdAt: null as any,
                }))
                await library.saveQuestions(full)
                notify('Questions saved to library', 'success')
              }}
            />
          </div>
        ) : view === 'library' ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <LibraryView
            assessments={library.assessments}
            questions={library.questions}
            folders={library.folders}
            loading={library.loading}
            onSelect={a => { generation.setGeneratedAssessment(a); setLibraryEditAssessment(a); setIsEditing(false) }}
            onDeleteAssessment={library.deleteAssessment}
            onMoveAssessment={library.moveAssessment}
            onRenameAssessment={(id, topic) => library.updateAssessment(id, { topic })}
            onDeleteQuestion={library.deleteQuestion}
            onMoveQuestion={library.moveQuestion}
            onCreateFolder={library.createFolder}
            onDeleteFolder={library.deleteFolder}
            onRenameFolder={library.renameFolder}
            onMoveFolder={library.moveFolder}
            onReorderFolders={library.reorderFolders}
            onTogglePublicFolder={library.togglePublicFolder}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            onCreateAssessmentFromQuestions={handleCreateAssessmentFromQuestions}
            onAddQuestionsToAssessment={handleAddQuestionsToAssessment}
            onUpdateQuestion={library.updateQuestion}
            currentUserId={user.uid}
            currentUserName={user.displayName ?? user.email ?? 'Unknown'}
            onTogglePublicAssessment={(id, isPublic) => library.togglePublicAssessment(id, isPublic, user.displayName ?? user.email ?? 'Unknown')}
            onTogglePublicQuestion={(id, isPublic) => library.togglePublicQuestion(id, isPublic, user.displayName ?? user.email ?? 'Unknown')}
            importedQuestions={importedQuestions}
            importedLoading={importedLoading}
            onLoadImported={handleLoadImported}
            onUpdateImported={handleUpdateImported}
            onNewAssessment={() => setShowNewAssessmentModal(true)}
            onRegenerateDiagram={async (q) => {
              const results = await (await import('./lib/gemini')).regenerateDiagramsForQuestions(
                [q], q.subject,
                customModel.trim() || DEFAULT_MODELS['gemini'],
                apiKeys['gemini'],
              )
              if (results.length) await library.updateQuestion(q.id, { diagram: results[0].diagram, hasDiagram: true, diagramMissing: undefined })
            }}
            onPractice={handleStartPractice}
            onExam={handleStartExam}
            onShare={setShareAssessment}
            weakTopicFilter={libraryWeakTopicFilter}
            editPanel={libraryEditAssessment ? (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-2 flex items-center gap-3">
                  <button
                    onClick={() => { setLibraryEditAssessment(null); setIsEditing(false) }}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Back to Library
                  </button>
                  <span className="text-xs text-stone-400 truncate">
                    {libraryEditAssessment.subject} · {libraryEditAssessment.topic}
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <AssessmentView
                    assessment={displayAssessment}
                    analysisText={null}
                    isEditing={isEditing}
                    studentMode={false}
                    isGenerating={false}
                    onEdit={() => setIsEditing(true)}
                    onCancelEdit={() => setIsEditing(false)}
                    onSaveToLibrary={async () => { await handleSave(); notify('Saved', 'success') }}
                    onSave={async () => { await handleSave(); notify('Saved', 'success') }}
                    onCopy={handleCopy}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onRemoveQuestion={handleRemoveQuestion}
                    onMoveQuestion={handleMoveQuestion}
                    bankQuestions={library.questions}
                    onAddQuestions={handleAddQuestionsToCurrentAssessment}
                    onUpdateQuestion={handleUpdateQuestion}
                    onRegenerateDiagrams={handleRegenerateDiagrams}
                    onRepairQuestion={handleRepairQuestion}
                  />
                </div>
              </div>
            ) : undefined}
          />
          </div>
        ) : view === 'exam' && examAssessment ? (
          <ExamMode
            assessment={examAssessment}
            provider={provider}
            apiKey={currentApiKey}
            model={customModel.trim() || defaultModel}
            onExit={() => { setExamAssessment(null); setView('library') }}
            onComplete={(attempt) => {
              notify(`Exam complete! ${attempt.marksAwarded}/${attempt.totalMarks} marks (${Math.round(attempt.marksAwarded / Math.max(attempt.totalMarks, 1) * 100)}%)`, 'success')
              setExamAttempts(prev => [attempt, ...prev])
              setExamAssessment(null)
              setView('library')
            }}
            notify={notify}
          />
        ) : view === 'practice' && practiceAssessment ? (
          <PracticeMode
            assessment={practiceAssessment}
            provider={provider}
            apiKey={currentApiKey}
            model={customModel.trim() || defaultModel}
            mascotLevel={gamification.profile?.level ?? 1}
            onExit={() => { setPracticeAssessment(null); setViewRaw(practiceReturnView) }}
            onComplete={(attempt) => {
              notify(`Practice complete! ${attempt.marksAwarded}/${attempt.totalMarks} marks`, 'success')
              setPracticeAttempts(prev => [attempt, ...prev])
              gamification.applyAttempt(attempt)
              setPracticeAssessment(null)
              setViewRaw(practiceReturnView)
            }}
            notify={notify}
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-row">
          <Sidebar
            config={config}
            onConfigChange={patch => setConfig(c => ({
              ...c,
              ...patch,
              topic: patch.subject ? (IGCSE_TOPICS[patch.subject]?.[0] ?? c.topic) : (patch.topic ?? c.topic),
            }))}
            onGenerate={handleGenerate}
            isGenerating={generation.isGenerating}
            isAuditing={false}
            retryCount={generation.retryCount}
            lastRunCostIDR={generation.lastRunCostIDR}
            resources={resources.resources}
            knowledgeBase={resources.knowledgeBase}
            onUploadResource={(file, subject, resourceType) => {
              const geminiKey = apiKeys['gemini']
              const isPdf = (resourceType === 'syllabus' || resourceType === 'past_paper')
              if (isPdf && !geminiKey) {
                notify('A Gemini API key is required to extract and cache PDF content. Add your free key in API Settings → Google Gemini.', 'error')
              }
              resources.uploadResource(file, subject, resourceType).then(resource => {
                if (resource && resourceType === 'syllabus' && geminiKey) {
                  resources.processSyllabus(resource, geminiKey)
                }
                if (resource && resourceType === 'past_paper' && geminiKey) {
                  resources.processPastPaper(resource, geminiKey)
                }
              })
            }}
            onAddToKB={(resource) => {
              resources.addToKnowledgeBase(resource)
              const geminiKey = apiKeys['gemini']
              const isPdf = (resource.resourceType === 'past_paper' || resource.resourceType === 'syllabus')
              if (isPdf && !geminiKey) {
                notify('A Gemini API key is required to extract PDF content for use as a reference. Add your free key in API Settings → Google Gemini.', 'error')
              }
              if (resource.resourceType === 'past_paper' && geminiKey) {
                resources.processPastPaper(resource, geminiKey)
              }
              if (resource.resourceType === 'syllabus' && geminiKey) {
                resources.processSyllabus(resource, geminiKey)
              }
            }}
            onRemoveFromKB={resources.removeFromKnowledgeBase}
            onDeleteResource={resources.deleteResource}
            onUpdateResourceType={resources.updateResourceType}
            onToggleShared={resources.toggleShared}
            currentUserId={user?.uid}
            uploading={resources.uploading}
            processingIds={resources.processingIds}
            studentMode={studentMode}
            onStudentModeToggle={() => setStudentMode(s => !s)}
            syllabusContext={syllabusContext}
            onSyllabusContextChange={setSyllabusContext}
            provider={provider}
            onProviderChange={p => {
              setProvider(p)
              setConfig(c => ({ ...c, provider: p, model: DEFAULT_MODELS[p] }))
              if (p !== 'gemini') {
                notify('Quality audit is only available with Gemini. Generated questions will not be audited for Cambridge IGCSE standards.', 'info')
              }
            }}
            apiKeys={apiKeys}
            onApiKeyChange={setApiKey}
            customModel={customModel}
            onCustomModelChange={setCustomModel}
            apiSettingsOpen={apiSettingsOpen}
            onApiSettingsOpenChange={setApiSettingsOpen}
            diagramPoolCount={diagramPool.length}
            userRole={gamification.profile?.role_igcsetools ?? 'teacher'}
          />
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <AssessmentView
            assessment={displayAssessment}
            analysisText={generation.analysisText}
            isEditing={isEditing}
            studentMode={studentMode}
            isGenerating={generation.isGenerating}
            generationLog={generation.generationLog}
            onEdit={() => setIsEditing(true)}
            onCancelEdit={() => setIsEditing(false)}
            onSaveToLibrary={handleSave}
            onSave={handleSave}
            onStudentFeedback={(answers) => generation.getStudentFeedback(answers, config.model)}
            onCopy={handleCopy}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRemoveQuestion={handleRemoveQuestion}
            onMoveQuestion={handleMoveQuestion}
            bankQuestions={library.questions}
            onAddQuestions={handleAddQuestionsToCurrentAssessment}
            onUpdateQuestion={handleUpdateQuestion}
            onRegenerateDiagrams={handleRegenerateDiagrams}
            onRepairQuestion={handleRepairQuestion}
          />
          </div>
          </div>
        )}

        {/* Footer — pinned to bottom of the right panel */}
        <footer className="shrink-0 min-h-0 border-t border-stone-200 bg-stone-50 px-4 py-2 flex items-center justify-between text-xs text-stone-400 z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-medium text-stone-500">IGCSE Tools</span>
            <span className="hidden sm:inline text-stone-300">·</span>
            <span className="hidden sm:inline">Cambridge Assessment Designer</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-violet-400" />
              AI-Powered
            </span>
            <span className="text-stone-300">·</span>
            <span>© {new Date().getFullYear()} Eduversal</span>
          </div>
        </footer>
      </div>

      <Notifications notifications={notifications} onDismiss={dismiss} />

      {showNewAssessmentModal && (() => {
        // Collect all folder ids in the selected subtree (selected folder + all descendants)
        const getDescendantIdSet = (folderId: string): Set<string> => {
          const ids = new Set<string>([folderId])
          const stack = [folderId]
          while (stack.length) {
            const cur = stack.pop()!
            for (const f of library.folders) {
              if (f.parentId === cur) { ids.add(f.id); stack.push(f.id) }
            }
          }
          return ids
        }
        const folderIds = selectedFolderId === undefined
          ? null // "All" — use everything
          : selectedFolderId === null
          ? null // "Uncategorized" — filter below
          : getDescendantIdSet(selectedFolderId)

        const availableQuestions = library.questions.filter(q => {
          if (selectedFolderId === null) return !q.folderId
          if (folderIds) return q.folderId != null && folderIds.has(q.folderId)
          return true
        })

        const folderName = selectedFolderId === undefined
          ? 'All Questions'
          : selectedFolderId === null
          ? 'Uncategorized'
          : (library.folders.find(f => f.id === selectedFolderId)?.name ?? 'Selected Folder')

        return (
          <NewAssessmentModal
            availableQuestions={availableQuestions}
            folderName={folderName}
            onConfirm={qs => { handleCreateAssessmentFromQuestions(qs); setShowNewAssessmentModal(false) }}
            onClose={() => setShowNewAssessmentModal(false)}
          />
        )
      })()}

      {showDeleteModal && (
        <DeleteAccountModal
          onConfirm={handleDeleteAccount}
          onClose={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}

      {shareAssessment && (
        <ShareAssessmentPanel
          assessment={shareAssessment}
          notify={notify}
          onClose={() => setShareAssessment(null)}
        />
      )}

      {/* Onboarding modal — shown once for brand-new students */}
      {showOnboarding && user && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-black text-slate-800 mb-1">Welcome to IGCSE Tools!</h2>
              <p className="text-sm text-slate-500">
                Your teacher will share a <strong>join code</strong> with you.
                Head to the <strong>Class</strong> tab to enter it and start your first assignment.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  localStorage.setItem(`igcse_onboarded_${user.uid}`, '1')
                  setShowOnboarding(false)
                  setView('class')
                }}
                className="w-full py-3 rounded-2xl text-white text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}
              >
                Go to Class tab
              </button>
              <button
                onClick={() => {
                  localStorage.setItem(`igcse_onboarded_${user.uid}`, '1')
                  setShowOnboarding(false)
                }}
                className="w-full py-2 rounded-2xl text-slate-500 text-sm hover:bg-slate-50"
              >
                Explore on my own
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Badge unlock notification — shows one at a time */}
      {gamification.newlyUnlockedBadges.length > 0 && (
        <BadgeUnlockModal
          badgeId={gamification.newlyUnlockedBadges[0]}
          onDismiss={gamification.dismissBadge}
        />
      )}

      {/* Evolution animation — triggered when Edu levels up to a new form */}
      {mascot.didEvolve && mascot.previousForm && (
        <LevelUpModal
          previousForm={mascot.previousForm}
          newLevel={gamification.profile?.level ?? 1}
          onDismiss={mascot.clearEvolution}
        />
      )}

    </div>
  )
}
