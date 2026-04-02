import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Folder as FolderIcon, Trash2, Plus, Library as LibraryIcon, Pencil, X, Check, Eye, FilePlus, FolderPlus, Loader2, Calendar, Globe, RefreshCw, BookOpen, List, LayoutGrid, Upload, ChevronRight, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { Assessment, Question, Folder, ImportedQuestion } from '../../lib/types'
import { cleanExamViewPlaceholders } from '../../lib/firebase'
import { migrateExamViewOptions } from '../../lib/sanitize'
import {
  QMarkdown,
  importedToQuestionItem,
  DeleteTarget,
  ConfirmDeleteModal,
  ImportedPreviewModal,
  QuestionPreviewModal,
  ExamViewImportModal,
  AssessmentViewModal,
} from './modals'

interface Props {
  assessments: Assessment[]
  questions: Question[]
  folders: Folder[]
  loading: boolean
  onSelect: (assessment: Assessment) => void
  onDeleteAssessment: (id: string) => void
  onMoveAssessment: (id: string, folderId: string | null) => void
  onRenameAssessment: (id: string, topic: string) => void
  onDeleteQuestion: (id: string) => void
  onMoveQuestion: (id: string, folderId: string | null) => void
  onCreateFolder: (name: string, parentId?: string) => void
  onDeleteFolder: (id: string) => void
  onRenameFolder: (id: string, name: string) => void
  onMoveFolder: (id: string, parentId: string | null) => void
  onReorderFolders: (orderedIds: string[]) => void
  onTogglePublicFolder: (id: string, isPublic: boolean) => void
  selectedFolderId: string | null | undefined
  onSelectFolder: (id: string | null | undefined) => void
  onCreateAssessmentFromQuestions: (questions: Question[]) => void
  onAddQuestionsToAssessment: (assessmentId: string, questions: Question[]) => void
  onUpdateQuestion: (id: string, updates: Partial<Question>) => void
  currentUserId: string
  currentUserName: string
  isAdmin?: boolean
  onTogglePublicAssessment: (id: string, isPublic: boolean) => void
  onTogglePublicQuestion: (id: string, isPublic: boolean) => void
  onRegenerateDiagram?: (question: Question) => Promise<void>
  onPractice?: (assessment: Assessment) => void
  onExam?: (assessment: Assessment) => void
  onShare?: (assessment: Assessment) => void
  onNewAssessment?: () => void
  /** When set, renders this panel in place of the main content (keeps left sidebar). */
  editPanel?: React.ReactNode
  /** Pre-fill the assessment search with a topic from the Progress Dashboard. */
  weakTopicFilter?: { topic: string; subject: string } | null
  // ── Past Papers (imported questions) ───────────────────────────────────────
  importedQuestions?: ImportedQuestion[]
  importedLoading?: boolean
  onLoadImported?: () => void
  onUpdateImported?: (uid: string, updates: Partial<ImportedQuestion>) => Promise<void>
}

// ─── Subject colour palette ───────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, {
  border: string; bg: string; hoverBorder: string; hoverBg: string;
  badge: string; badgeText: string; codeBg: string; codeText: string; codeBorder: string;
  accentBar: string;
  // raw CSS values for inline styles (sidebar folder rows)
  rawAccent: string; rawBg: string; rawSelectedBg: string; rawBorder: string;
}> = {
  Mathematics: {
    border: 'border-blue-300', bg: 'bg-blue-50', hoverBorder: 'hover:border-blue-500', hoverBg: 'hover:bg-blue-100/60',
    badge: 'bg-blue-500', badgeText: 'text-white',
    codeBg: 'bg-blue-100', codeText: 'text-blue-800', codeBorder: 'border-blue-400',
    accentBar: 'bg-blue-500',
    rawAccent: '#3b82f6', rawBg: '#eff6ff', rawSelectedBg: '#dbeafe', rawBorder: '#93c5fd',
  },
  Biology: {
    border: 'border-emerald-300', bg: 'bg-emerald-50', hoverBorder: 'hover:border-emerald-500', hoverBg: 'hover:bg-emerald-100/60',
    badge: 'bg-emerald-500', badgeText: 'text-white',
    codeBg: 'bg-emerald-100', codeText: 'text-emerald-800', codeBorder: 'border-emerald-400',
    accentBar: 'bg-emerald-500',
    rawAccent: '#10b981', rawBg: '#ecfdf5', rawSelectedBg: '#d1fae5', rawBorder: '#6ee7b7',
  },
  Chemistry: {
    border: 'border-orange-300', bg: 'bg-orange-50', hoverBorder: 'hover:border-orange-500', hoverBg: 'hover:bg-orange-100/60',
    badge: 'bg-orange-500', badgeText: 'text-white',
    codeBg: 'bg-orange-100', codeText: 'text-orange-800', codeBorder: 'border-orange-400',
    accentBar: 'bg-orange-500',
    rawAccent: '#f97316', rawBg: '#fff7ed', rawSelectedBg: '#fed7aa', rawBorder: '#fdba74',
  },
  Physics: {
    border: 'border-violet-300', bg: 'bg-violet-50', hoverBorder: 'hover:border-violet-500', hoverBg: 'hover:bg-violet-100/60',
    badge: 'bg-violet-500', badgeText: 'text-white',
    codeBg: 'bg-violet-100', codeText: 'text-violet-800', codeBorder: 'border-violet-400',
    accentBar: 'bg-violet-500',
    rawAccent: '#8b5cf6', rawBg: '#f5f3ff', rawSelectedBg: '#ede9fe', rawBorder: '#c4b5fd',
  },
}

const SUBJECT_FALLBACK = {
  border: 'border-stone-200', bg: 'bg-white', hoverBorder: 'hover:border-stone-400', hoverBg: 'hover:bg-stone-50',
  badge: 'bg-stone-500', badgeText: 'text-white',
  codeBg: 'bg-stone-100', codeText: 'text-stone-600', codeBorder: 'border-stone-300',
  accentBar: 'bg-stone-400',
  rawAccent: '#78716c', rawBg: '#fafaf9', rawSelectedBg: '#d6d3d1', rawBorder: '#d6d3d1',
}

function subjectColors(subject?: string) {
  return (subject && SUBJECT_COLORS[subject]) ?? SUBJECT_FALLBACK
}

/** Generate a short display code when the question has none (e.g. MAT-2M-MCQ) */
function autoCode(q: { subject?: string; marks?: number; type?: string }): string {
  const subj = (q.subject ?? 'GEN').substring(0, 3).toUpperCase()
  const m = q.marks ?? 1
  const t = q.type === 'mcq' ? 'MCQ' : q.type === 'structured' ? 'STR' : 'SA'
  return `${subj}-${m}M-${t}`
}


export function Library({
  assessments, questions, folders, loading,
  onSelect, onDeleteAssessment, onMoveAssessment, onRenameAssessment,
  onDeleteQuestion, onMoveQuestion,
  onCreateFolder, onDeleteFolder, onRenameFolder, onMoveFolder, onReorderFolders,
  onTogglePublicFolder,
  selectedFolderId, onSelectFolder,
  onCreateAssessmentFromQuestions, onAddQuestionsToAssessment,
  onUpdateQuestion,
  currentUserId, currentUserName, isAdmin,
  onTogglePublicAssessment, onTogglePublicQuestion,
  onRegenerateDiagram,
  onPractice,
  onExam,
  onShare,
  onNewAssessment,
  editPanel,
  importedQuestions = [],
  importedLoading = false,
  onLoadImported,
  onUpdateImported,
  weakTopicFilter,
}: Props) {
  const QUESTIONS_PER_PAGE = 20
  const ASSESSMENTS_PER_PAGE = 12
  const IMPORTED_PER_PAGE = 25
  const [bankView, setBankView] = useState<'assessments' | 'questions' | 'pastpapers'>('questions')
  const canEdit = (ownerId: string) => ownerId === currentUserId || !!isAdmin
  const [assessmentLayout, setAssessmentLayout] = useState<'list' | 'gallery'>('gallery')
  const [questionLayout, setQuestionLayout] = useState<'list' | 'gallery'>('gallery')
  const [importedLayout, setImportedLayout] = useState<'list' | 'gallery'>('gallery')
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameFolderValue, setRenameFolderValue] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)
  const [fixingOptionIds, setFixingOptionIds] = useState<Set<string>>(new Set())
  const [addToAssessmentId, setAddToAssessmentId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<DeleteTarget | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [subjectFilter, setSubjectFilter] = useState<string>(weakTopicFilter?.subject ?? '')
  const [questionSearch, setQuestionSearch] = useState('')
  const [questionTopicFilter, setQuestionTopicFilter] = useState<string>('')
  const [assessmentSearch, setAssessmentSearch] = useState(weakTopicFilter?.topic ?? '')

  // Apply weak topic filter when navigated from Progress Dashboard
  useEffect(() => {
    if (!weakTopicFilter) return
    setBankView('assessments')
    setAssessmentSearch(weakTopicFilter.topic)
    setSubjectFilter(weakTopicFilter.subject)
    setAssessmentPage(1)
  }, [weakTopicFilter])
  const [questionPage, setQuestionPage] = useState(1)
  const [assessmentPage, setAssessmentPage] = useState(1)
  // ── Past Papers state ───────────────────────────────────────────────────
  const [importedTopicFilter, setImportedTopicFilter] = useState<string>('')
  const [importedSearch, setImportedSearch] = useState('')
  const [importedPage, setImportedPage] = useState(1)
  const [importedSelectedIds, setImportedSelectedIds] = useState<Set<string>>(new Set())
  const [previewImported, setPreviewImported] = useState<ImportedQuestion | null>(null)
  const importedLoaded = importedQuestions.length > 0 || importedLoading
  const [showExamViewImport, setShowExamViewImport] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [newSubfolderParentId, setNewSubfolderParentId] = useState<string | null>(null)
  const [newSubfolderName, setNewSubfolderName] = useState('')
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [uncatAddingFolder, setUncatAddingFolder] = useState(false)
  const [uncatNewFolderName, setUncatNewFolderName] = useState('')
  const [viewAssessment, setViewAssessment] = useState<Assessment | null>(null)

  // Keep previewQuestion in sync when the question is updated externally (e.g. after diagram regenerate)
  // One-time migration: strip legacy [diagram:...] placeholders from existing ExamView questions
  useEffect(() => {
    const key = `examview_placeholder_cleaned_${currentUserId}`
    if (localStorage.getItem(key)) return
    cleanExamViewPlaceholders().then(n => {
      if (n > 0) console.log(`Cleaned diagram placeholders from ${n} ExamView questions`)
      localStorage.setItem(key, '1')
    }).catch(() => {})
  }, [currentUserId])

  useEffect(() => {
    if (!previewQuestion) return
    const updated = questions.find(q => q.id === previewQuestion.id)
    if (updated && updated !== previewQuestion) setPreviewQuestion(updated)
  }, [questions, previewQuestion])

  // Keep previewImported in sync after onUpdateImported patches the importedQuestions array
  useEffect(() => {
    if (!previewImported) return
    const updated = importedQuestions.find(q => q.uid === previewImported.uid)
    if (updated && updated !== previewImported) setPreviewImported(updated)
  }, [importedQuestions, previewImported])

  const subjectOptions = useMemo(() => {
    const set = new Set<string>()
    assessments.forEach(a => { if (a.subject) set.add(a.subject) })
    questions.forEach(q => { if (q.subject) set.add(q.subject) })
    return Array.from(set).sort()
  }, [assessments, questions])

  const { rootFolders, childrenByParent } = useMemo(() => {
    const root: typeof folders = []
    const children: Record<string, typeof folders> = {}
    folders.forEach(f => {
      if (!f.parentId) root.push(f)
      else { if (!children[f.parentId]) children[f.parentId] = []; children[f.parentId].push(f) }
    })
    return { rootFolders: root, childrenByParent: children }
  }, [folders])

  // Effective public status: a folder is effectively public if it or any ancestor is public.
  const effectivePublicByFolder = useMemo(() => {
    const folderById: Record<string, (typeof folders)[0]> = {}
    folders.forEach(f => { folderById[f.id] = f })
    const result: Record<string, boolean> = {}
    const compute = (f: (typeof folders)[0]): boolean => {
      if (f.id in result) return result[f.id]
      if (f.isPublic) { result[f.id] = true; return true }
      const parent = f.parentId ? folderById[f.parentId] : undefined
      result[f.id] = parent ? compute(parent) : false
      return result[f.id]
    }
    folders.forEach(f => compute(f))
    return result
  }, [folders])

  // Flat id→folder lookup (used for ribbon display)
  const folderById = useMemo(() => {
    const m: Record<string, (typeof folders)[0]> = {}
    folders.forEach(f => { m[f.id] = f })
    return m
  }, [folders])

  // Walk up to the root folder for a given folderId
  const getRootFolderName = useCallback((folderId: string): string | null => {
    let cur = folderById[folderId]
    if (!cur) return null
    while (cur.parentId && folderById[cur.parentId]) cur = folderById[cur.parentId]
    return cur.name
  }, [folderById])

  const itemCountByFolder = useMemo(() => {
    // Direct counts first
    const direct: Record<string, number> = {}
    questions.forEach(q => { if (q.folderId) direct[q.folderId] = (direct[q.folderId] ?? 0) + 1 })
    assessments.forEach(a => { if (a.folderId) direct[a.folderId] = (direct[a.folderId] ?? 0) + 1 })
    // Recursive totals (includes all descendants)
    const total: Record<string, number> = {}
    const sumDescendants = (id: string): number => {
      if (id in total) return total[id]
      const children = childrenByParent[id] ?? []
      total[id] = (direct[id] ?? 0) + children.reduce((s, c) => s + sumDescendants(c.id), 0)
      return total[id]
    }
    folders.forEach(f => sumDescendants(f.id))
    return total
  }, [questions, assessments, folders, childrenByParent])

  // Returns all folder ids that are the given folder or its descendants
  const getDescendantIds = useCallback((folderId: string): Set<string> => {
    const ids = new Set<string>([folderId])
    const queue = [folderId]
    while (queue.length) {
      const cur = queue.shift()!
      ;(childrenByParent[cur] ?? []).forEach(c => { ids.add(c.id); queue.push(c.id) })
    }
    return ids
  }, [childrenByParent])

  // Dominant subject for each root folder (based on items in all descendants)
  const folderSubjectMap = useMemo(() => {
    const map: Record<string, string> = {}
    rootFolders.forEach(rf => {
      const ids = getDescendantIds(rf.id)
      const tally: Record<string, number> = {}
      questions.forEach(q => { if (q.folderId && ids.has(q.folderId) && q.subject) tally[q.subject] = (tally[q.subject] ?? 0) + 1 })
      assessments.forEach(a => { if (a.folderId && ids.has(a.folderId) && a.subject) tally[a.subject] = (tally[a.subject] ?? 0) + 1 })
      const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
      if (top) map[rf.id] = top[0]
    })
    return map
  }, [rootFolders, questions, assessments, getDescendantIds])

  const visibleRootFolders = useMemo(() =>
    subjectFilter ? rootFolders.filter(f => folderSubjectMap[f.id] === subjectFilter) : rootFolders
  , [rootFolders, subjectFilter, folderSubjectMap])

  const flattenedFolderOptions = useMemo(() => {
    const result: { id: string; label: string }[] = []
    const visit = (f: (typeof folders)[0], depth: number) => {
      result.push({ id: f.id, label: '\u00a0'.repeat(depth * 4) + (depth > 0 ? '→ ' : '') + f.name })
      childrenByParent[f.id]?.forEach(child => visit(child, depth + 1))
    }
    rootFolders.forEach(f => visit(f, 0))
    return result
  }, [rootFolders, childrenByParent])

  const filteredAssessments = useMemo(() => {
    let as = assessments
    if (selectedFolderId === null) as = as.filter(a => !a.folderId)
    else if (selectedFolderId !== undefined) { const ids = getDescendantIds(selectedFolderId); as = as.filter(a => a.folderId && ids.has(a.folderId)) }
    if (subjectFilter) as = as.filter(a => a.subject === subjectFilter)
    if (assessmentSearch.trim()) {
      const s = assessmentSearch.trim().toLowerCase()
      as = as.filter(a =>
        (a.code && a.code.toLowerCase().includes(s)) ||
        a.topic.toLowerCase().includes(s)
      )
    }
    return as
  }, [assessments, subjectFilter, assessmentSearch, selectedFolderId, getDescendantIds])

  const questionTopics = useMemo(() => {
    const set = new Set<string>()
    questions.forEach(q => { if (q.topic) set.add(q.topic) })
    return [...set].sort()
  }, [questions])

  const filteredQuestions = useMemo(() => {
    let qs = questions
    if (selectedFolderId === null) qs = qs.filter(q => !q.folderId)
    else if (selectedFolderId !== undefined) { const ids = getDescendantIds(selectedFolderId); qs = qs.filter(q => q.folderId && ids.has(q.folderId)) }
    if (subjectFilter) qs = qs.filter(q => q.subject === subjectFilter)
    if (questionTopicFilter) qs = qs.filter(q => q.topic === questionTopicFilter)
    if (questionSearch.trim()) {
      const s = questionSearch.trim().toLowerCase()
      qs = qs.filter(q =>
        (q.code && q.code.toLowerCase().includes(s)) ||
        q.text.toLowerCase().includes(s)
      )
    }
    return qs
  }, [questions, subjectFilter, questionTopicFilter, questionSearch, selectedFolderId, getDescendantIds])

  // ── Imported questions derived state ─────────────────────────────────────
  const importedTopics = useMemo(() => {
    const set = new Set<string>()
    importedQuestions.forEach(q => { if (q.topic) set.add(q.topic) })
    return [...set].sort()
  }, [importedQuestions])

  const filteredImported = useMemo(() => {
    let qs = importedTopicFilter
      ? importedQuestions.filter(q => q.topic === importedTopicFilter)
      : importedQuestions
    if (importedSearch.trim()) {
      const s = importedSearch.trim().toLowerCase()
      qs = qs.filter(q =>
        q.rawCode.toLowerCase().includes(s) ||
        q.questionText.toLowerCase().includes(s) ||
        (q.topic && q.topic.toLowerCase().includes(s))
      )
    }
    return qs
  }, [importedQuestions, importedTopicFilter, importedSearch])

  const totalImportedPages = Math.max(1, Math.ceil(filteredImported.length / IMPORTED_PER_PAGE))
  const safeImportedPage = Math.min(importedPage, totalImportedPages)
  const importedStart = (safeImportedPage - 1) * IMPORTED_PER_PAGE
  const pagedImported = filteredImported.slice(importedStart, importedStart + IMPORTED_PER_PAGE)

  const totalAssessmentPages = Math.max(1, Math.ceil(filteredAssessments.length / ASSESSMENTS_PER_PAGE))
  const safeAssessmentPage = Math.min(assessmentPage, totalAssessmentPages)
  const assessmentStart = (safeAssessmentPage - 1) * ASSESSMENTS_PER_PAGE
  const pagedAssessments = filteredAssessments.slice(assessmentStart, assessmentStart + ASSESSMENTS_PER_PAGE)

  const totalQuestionPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE))
  const safeQuestionPage = Math.min(questionPage, totalQuestionPages)
  const questionStart = (safeQuestionPage - 1) * QUESTIONS_PER_PAGE
  const pagedQuestions = filteredQuestions.slice(questionStart, questionStart + QUESTIONS_PER_PAGE)

  useEffect(() => {
    if (questionPage > totalQuestionPages) setQuestionPage(totalQuestionPages)
  }, [questionPage, totalQuestionPages])

  useEffect(() => {
    if (assessmentPage > totalAssessmentPages) setAssessmentPage(totalAssessmentPages)
  }, [assessmentPage, totalAssessmentPages])

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    setIsDeleting(true)
    try {
      if (confirmDelete.type === 'assessment') await onDeleteAssessment(confirmDelete.id)
      else if (confirmDelete.type === 'question') await onDeleteQuestion(confirmDelete.id)
      else if (confirmDelete.type === 'folder') await onDeleteFolder(confirmDelete.id)
    } finally {
      setIsDeleting(false)
      setConfirmDelete(null)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedQuestions = questions.filter(q => selectedIds.has(q.id))

  const handleCreateFromSelected = () => {
    onCreateAssessmentFromQuestions(selectedQuestions)
    setSelectedIds(new Set())
  }

  const handleAddToAssessment = () => {
    if (!addToAssessmentId) return
    onAddQuestionsToAssessment(addToAssessmentId, selectedQuestions)
    setSelectedIds(new Set())
    setAddToAssessmentId('')
  }

  const handleFixOptions = async (q: Question) => {
    const updates = migrateExamViewOptions(q)
    if (!updates) return
    setFixingOptionIds(prev => new Set(prev).add(q.id))
    try {
      await onUpdateQuestion(q.id, updates as Partial<Question>)
    } finally {
      setFixingOptionIds(prev => { const s = new Set(prev); s.delete(q.id); return s })
    }
  }

  const renderFolderRow = (folder: (typeof folders)[0], depth: number, siblings: (typeof folders)[0][], rootSubject?: string): React.ReactNode => {
    const isSelected = selectedFolderId === folder.id
    const hasChildren = (childrenByParent[folder.id]?.length ?? 0) > 0
    const isExpanded = expandedFolders.has(folder.id)
    const count = itemCountByFolder[folder.id] ?? 0
    const isRenamingThis = renamingFolderId === folder.id
    const isAddingSubfolder = newSubfolderParentId === folder.id
    const isMovingThis = movingFolderId === folder.id
    const siblingIdx = siblings.findIndex(s => s.id === folder.id)
    const canMoveUp = siblingIdx > 0
    const canMoveDown = siblingIdx < siblings.length - 1
    const sc = rootSubject ? subjectColors(rootSubject) : null
    const reorder = (delta: -1 | 1) => {
      const newSiblings = [...siblings]
      const idx = siblingIdx
      ;[newSiblings[idx], newSiblings[idx + delta]] = [newSiblings[idx + delta], newSiblings[idx]]
      onReorderFolders(newSiblings.map(s => s.id))
    }
    const isOwnerFolder = canEdit(folder.userId)
    const isDirectlyPublic = !!folder.isPublic
    const isEffectivelyPublic = effectivePublicByFolder[folder.id] ?? false
    const isInheritedPublic = isEffectivelyPublic && !isDirectlyPublic

    return (
      <div key={folder.id}>
        <div className="flex items-center gap-0.5 group relative" style={{ paddingLeft: depth * 12 }}>
          <button
            onClick={() => setExpandedFolders(prev => { const n = new Set(prev); n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id); return n })}
            className={`shrink-0 w-4 h-4 flex items-center justify-center text-stone-400 ${hasChildren ? '' : 'invisible pointer-events-none'}`}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {isRenamingThis ? (
            <>
              <input value={renameFolderValue} onChange={e => setRenameFolderValue(e.target.value)}
                className="flex-1 text-xs px-1.5 py-1 border border-emerald-400 rounded min-w-0" autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && renameFolderValue.trim()) { onRenameFolder(folder.id, renameFolderValue.trim()); setRenamingFolderId(null) } if (e.key === 'Escape') setRenamingFolderId(null) }} />
              <button onClick={() => { if (renameFolderValue.trim()) { onRenameFolder(folder.id, renameFolderValue.trim()); setRenamingFolderId(null) } }} className="text-emerald-600 shrink-0"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setRenamingFolderId(null)} className="text-stone-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <>
              <button onClick={() => onSelectFolder(folder.id)}
                className={`flex-1 text-left text-xs px-1.5 py-1.5 rounded flex items-center gap-1 min-w-0 transition-colors ${isSelected ? 'font-medium' : 'text-stone-700'} ${isEffectivelyPublic ? 'pr-[72px]' : 'pr-16'}`}
                style={sc ? {
                  backgroundColor: isSelected ? sc.rawSelectedBg : undefined,
                  borderLeft: `3px solid ${sc.rawAccent}`,
                  paddingLeft: '6px',
                } : isSelected ? { backgroundColor: '#d1fae5' } : undefined}
                onMouseEnter={e => { if (!isSelected && sc) (e.currentTarget as HTMLButtonElement).style.backgroundColor = sc.rawBg }}
                onMouseLeave={e => { if (!isSelected && sc) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '' }}
              >
                <FolderIcon className="w-3.5 h-3.5 shrink-0" style={sc ? { color: sc.rawAccent } : undefined} />
                <span className="truncate">{folder.name}</span>
                {isEffectivelyPublic && (
                  <span title={isDirectlyPublic ? 'Public' : 'Public (inherited from parent)'} className="shrink-0 ml-1 flex items-center">
                    <Globe className={`w-3 h-3 ${isDirectlyPublic ? 'text-emerald-500' : 'text-sky-400'}`} />
                  </span>
                )}
                <span className={`text-[10px] shrink-0 ml-auto ${count > 0 ? 'text-stone-400' : 'text-stone-300'}`}>({count})</span>
              </button>
              <div className="absolute right-0 flex items-center gap-0 opacity-0 group-hover:opacity-100 bg-white/90 rounded pl-0.5">
                {canMoveUp && <button onClick={() => reorder(-1)}
                  className="p-0.5 text-stone-400 hover:text-stone-600" title="Move up">
                  <ArrowUp className="w-3 h-3" />
                </button>}
                {canMoveDown && <button onClick={() => reorder(1)}
                  className="p-0.5 text-stone-400 hover:text-stone-600" title="Move down">
                  <ArrowDown className="w-3 h-3" />
                </button>}
                {isOwnerFolder && (
                  <button
                    onClick={() => onTogglePublicFolder(folder.id, !folder.isPublic)}
                    className={`p-0.5 rounded ${isDirectlyPublic ? 'text-emerald-600 hover:text-emerald-700' : isInheritedPublic ? 'text-sky-400 hover:text-emerald-600' : 'text-stone-300 hover:text-stone-500'}`}
                    title={isDirectlyPublic ? 'Public — click to make private' : isInheritedPublic ? 'Public via parent — click to also make directly public' : 'Private — click to make public'}
                  >
                    <Globe className="w-3 h-3" />
                  </button>
                )}
                {isOwnerFolder && <button onClick={() => { setNewSubfolderParentId(folder.id); setNewSubfolderName('') }}
                  className="p-0.5 text-stone-400 hover:text-emerald-600" title="Add subfolder">
                  <FolderPlus className="w-3 h-3" />
                </button>}
                {isOwnerFolder && <button onClick={() => setMovingFolderId(isMovingThis ? null : folder.id)}
                  className="p-0.5 text-stone-400 hover:text-violet-600" title="Move to…">
                  <FilePlus className="w-3 h-3" />
                </button>}
                {isOwnerFolder && <button onClick={() => { setRenamingFolderId(folder.id); setRenameFolderValue(folder.name) }}
                  className="p-0.5 text-stone-400 hover:text-stone-600">
                  <Pencil className="w-3 h-3" />
                </button>}
                {isOwnerFolder && <button onClick={() => setConfirmDelete({ type: 'folder', id: folder.id, label: folder.name })}
                  className="p-0.5 text-red-400 hover:text-red-600">
                  <Trash2 className="w-3 h-3" />
                </button>}
              </div>
            </>
          )}
        </div>
        {isMovingThis && (
          <div className="flex gap-1 mt-1 pr-1" style={{ paddingLeft: depth * 12 + 20 }}>
            <select
              className="flex-1 text-xs border border-stone-300 rounded px-2 py-1"
              defaultValue={folder.parentId ?? ''}
              onChange={e => { onMoveFolder(folder.id, e.target.value || null); setMovingFolderId(null) }}
            >
              <option value="">— Root (no parent) —</option>
              {flattenedFolderOptions.filter(opt => opt.id !== folder.id).map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <button onClick={() => setMovingFolderId(null)} className="p-1 text-stone-400 hover:bg-stone-100 rounded"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {isAddingSubfolder && (
          <div className="flex gap-1 mt-1 pr-1" style={{ paddingLeft: (depth + 1) * 12 + 16 }}>
            <input value={newSubfolderName} onChange={e => setNewSubfolderName(e.target.value)}
              placeholder="Subfolder name..." className="flex-1 text-xs px-2 py-1 border border-stone-300 rounded" autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && newSubfolderName.trim()) { onCreateFolder(newSubfolderName.trim(), folder.id); setNewSubfolderParentId(null); setNewSubfolderName('') } if (e.key === 'Escape') setNewSubfolderParentId(null) }} />
            <button onClick={() => { if (newSubfolderName.trim()) { onCreateFolder(newSubfolderName.trim(), folder.id); setNewSubfolderParentId(null); setNewSubfolderName('') } }}
              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Plus className="w-3.5 h-3.5" /></button>
            <button onClick={() => setNewSubfolderParentId(null)} className="p-1 text-stone-400 hover:bg-stone-100 rounded"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {isExpanded && (() => { const ch = childrenByParent[folder.id] ?? []; return ch.map(child => renderFolderRow(child, depth + 1, ch, rootSubject)) })()}
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Folder Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-8'} shrink-0 border-r border-stone-200 flex flex-col transition-all duration-200`}>
        {/* Sidebar header — always visible */}
        <div className="flex items-center gap-1 px-2 pt-2 pb-1">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="p-1 text-stone-400 hover:text-stone-600 rounded hover:bg-stone-100 shrink-0"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? <ChevronDown className="w-3.5 h-3.5 -rotate-90" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {sidebarOpen && (
            <>
              <input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="New folder..."
                className="flex-1 text-xs px-2 py-1 border border-stone-300 rounded min-w-0"
                onKeyDown={e => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    onCreateFolder(newFolderName.trim())
                    setNewFolderName('')
                  }
                }}
              />
              <button
                onClick={() => { if (newFolderName.trim()) { onCreateFolder(newFolderName.trim()); setNewFolderName('') } }}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        {sidebarOpen && (
          <div className="flex flex-col gap-0.5 px-2 pb-2 overflow-y-auto flex-1">
            <button
              onClick={() => onSelectFolder(undefined)}
              className={`text-left text-xs px-2 py-1.5 rounded flex items-center gap-1 ${selectedFolderId === undefined ? 'bg-emerald-100 text-emerald-800 font-medium' : 'hover:bg-stone-100 text-stone-600'}`}
            >
              <LibraryIcon className="w-3.5 h-3.5" /> All
            </button>
            {/* Uncategorized virtual folder — full edit actions */}
            <div className="flex items-center gap-0.5 group relative">
              <span className="shrink-0 w-4 h-4 invisible" />
              <button
                onClick={() => onSelectFolder(null)}
                className={`flex-1 text-left text-xs px-1.5 py-1.5 rounded flex items-center gap-1 min-w-0 pr-16 transition-colors ${selectedFolderId === null ? 'bg-stone-200 text-stone-800 font-medium' : 'hover:bg-stone-100 text-stone-500'}`}
              >
                <FolderIcon className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span className="truncate italic">Uncategorized</span>
                <span className="text-[10px] shrink-0 ml-auto text-stone-300">
                  ({(questions.filter(q => !q.folderId).length + assessments.filter(a => !a.folderId).length)})
                </span>
              </button>
              <div className="absolute right-0 flex items-center gap-0 opacity-0 group-hover:opacity-100 bg-white/90 rounded pl-0.5">
                <button
                  onClick={() => { setUncatAddingFolder(true); setUncatNewFolderName('') }}
                  className="p-0.5 text-stone-400 hover:text-emerald-600" title="New folder here"
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
              </div>
            </div>
            {uncatAddingFolder && (
              <div className="flex gap-1 mt-0.5 pr-1 pl-5">
                <input
                  value={uncatNewFolderName}
                  onChange={e => setUncatNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  className="flex-1 text-xs px-2 py-1 border border-stone-300 rounded"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && uncatNewFolderName.trim()) {
                      onCreateFolder(uncatNewFolderName.trim())
                      setUncatAddingFolder(false)
                      setUncatNewFolderName('')
                    }
                    if (e.key === 'Escape') setUncatAddingFolder(false)
                  }}
                />
                <button
                  onClick={() => { if (uncatNewFolderName.trim()) { onCreateFolder(uncatNewFolderName.trim()); setUncatAddingFolder(false); setUncatNewFolderName('') } }}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                ><Plus className="w-3.5 h-3.5" /></button>
                <button onClick={() => setUncatAddingFolder(false)} className="p-1 text-stone-400 hover:bg-stone-100 rounded"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {visibleRootFolders.map(f => renderFolderRow(f, 0, visibleRootFolders, folderSubjectMap[f.id]))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {editPanel ? editPanel : (<>
        {/* Tab switcher + subject filter */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 flex-wrap">
          <button
            onClick={() => { setBankView('questions'); setSelectedIds(new Set()); setQuestionPage(1); setAssessmentPage(1) }}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${bankView === 'questions' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Questions ({filteredQuestions.length})
          </button>
          <button
            onClick={() => {
              setBankView('pastpapers')
              setSelectedIds(new Set())
              setImportedSelectedIds(new Set())
              if (!importedLoaded) onLoadImported?.()
            }}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${bankView === 'pastpapers' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Past Papers {importedQuestions.length > 0 ? `(${filteredImported.length})` : ''}
          </button>
          <button
            onClick={() => { setBankView('assessments'); setSelectedIds(new Set()); setQuestionPage(1); setAssessmentPage(1) }}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${bankView === 'assessments' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Assessments ({filteredAssessments.length})
          </button>
          {bankView === 'assessments' && (
            <>
              <input
                type="text"
                value={assessmentSearch}
                onChange={e => { setAssessmentSearch(e.target.value); setAssessmentPage(1) }}
                placeholder="Search by code or topic…"
                className="text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-white text-stone-700 placeholder-stone-400 w-52 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <div className="flex rounded-lg border border-stone-200 overflow-hidden shrink-0">
                <button
                  onClick={() => setAssessmentLayout('list')}
                  className={`p-1.5 transition-colors ${assessmentLayout === 'list' ? 'bg-emerald-600 text-white' : 'bg-white text-stone-400 hover:bg-stone-50'}`}
                  title="List view"
                ><List className="w-3.5 h-3.5" /></button>
                <button
                  onClick={() => setAssessmentLayout('gallery')}
                  className={`p-1.5 border-l border-stone-200 transition-colors ${assessmentLayout === 'gallery' ? 'bg-emerald-600 text-white' : 'bg-white text-stone-400 hover:bg-stone-50'}`}
                  title="Gallery view"
                ><LayoutGrid className="w-3.5 h-3.5" /></button>
              </div>
              <select
                value={subjectFilter}
                onChange={e => { setSubjectFilter(e.target.value); setQuestionPage(1); setAssessmentPage(1) }}
                className="text-xs border border-stone-300 rounded-lg px-2 py-1.5 bg-white text-stone-600"
              >
                <option value="">All subjects</option>
                {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {onNewAssessment && (
                <button
                  onClick={onNewAssessment}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
                  title="Create blank assessment"
                >
                  <FilePlus className="w-3.5 h-3.5" /> New Assessment
                </button>
              )}
            </>
          )}
          {bankView === 'questions' && (
            <>
              <select
                value={questionTopicFilter}
                onChange={e => { setQuestionTopicFilter(e.target.value); setQuestionPage(1) }}
                className="text-xs border border-stone-300 rounded-lg px-2 py-1.5 bg-white text-stone-600 max-w-[180px]"
              >
                <option value="">All topics</option>
                {questionTopics.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                type="text"
                value={questionSearch}
                onChange={e => { setQuestionSearch(e.target.value); setQuestionPage(1) }}
                placeholder="Search by code or text…"
                className="text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-white text-stone-700 placeholder-stone-400 w-44 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <div className="flex rounded-lg border border-stone-200 overflow-hidden shrink-0">
                <button
                  onClick={() => setQuestionLayout('list')}
                  className={`p-1.5 transition-colors ${questionLayout === 'list' ? 'bg-emerald-600 text-white' : 'bg-white text-stone-400 hover:bg-stone-50'}`}
                  title="List view"
                ><List className="w-3.5 h-3.5" /></button>
                <button
                  onClick={() => setQuestionLayout('gallery')}
                  className={`p-1.5 border-l border-stone-200 transition-colors ${questionLayout === 'gallery' ? 'bg-emerald-600 text-white' : 'bg-white text-stone-400 hover:bg-stone-50'}`}
                  title="Gallery view"
                ><LayoutGrid className="w-3.5 h-3.5" /></button>
              </div>
            </>
          )}
          {bankView === 'pastpapers' && (
            <>
              <select
                value={importedTopicFilter}
                onChange={e => { setImportedTopicFilter(e.target.value); setImportedPage(1) }}
                className="text-xs border border-amber-300 rounded-lg px-2 py-1.5 bg-white text-stone-600 max-w-[200px]"
              >
                <option value="">All topics</option>
                {importedTopics.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                type="text"
                value={importedSearch}
                onChange={e => { setImportedSearch(e.target.value); setImportedPage(1) }}
                placeholder="Search code or text…"
                className="text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-white text-stone-700 placeholder-stone-400 w-44 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <div className="flex rounded-lg border border-stone-200 overflow-hidden shrink-0">
                <button
                  onClick={() => setImportedLayout('list')}
                  className={`p-1.5 transition-colors ${importedLayout === 'list' ? 'bg-amber-600 text-white' : 'bg-white text-stone-400 hover:bg-stone-50'}`}
                  title="List view"
                ><List className="w-3.5 h-3.5" /></button>
                <button
                  onClick={() => setImportedLayout('gallery')}
                  className={`p-1.5 border-l border-stone-200 transition-colors ${importedLayout === 'gallery' ? 'bg-amber-600 text-white' : 'bg-white text-stone-400 hover:bg-stone-50'}`}
                  title="Gallery view"
                ><LayoutGrid className="w-3.5 h-3.5" /></button>
              </div>
            </>
          )}
          {bankView !== 'assessments' && (
            <select
              value={subjectFilter}
              onChange={e => { setSubjectFilter(e.target.value); setQuestionPage(1); setAssessmentPage(1) }}
              className={`${bankView === 'questions' ? '' : 'ml-auto'} text-xs border border-stone-300 rounded-lg px-2 py-1.5 bg-white text-stone-600`}
            >
              <option value="">All subjects</option>
              {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {bankView === 'questions' && (
            <button
              onClick={() => setShowExamViewImport(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 shrink-0"
              title="Import questions from ExamView"
            >
              <Upload className="w-3.5 h-3.5" /> Import ExamView
            </button>
          )}
        </div>

        {/* Past papers selection action bar */}
        {bankView === 'pastpapers' && importedSelectedIds.size > 0 && (
          <div className="mx-4 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-amber-800">{importedSelectedIds.size} selected</span>
            <button
              onClick={() => {
                const selected = importedQuestions.filter(q => importedSelectedIds.has(q.uid))
                onCreateAssessmentFromQuestions(selected.map(importedToQuestionItem))
                setImportedSelectedIds(new Set())
              }}
              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700"
            >
              <FilePlus className="w-3.5 h-3.5" /> New Assessment
            </button>
            <div className="flex items-center gap-1">
              <select
                value={addToAssessmentId}
                onChange={e => setAddToAssessmentId(e.target.value)}
                className="text-xs border border-amber-300 rounded px-2 py-1 bg-white text-stone-700"
              >
                <option value="">Add to assessment...</option>
                {assessments.map(a => (
                  <option key={a.id} value={a.id}>{a.subject} — {a.topic}</option>
                ))}
              </select>
              {addToAssessmentId && (
                <button
                  onClick={() => {
                    const selected = importedQuestions.filter(q => importedSelectedIds.has(q.uid))
                    onAddQuestionsToAssessment(addToAssessmentId, selected.map(importedToQuestionItem))
                    setImportedSelectedIds(new Set())
                    setAddToAssessmentId('')
                  }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 bg-stone-700 text-white rounded-lg font-medium hover:bg-stone-800"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>
            <button
              onClick={() => setImportedSelectedIds(new Set())}
              className="ml-auto text-xs text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Selection action bar */}
        {bankView === 'questions' && selectedIds.size > 0 && (
          <div className="mx-4 mb-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-emerald-800">{selectedIds.size} selected</span>
            <button
              onClick={handleCreateFromSelected}
              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
            >
              <FilePlus className="w-3.5 h-3.5" /> New Assessment
            </button>
            <div className="flex items-center gap-1">
              <select
                value={addToAssessmentId}
                onChange={e => setAddToAssessmentId(e.target.value)}
                className="text-xs border border-emerald-300 rounded px-2 py-1 bg-white text-stone-700"
              >
                <option value="">Add to assessment...</option>
                {assessments.map(a => (
                  <option key={a.id} value={a.id}>{a.subject} — {a.topic}</option>
                ))}
              </select>
              {addToAssessmentId && (
                <button
                  onClick={handleAddToAssessment}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 bg-stone-700 text-white rounded-lg font-medium hover:bg-stone-800"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading && <div className="text-stone-400 text-sm">Loading...</div>}

          {bankView === 'assessments' && (
            <div className={assessmentLayout === 'gallery' ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'grid grid-cols-1 gap-3'}>
              {pagedAssessments.map(a => {
                const isGlobal = !canEdit(a.userId) && a.isPublic
                const sc = subjectColors(a.subject)
                if (assessmentLayout === 'gallery') {
                  return (
                    <div key={a.id} className={`border rounded-xl overflow-hidden hover:shadow-md transition-all ${isGlobal ? 'border-sky-300' : sc.border}`}
                    >
                      <div className={`h-2 w-full ${isGlobal ? 'bg-sky-400' : sc.accentBar}`} />
                      <div className={`p-3 ${isGlobal ? 'bg-sky-50' : sc.bg}`}>
                        {renamingId === a.id ? (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                              className="flex-1 text-sm px-1 border border-emerald-400 rounded" autoFocus />
                            <button onClick={() => { onRenameAssessment(a.id, renameValue); setRenamingId(null) }} className="text-emerald-600"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setRenamingId(null)} className="text-stone-400"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <div className="flex flex-wrap gap-1 items-center">
                                {a.subject && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sc.badge} ${sc.badgeText}`}>{a.subject}</span>
                                )}
                                {a.code && (
                                  <span className={`font-mono text-[10px] border px-1.5 py-0.5 rounded ${sc.codeBg} ${sc.codeText} ${sc.codeBorder}`}>{a.code}</span>
                                )}
                              </div>
                              {canEdit(a.userId) && (
                                <button onClick={e => { e.stopPropagation(); onTogglePublicAssessment(a.id, !a.isPublic) }}
                                  className={`p-0.5 rounded ${a.isPublic ? 'text-emerald-600' : 'text-stone-300'}`}>
                                  <Globe className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="text-sm font-semibold text-stone-800 line-clamp-2 leading-tight">{a.topic}</div>
                            <div className="text-[11px] text-stone-500 mt-1">{a.difficulty} · {a.questions.length}q</div>
                            {isGlobal && a.preparedBy && <div className="text-[10px] text-emerald-600 mt-0.5">by {a.preparedBy}</div>}
                            <div className="flex items-center justify-between mt-2" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <button onClick={() => setViewAssessment(a)} className="p-1 text-stone-400 hover:text-blue-600" title="View questions"><Eye className="w-3 h-3" /></button>
                                <button onClick={() => onSelect(a)} className="p-1 text-stone-400 hover:text-emerald-600" title="Open in editor"><Pencil className="w-3 h-3" /></button>
                                {canEdit(a.userId) && (
                                  <button onClick={() => setConfirmDelete({ type: 'assessment', id: a.id, label: a.topic + (a.code ? ` (${a.code})` : '') })} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-auto">
                                <button
                                  onClick={() => onPractice?.(a)}
                                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded border border-violet-200"
                                  title="Practice this assessment"
                                >
                                  ▶ Practice
                                </button>
                                <button
                                  onClick={() => onExam?.(a)}
                                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                                  title="Timed exam mode"
                                >
                                  ⏱ Exam
                                </button>
                                <button
                                  onClick={() => onShare?.(a)}
                                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
                                  title="Share with class"
                                >
                                  ↗ Share
                                </button>
                              </div>
                              <span className="text-[10px] text-stone-400">
                                {a.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                }
                return (
                <div key={a.id} className={`border rounded-lg overflow-hidden hover:shadow-sm transition-all ${isGlobal ? 'bg-sky-50 border-sky-200 hover:border-sky-400' : `${sc.bg} ${sc.border} ${sc.hoverBorder} ${sc.hoverBg}`}`}>
                  <div className={`h-1 w-full ${isGlobal ? 'bg-sky-400' : sc.accentBar}`} />
                  <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {renamingId === a.id ? (
                        <div className="flex gap-1">
                          <input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            className="flex-1 text-sm px-1 border border-emerald-400 rounded"
                            autoFocus
                          />
                          <button onClick={() => { onRenameAssessment(a.id, renameValue); setRenamingId(null) }} className="text-emerald-600"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setRenamingId(null)} className="text-stone-400"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="text-left w-full">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {a.subject && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sc.badge} ${sc.badgeText}`}>{a.subject}</span>
                            )}
                            {a.code && (
                              <span className={`font-mono text-[10px] border px-1.5 py-0.5 rounded ${sc.codeBg} ${sc.codeText} ${sc.codeBorder}`}>{a.code}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-stone-800">{a.topic}</span>
                            {canEdit(a.userId) && (
                              <button
                                onClick={e => { e.stopPropagation(); onTogglePublicAssessment(a.id, !a.isPublic) }}
                                className={`p-1 rounded ${a.isPublic ? 'text-emerald-600 hover:text-emerald-700' : 'text-stone-300 hover:text-stone-500'}`}
                                title={a.isPublic ? 'Public — click to make private' : 'Make public'}
                              >
                                <Globe className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap">
                            <span>{a.difficulty} · {a.questions.length}q</span>
                            {!canEdit(a.userId) && a.isPublic && a.preparedBy && (
                              <span className="text-xs text-emerald-600">by {a.preparedBy}</span>
                            )}
                            <span className="flex items-center gap-1 text-stone-400">
                              <Calendar className="w-3 h-3" />
                              {a.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' · '}
                              {a.createdAt.toDate().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setViewAssessment(a)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                        title="View questions"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                      <button
                        onClick={() => onSelect(a)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-stone-600 bg-stone-50 hover:bg-stone-100 rounded border border-stone-200"
                        title="Open in editor"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      {canEdit(a.userId) && (
                        <>
                          <button onClick={() => { setRenamingId(a.id); setRenameValue(a.topic) }} className="p-1 text-stone-400 hover:text-stone-600" title="Rename"><Pencil className="w-3.5 h-3.5" /></button>
                          <select
                            value={a.folderId ?? ''}
                            onChange={e => onMoveAssessment(a.id, e.target.value || null)}
                            className="text-xs border border-stone-200 rounded px-1 py-0.5 text-stone-600"
                          >
                            <option value="">No folder</option>
                            {flattenedFolderOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                          <button onClick={() => setConfirmDelete({ type: 'assessment', id: a.id, label: a.topic + (a.code ? ` (${a.code})` : '') })} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      <button
                        onClick={() => onPractice?.(a)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded border border-violet-200"
                        title="Practice this assessment"
                      >
                        ▶ Practice
                      </button>
                      <button
                        onClick={() => onExam?.(a)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                        title="Timed exam mode"
                      >
                        ⏱ Exam
                      </button>
                      <button
                        onClick={() => onShare?.(a)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
                        title="Share with class"
                      >
                        ↗ Share
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              )})}
              {filteredAssessments.length === 0 && !loading && (
                <div className="text-stone-400 text-sm text-center py-8">
                  {assessmentSearch.trim() ? `No assessments matching "${assessmentSearch.trim()}".` : subjectFilter ? `No ${subjectFilter} assessments found.` : 'No assessments saved yet.'}
                </div>
              )}
              {filteredAssessments.length > 0 && totalAssessmentPages > 1 && (
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="text-xs text-stone-500">
                    Page {safeAssessmentPage} / {totalAssessmentPages}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setAssessmentPage(p => Math.max(1, p - 1))}
                      disabled={safeAssessmentPage === 1}
                      className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setAssessmentPage(p => Math.min(totalAssessmentPages, p + 1))}
                      disabled={safeAssessmentPage === totalAssessmentPages}
                      className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {bankView === 'questions' && (
            <div className={questionLayout === 'gallery' ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'grid grid-cols-1 gap-2'}>
              {pagedQuestions.map(q => {
                const isSelected = selectedIds.has(q.id)
                const isGlobal = !canEdit(q.userId) && q.isPublic
                const sc = subjectColors(q.subject)
                const displayCode = q.code || autoCode(q)
                const isAiGenerated = !(q as any).source
                const rootFolderName = q.folderId ? getRootFolderName(q.folderId) : null
                const previewText = q.text.replace(/```svg[\s\S]*?```/g, '[diagram]').replace(/\*\*/g, '')

                if (questionLayout === 'gallery') {
                  return (
                    <div
                      key={q.id}
                      className={`border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all group
                        ${isSelected
                          ? 'border-emerald-400 shadow-sm'
                          : isGlobal
                            ? 'border-sky-300'
                            : sc.border
                        }`}
                      onClick={() => toggleSelect(q.id)}
                    >
                      <div className={`h-2 w-full ${isSelected ? 'bg-emerald-400' : isGlobal ? 'bg-sky-400' : sc.accentBar}`} />
                      <div className={`p-3 ${isSelected ? 'bg-emerald-50' : isGlobal ? 'bg-sky-50' : sc.bg}`}>
                        {/* Selection indicator + badges */}
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <div className="flex flex-wrap gap-1 items-center">
                            <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                              ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300 group-hover:border-emerald-400'}`}>
                              {isSelected && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                            </div>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sc.badge} ${sc.badgeText}`}>{q.subject}</span>
                            <span className={`font-mono text-[10px] border px-1.5 py-0.5 rounded ${sc.codeBg} ${sc.codeText} ${sc.codeBorder}`}>{displayCode}</span>
                            {isAiGenerated && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm">✦ AI</span>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setPreviewQuestion(q)} className="p-1 text-stone-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Preview">
                              <Eye className="w-3 h-3" />
                            </button>
                            {canEdit(q.userId) && (
                              <button onClick={e => { e.stopPropagation(); onTogglePublicQuestion(q.id, !q.isPublic) }}
                                className={`p-0.5 rounded ${q.isPublic ? 'text-emerald-600' : 'text-stone-300'}`}>
                                <Globe className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-stone-700 line-clamp-3 leading-tight mb-1.5">
                          {previewText.substring(0, 150)}{previewText.length > 150 ? '…' : ''}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            q.type === 'mcq' ? 'bg-blue-100 text-blue-700' :
                            q.type === 'structured' ? 'bg-violet-100 text-violet-700' :
                            'bg-stone-100 text-stone-500'
                          }`}>{q.type === 'mcq' ? 'MCQ' : q.type === 'structured' ? 'Struct.' : 'Short'}</span>
                          <span className="text-[10px] text-stone-400">{q.marks}m</span>
                          {q.difficultyStars && (
                            <span className={`text-[10px] font-medium ${
                              q.difficultyStars === 1 ? 'text-emerald-500' :
                              q.difficultyStars === 2 ? 'text-amber-500' : 'text-red-500'
                            }`}>{'★'.repeat(q.difficultyStars)}</span>
                          )}
                          {q.topic && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-stone-100 text-stone-500 truncate max-w-[100px]" title={q.topic}>{q.topic}</span>
                          )}
                        </div>
                        {canEdit(q.userId) && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-stone-100" onClick={e => e.stopPropagation()}>
                            <select
                              value={q.folderId ?? ''}
                              onChange={e => onMoveQuestion(q.id, e.target.value || null)}
                              className="text-[10px] border border-stone-200 rounded px-1 py-0.5 text-stone-600 flex-1 min-w-0"
                            >
                              <option value="">No folder</option>
                              {flattenedFolderOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                            </select>
                            <button onClick={() => setConfirmDelete({ type: 'question', id: q.id, label: q.code ?? q.text.substring(0, 40) })} className="p-1 text-red-400 hover:text-red-600">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={q.id}
                    className={`border rounded-lg p-2.5 flex gap-2 items-start cursor-pointer transition-all group
                      ${isSelected
                        ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                        : isGlobal
                          ? 'border-sky-200 bg-sky-50 hover:border-sky-400 hover:shadow-sm'
                          : `${sc.border} ${sc.bg} ${sc.hoverBorder} ${sc.hoverBg} hover:shadow-sm`
                      }`}
                    onClick={() => toggleSelect(q.id)}
                  >
                    {/* Checkbox */}
                    <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                      ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300 group-hover:border-emerald-400'}`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <div className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border ${sc.codeBg} ${sc.codeText} ${sc.codeBorder}`}>
                          {displayCode}
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sc.badge} ${sc.badgeText}`}>{q.subject}</span>
                        {isAiGenerated && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm" title="AI-generated question">
                            ✦ AI-Gen
                          </span>
                        )}
                        {!isAiGenerated && rootFolderName && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-200 text-stone-600 border border-stone-300" title={`In folder: ${rootFolderName}`}>
                            📁 {rootFolderName}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-700 truncate">
                        {previewText.substring(0, 120)}...
                      </div>
                      <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-1 flex-wrap">
                        <span>{q.marks}m · {q.commandWord}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          q.type === 'mcq' ? 'bg-blue-100 text-blue-700' :
                          q.type === 'structured' ? 'bg-violet-100 text-violet-700' :
                          'bg-stone-100 text-stone-500'
                        }`}>{q.type === 'mcq' ? 'MCQ' : q.type === 'structured' ? 'Structured' : 'Short Answer'}</span>
                        {q.difficultyStars && (
                          <span className={`font-medium tracking-tight ${
                            q.difficultyStars === 1 ? 'text-emerald-500' :
                            q.difficultyStars === 2 ? 'text-amber-500' :
                            'text-red-500'
                          }`} title={q.difficultyStars === 1 ? 'Easy' : q.difficultyStars === 2 ? 'Medium' : 'Challenging'}>
                            {'★'.repeat(q.difficultyStars)}{'☆'.repeat(3 - q.difficultyStars)}
                          </span>
                        )}
                        {q.topic && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 truncate max-w-[160px]" title={q.topic}>{q.topic}</span>
                        )}
                        {!canEdit(q.userId) && q.isPublic && q.preparedBy && (
                          <span className="ml-1 text-emerald-600">by {q.preparedBy}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setPreviewQuestion(q)}
                        className="p-1 text-stone-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {q.source === 'examview' && q.type === 'mcq' && canEdit(q.userId) && (
                        <button
                          onClick={e => { e.stopPropagation(); void handleFixOptions(q) }}
                          disabled={fixingOptionIds.has(q.id)}
                          className="p-1 text-stone-400 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                          title="Fix option layout (migrate from embedded text to separate options)"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${fixingOptionIds.has(q.id) ? 'animate-spin text-amber-500' : ''}`} />
                        </button>
                      )}
                      {canEdit(q.userId) && (
                        <button
                          onClick={e => { e.stopPropagation(); onTogglePublicQuestion(q.id, !q.isPublic) }}
                          className={`p-1 rounded ${q.isPublic ? 'text-emerald-600 hover:text-emerald-700' : 'text-stone-300 hover:text-stone-500'}`}
                          title={q.isPublic ? 'Public' : 'Make public'}
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canEdit(q.userId) && (
                        <>
                          <select
                            value={q.folderId ?? ''}
                            onChange={e => onMoveQuestion(q.id, e.target.value || null)}
                            className="text-xs border border-stone-200 rounded px-1 py-0.5 text-stone-600"
                          >
                            <option value="">No folder</option>
                            {flattenedFolderOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                          <button onClick={() => setConfirmDelete({ type: 'question', id: q.id, label: q.code ?? q.text.substring(0, 40) })} className="p-1 text-red-400 hover:text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              {filteredQuestions.length === 0 && !loading && (
                <div className="text-stone-400 text-sm text-center py-8">
                  {questionSearch.trim() ? `No questions matching "${questionSearch.trim()}".` : subjectFilter ? `No ${subjectFilter} questions found.` : 'No questions saved yet.'}
                </div>
              )}
              {filteredQuestions.length > 0 && totalQuestionPages > 1 && (
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="text-xs text-stone-500">
                    Page {safeQuestionPage} / {totalQuestionPages}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setQuestionPage(p => Math.max(1, p - 1))}
                      disabled={safeQuestionPage === 1}
                      className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setQuestionPage(p => Math.min(totalQuestionPages, p + 1))}
                      disabled={safeQuestionPage === totalQuestionPages}
                      className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ── Past Papers tab ─────────────────────────────────────────────── */}
          {bankView === 'pastpapers' && (
            <div className={importedLayout === 'gallery' ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'grid grid-cols-1 gap-2'}>
              {importedLoading && (
                <div className="col-span-full flex items-center gap-2 text-stone-400 text-sm py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading past paper questions…
                </div>
              )}
              {!importedLoading && !importedLoaded && (
                <div className="col-span-full text-stone-400 text-sm text-center py-8">
                  <button
                    onClick={() => onLoadImported?.()}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
                  >
                    Load Past Paper Questions
                  </button>
                </div>
              )}
              {pagedImported.map(q => {
                const isSelected = importedSelectedIds.has(q.uid)
                const sc = subjectColors(q.subject)
                const toggleSelected = () => setImportedSelectedIds(prev => {
                  const next = new Set(prev)
                  next.has(q.uid) ? next.delete(q.uid) : next.add(q.uid)
                  return next
                })

                if (importedLayout === 'gallery') {
                  return (
                    <div
                      key={q.uid}
                      className={`border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all group
                        ${isSelected ? `${sc.border} shadow-sm` : `border-stone-200 ${sc.hoverBorder} hover:shadow-sm`}`}
                      onClick={toggleSelected}
                    >
                      <div className={`h-2 w-full ${isSelected ? sc.accentBar : 'bg-stone-200 group-hover:' + sc.accentBar}`} />
                      <div className={`p-3 ${isSelected ? sc.bg : 'bg-white'}`}>
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <div className="flex flex-wrap gap-1 items-center">
                            <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                              ${isSelected ? `${sc.accentBar} border-transparent` : 'border-stone-300'}`}>
                              {isSelected && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                            </div>
                            {q.subject && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sc.badge} ${sc.badgeText}`}>{q.subject}</span>}
                            <span className={`font-mono text-[10px] border px-1.5 py-0.5 rounded ${sc.codeBg} ${sc.codeText} ${sc.codeBorder}`}>{q.rawCode}</span>
                            {q.hasImage && <span className="text-[10px] text-stone-400">📷</span>}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setPreviewImported(q) }}
                            className="p-1 text-stone-400 hover:text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Preview"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-xs text-stone-700 line-clamp-3 leading-tight mb-1.5">
                          {q.questionText.substring(0, 150)}{q.questionText.length > 150 ? '…' : ''}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">MCQ</span>
                          <span className="text-[10px] text-stone-400 truncate">{q.topic}</span>
                          <span className="text-[10px] text-stone-300">P{q.paper || '?'} · {q.session} {q.year}</span>
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={q.uid}
                    className={`border rounded-lg overflow-hidden flex flex-col cursor-pointer transition-all group
                      ${isSelected
                        ? `${sc.border} ${sc.bg} shadow-sm`
                        : `border-stone-200 bg-white ${sc.hoverBorder} hover:shadow-sm ${sc.hoverBg}`
                      }`}
                    onClick={toggleSelected}
                  >
                    <div className={`h-1 w-full ${isSelected ? sc.accentBar : 'bg-stone-200 group-hover:' + sc.accentBar}`} />
                    <div className="p-2.5 flex gap-2 items-start">
                    {/* Checkbox */}
                    <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                      ${isSelected ? `${sc.accentBar} border-transparent` : 'border-stone-300'}`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {q.subject && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sc.badge} ${sc.badgeText}`}>{q.subject}</span>
                        )}
                        <span className={`font-mono text-[10px] border px-1.5 py-0.5 rounded ${sc.codeBg} ${sc.codeText} ${sc.codeBorder}`}>
                          {q.rawCode}
                        </span>
                        {q.hasImage && (
                          <span className="text-[10px] text-stone-400">📷</span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">MCQ</span>
                      </div>
                      <div className="text-xs text-stone-700 truncate">
                        {q.questionText.substring(0, 130)}{q.questionText.length > 130 ? '…' : ''}
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {q.topic}{q.subtopic ? ` · ${q.subtopic}` : ''} · Paper {q.paper || '?'} · {q.session} {q.year}
                      </div>
                    </div>

                    {/* Preview button */}
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setPreviewImported(q)}
                        className="p-1 text-stone-400 hover:text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    </div>{/* end p-2.5 flex */}
                  </div>
                )
              })}
              {filteredImported.length === 0 && importedLoaded && !importedLoading && (
                <div className="col-span-full text-stone-400 text-sm text-center py-8">
                  {importedSearch.trim() || importedTopicFilter
                    ? 'No questions match your filters.'
                    : 'No past paper questions imported yet.'}
                </div>
              )}
              {filteredImported.length > 0 && totalImportedPages > 1 && (
                <div className="col-span-full flex items-center justify-between mt-2 px-1">
                  <span className="text-xs text-stone-500">
                    Page {safeImportedPage} / {totalImportedPages} · {filteredImported.length} questions
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setImportedPage(p => Math.max(1, p - 1))}
                      disabled={safeImportedPage === 1}
                      className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setImportedPage(p => Math.min(totalImportedPages, p + 1))}
                      disabled={safeImportedPage === totalImportedPages}
                      className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </>)}
      </div>

      {/* ExamView Import Modal */}
      {showExamViewImport && (
        <ExamViewImportModal
          folders={folders}
          onClose={() => setShowExamViewImport(false)}
          onDone={() => { setShowExamViewImport(false); setBankView('questions') }}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <ConfirmDeleteModal
          target={confirmDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Imported Question Preview Modal */}
      {previewImported && (
        <ImportedPreviewModal
          question={previewImported}
          onClose={() => setPreviewImported(null)}
          onUpdate={onUpdateImported}
        />
      )}

      {/* Assessment View Modal */}
      {viewAssessment && (
        <AssessmentViewModal
          assessment={viewAssessment}
          onClose={() => setViewAssessment(null)}
          onPractice={onPractice}
          onExam={onExam}
          onShare={onShare}
        />
      )}

      {/* Preview Modal */}
      {previewQuestion && (
        <QuestionPreviewModal
          question={previewQuestion}
          onClose={() => setPreviewQuestion(null)}
          onUpdate={async (updates) => {
            await onUpdateQuestion(previewQuestion.id, updates)
            setPreviewQuestion({ ...previewQuestion, ...updates })
          }}
          onRegenerateDiagram={onRegenerateDiagram ? async (q) => {
            await onRegenerateDiagram(q)
            // Refresh the preview with updated question from library
          } : undefined}
        />
      )}
    </div>
  )
}
