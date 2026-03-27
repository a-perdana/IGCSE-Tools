import React, { useState, useMemo, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import { Folder as FolderIcon, Trash2, Plus, Library as LibraryIcon, Pencil, X, Check, Eye, FilePlus, FolderPlus, Loader2, Calendar, Globe, RefreshCw, BookOpen, Bold, Italic, List } from 'lucide-react'
import type { Assessment, Question, Folder, ImportedQuestion, RasterSpec } from '../../lib/types'
import { preprocessLatex } from '../../lib/latex'
import { RichEditor } from '../RichEditor'
import { DiagramRenderer } from '../DiagramRenderer'

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
  onCreateFolder: (name: string) => void
  onDeleteFolder: (id: string) => void
  onRenameFolder: (id: string, name: string) => void
  selectedFolderId: string | null | undefined
  onSelectFolder: (id: string | null | undefined) => void
  onCreateAssessmentFromQuestions: (questions: Question[]) => void
  onAddQuestionsToAssessment: (assessmentId: string, questions: Question[]) => void
  onUpdateQuestion: (id: string, updates: Partial<Question>) => void
  currentUserId: string
  currentUserName: string
  onTogglePublicAssessment: (id: string, isPublic: boolean) => void
  onTogglePublicQuestion: (id: string, isPublic: boolean) => void
  onRegenerateDiagram?: (question: Question) => Promise<void>
  // ── Past Papers (imported questions) ───────────────────────────────────────
  importedQuestions?: ImportedQuestion[]
  importedLoading?: boolean
  onLoadImported?: () => void
  onUpdateImported?: (uid: string, updates: Partial<ImportedQuestion>) => Promise<void>
}

// ─── Subject colour palette ───────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, {
  border: string; bg: string; hoverBorder: string; hoverBg: string;
  badge: string; badgeText: string; codeBg: string; codeText: string; codeBorder: string
}> = {
  Mathematics: {
    border: 'border-blue-200', bg: 'bg-blue-50/60', hoverBorder: 'hover:border-blue-400', hoverBg: 'hover:bg-blue-50',
    badge: 'bg-blue-100', badgeText: 'text-blue-800',
    codeBg: 'bg-blue-100', codeText: 'text-blue-800', codeBorder: 'border-blue-300',
  },
  Biology: {
    border: 'border-emerald-200', bg: 'bg-emerald-50/60', hoverBorder: 'hover:border-emerald-400', hoverBg: 'hover:bg-emerald-50',
    badge: 'bg-emerald-100', badgeText: 'text-emerald-800',
    codeBg: 'bg-emerald-100', codeText: 'text-emerald-700', codeBorder: 'border-emerald-300',
  },
  Chemistry: {
    border: 'border-amber-200', bg: 'bg-amber-50/60', hoverBorder: 'hover:border-amber-400', hoverBg: 'hover:bg-amber-50',
    badge: 'bg-amber-100', badgeText: 'text-amber-800',
    codeBg: 'bg-amber-100', codeText: 'text-amber-800', codeBorder: 'border-amber-300',
  },
  Physics: {
    border: 'border-violet-200', bg: 'bg-violet-50/60', hoverBorder: 'hover:border-violet-400', hoverBg: 'hover:bg-violet-50',
    badge: 'bg-violet-100', badgeText: 'text-violet-800',
    codeBg: 'bg-violet-100', codeText: 'text-violet-800', codeBorder: 'border-violet-300',
  },
}

const SUBJECT_FALLBACK = {
  border: 'border-stone-200', bg: 'bg-white', hoverBorder: 'hover:border-stone-400', hoverBg: 'hover:bg-stone-50',
  badge: 'bg-stone-100', badgeText: 'text-stone-600',
  codeBg: 'bg-stone-100', codeText: 'text-stone-600', codeBorder: 'border-stone-300',
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

// ─── Helper: ImportedQuestion → QuestionItem ─────────────────────────────────

function importedToQuestionItem(iq: ImportedQuestion): Question {
  const letterLabels = ['A', 'B', 'C', 'D']
  const optionsText = iq.options
    .map((o, i) => `**${letterLabels[i]}** ${o}`)
    .filter(Boolean)
    .join('\n\n')

  const fullText = optionsText
    ? `${iq.questionText}\n\n${optionsText}`
    : iq.questionText

  const diagram: RasterSpec | undefined =
    iq.hasImage && iq.imageURL
      ? { diagramType: 'raster', url: iq.imageURL, maxWidth: 480 }
      : undefined

  return {
    id: iq.uid,
    text: fullText,
    answer: '',
    markScheme: '',
    marks: 1,
    commandWord: 'State',
    type: 'mcq',
    hasDiagram: iq.hasImage && !!iq.imageURL,
    diagram,
    options: iq.options,
    code: iq.rawCode,
    // Required Question fields
    subject: iq.subject,
    topic: iq.topic,
    difficulty: 'Medium',
    userId: '__imported__',
    createdAt: iq.createdAt,
    isPublic: true,
  }
}

// ─── ImportedQuestion preview + edit modal ───────────────────────────────────

type ImportedDraft = {
  questionText: string
  options: [string, string, string, string]
  correctAnswer: string | null
  topic: string
  subtopic: string
}

function ImportedPreviewModal({
  question,
  onClose,
  onUpdate,
}: {
  question: ImportedQuestion
  onClose: () => void
  onUpdate?: (uid: string, updates: Partial<ImportedQuestion>) => Promise<void>
}) {
  const letterLabels = ['A', 'B', 'C', 'D']
  const rasterSpec: RasterSpec | undefined =
    question.hasImage && question.imageURL
      ? { diagramType: 'raster', url: question.imageURL, maxWidth: 520 }
      : undefined

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<ImportedDraft>({
    questionText: question.questionText,
    options: [
      question.options[0] ?? '',
      question.options[1] ?? '',
      question.options[2] ?? '',
      question.options[3] ?? '',
    ],
    correctAnswer: question.correctAnswer,
    topic: question.topic,
    subtopic: question.subtopic ?? '',
  })

  const handleSave = async () => {
    if (!onUpdate) return
    setSaving(true)
    try {
      await onUpdate(question.uid, {
        questionText: draft.questionText,
        options: draft.options,
        correctAnswer: draft.correctAnswer || null,
        topic: draft.topic,
        subtopic: draft.subtopic || null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setDraft({
      questionText: question.questionText,
      options: [
        question.options[0] ?? '',
        question.options[1] ?? '',
        question.options[2] ?? '',
        question.options[3] ?? '',
      ],
      correctAnswer: question.correctAnswer,
      topic: question.topic,
      subtopic: question.subtopic ?? '',
    })
    setEditing(false)
  }

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const insertFormat = (prefix: string, suffix: string = prefix) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const val = draft.questionText
    const selected = val.slice(start, end)
    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${suffix}`
    const newVal = val.slice(0, start) + replacement + val.slice(end)
    setDraft(d => ({ ...d, questionText: newVal }))
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + replacement.length
    })
  }

  const insertBullet = () => {
    const el = textareaRef.current
    if (!el) return
    const val = draft.questionText
    const pos = el.selectionStart
    const before = val.slice(0, pos)
    const after = val.slice(pos)
    const atLineStart = before.endsWith('\n') || before === ''
    const insertion = atLineStart ? '• ' : '\n• '
    const newVal = before + insertion + after
    setDraft(d => ({ ...d, questionText: newVal }))
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = pos + insertion.length
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
              {question.rawCode}
            </span>
            {editing ? (
              <input
                value={draft.topic}
                onChange={e => setDraft(d => ({ ...d, topic: e.target.value }))}
                className="text-xs border border-stone-300 rounded px-1.5 py-0.5 w-40"
                placeholder="Topic"
              />
            ) : (
              <span className="text-xs text-stone-500">{question.topic}</span>
            )}
            {editing ? (
              <input
                value={draft.subtopic}
                onChange={e => setDraft(d => ({ ...d, subtopic: e.target.value }))}
                className="text-xs border border-stone-300 rounded px-1.5 py-0.5 w-32"
                placeholder="Subtopic (optional)"
              />
            ) : (
              question.subtopic && <span className="text-xs text-stone-400">· {question.subtopic}</span>
            )}
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">MCQ</span>
            {question.hasImage && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                📷 diagram
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onUpdate && (
              editing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1"
                  >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="p-1 text-stone-400 hover:text-emerald-600"
                  title="Edit question"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )
            )}
            <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4 text-sm space-y-3">
          {rasterSpec && <DiagramRenderer spec={rasterSpec} />}

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Question Text</label>
                <div className="border border-stone-300 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-emerald-400">
                  {/* Formatting toolbar */}
                  <div className="flex items-center gap-0.5 px-2 py-1 border-b border-stone-200 bg-stone-50">
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); insertFormat('**') }}
                      className="p-1.5 rounded text-stone-500 hover:text-stone-800 hover:bg-stone-200 transition-colors"
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); insertFormat('*') }}
                      className="p-1.5 rounded text-stone-500 hover:text-stone-800 hover:bg-stone-200 transition-colors"
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-4 bg-stone-300 mx-0.5" />
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); insertBullet() }}
                      className="p-1.5 rounded text-stone-500 hover:text-stone-800 hover:bg-stone-200 transition-colors"
                      title="Bullet point"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-4 bg-stone-300 mx-0.5" />
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); insertFormat('\n\n', '') }}
                      className="p-1.5 rounded text-stone-500 hover:text-stone-800 hover:bg-stone-200 transition-colors text-[10px] font-mono leading-none"
                      title="New paragraph"
                    >
                      ¶
                    </button>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={draft.questionText}
                    onChange={e => setDraft(d => ({ ...d, questionText: e.target.value }))}
                    rows={8}
                    className="w-full text-xs px-2.5 py-2 resize-y focus:outline-none bg-white"
                    style={{ whiteSpace: 'pre-wrap' }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Options</label>
                <div className="space-y-1.5">
                  {(['A', 'B', 'C', 'D'] as const).map((letter, i) => (
                    <div key={letter} className="flex items-center gap-2">
                      <span className="font-semibold text-stone-500 w-4 text-xs shrink-0">{letter}</span>
                      <input
                        value={draft.options[i]}
                        onChange={e => {
                          const opts = [...draft.options] as [string, string, string, string]
                          opts[i] = e.target.value
                          setDraft(d => ({ ...d, options: opts }))
                        }}
                        className="flex-1 text-xs border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Correct Answer</label>
                <div className="flex gap-2">
                  {['A', 'B', 'C', 'D', 'None'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setDraft(d => ({ ...d, correctAnswer: opt === 'None' ? null : opt }))}
                      className={`px-3 py-1 text-xs rounded-lg font-medium border transition-colors ${
                        (opt === 'None' ? !draft.correctAnswer : draft.correctAnswer === opt)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-stone-600 border-stone-300 hover:border-emerald-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-stone-800 leading-relaxed">{question.questionText}</p>
              {question.options.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {question.options.map((opt, i) => (
                    opt ? (
                      <div
                        key={i}
                        className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${
                          question.correctAnswer === letterLabels[i]
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-stone-50 border-stone-200'
                        }`}
                      >
                        <span className={`font-semibold shrink-0 w-5 ${
                          question.correctAnswer === letterLabels[i] ? 'text-emerald-700' : 'text-stone-600'
                        }`}>{letterLabels[i]}</span>
                        <span className="text-stone-700">{opt}</span>
                        {question.correctAnswer === letterLabels[i] && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 ml-auto shrink-0 mt-0.5" />
                        )}
                      </div>
                    ) : null
                  ))}
                </div>
              )}
              {question.correctAnswer && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <span className="text-xs font-semibold text-stone-500">Answer: </span>
                  <span className="text-xs font-bold text-emerald-700">{question.correctAnswer}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}


function QMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
    >
      {preprocessLatex(content)}
    </ReactMarkdown>
  )
}

function QuestionPreviewModal({
  question,
  onClose,
  onUpdate,
  onRegenerateDiagram,
}: {
  question: Question
  onClose: () => void
  onUpdate?: (updates: { text: string; answer: string; markScheme: string }) => void
  onRegenerateDiagram?: (q: Question) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [draft, setDraft] = useState({ text: question.text, answer: question.answer, markScheme: question.markScheme })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
              {question.marks}m · {question.commandWord}
            </span>
            <span className="text-xs text-stone-400">{question.type} · {question.subject}</span>
            {question.code && (
              <span className="text-xs font-mono bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">{question.code}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onRegenerateDiagram && question.hasDiagram && !editing && question.diagram?.diagramType !== 'raster' && (
              <button
                onClick={async () => { setRegenerating(true); try { await onRegenerateDiagram(question) } finally { setRegenerating(false) } }}
                disabled={regenerating}
                className="p-1 text-stone-400 hover:text-violet-600 disabled:opacity-50"
                title={question.diagram ? 'Improve Diagram' : 'Generate Diagram'}
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              </button>
            )}
            {onUpdate && (
              editing ? (
                <>
                  <button
                    onClick={() => { onUpdate(draft); setEditing(false) }}
                    className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => { setDraft({ text: question.text, answer: question.answer, markScheme: question.markScheme }); setEditing(false) }}
                    className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="p-1 text-stone-400 hover:text-emerald-600"
                  title="Edit question"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )
            )}
            <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-4 markdown-body text-sm">
          {editing ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Question</label>
                <RichEditor value={draft.text} onChange={v => setDraft(d => ({ ...d, text: v }))} minRows={8} />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Answer</label>
                <RichEditor value={draft.answer} onChange={v => setDraft(d => ({ ...d, answer: v }))} minRows={6} />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Mark Scheme</label>
                <RichEditor value={draft.markScheme} onChange={v => setDraft(d => ({ ...d, markScheme: v }))} minRows={6} />
              </div>
            </div>
          ) : (
            <>
              {question.diagram && <DiagramRenderer spec={question.diagram} />}
              <QMarkdown content={question.text} />
              {question.type === 'mcq' && question.options && question.options.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {question.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i)
                    const isCorrect = question.answer?.trim().toUpperCase() === letter
                    return (
                      <div key={i} className={`flex items-start gap-2 px-3 py-1.5 rounded-lg text-sm border ${isCorrect ? 'bg-emerald-50 border-emerald-300 font-medium text-emerald-800' : 'bg-stone-50 border-stone-200 text-stone-700'}`}>
                        <span className={`font-bold shrink-0 ${isCorrect ? 'text-emerald-700' : 'text-stone-400'}`}>{letter}</span>
                        <QMarkdown content={opt} />
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs font-semibold text-stone-500 mb-1">Answer</p>
                <QMarkdown content={question.answer} />
              </div>
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs font-semibold text-stone-500 mb-1">Mark Scheme</p>
                <QMarkdown content={question.markScheme} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type DeleteTarget = { type: 'assessment' | 'question' | 'folder'; id: string; label: string }

function ConfirmDeleteModal({ target, onConfirm, onCancel, isDeleting }: {
  target: DeleteTarget
  onConfirm: () => void
  onCancel: () => void
  isDeleting?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-stone-800">Delete {target.type}?</h2>
        <p className="text-xs text-stone-500">
          <span className="font-medium text-stone-700">"{target.label}"</span> will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200">Cancel</button>
          <button onClick={onConfirm} disabled={isDeleting} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60 flex items-center gap-1.5">
            {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export function Library({
  assessments, questions, folders, loading,
  onSelect, onDeleteAssessment, onMoveAssessment, onRenameAssessment,
  onDeleteQuestion, onMoveQuestion,
  onCreateFolder, onDeleteFolder, onRenameFolder,
  selectedFolderId, onSelectFolder,
  onCreateAssessmentFromQuestions, onAddQuestionsToAssessment,
  onUpdateQuestion,
  currentUserId, currentUserName,
  onTogglePublicAssessment, onTogglePublicQuestion,
  onRegenerateDiagram,
  importedQuestions = [],
  importedLoading = false,
  onLoadImported,
  onUpdateImported,
}: Props) {
  const QUESTIONS_PER_PAGE = 20
  const ASSESSMENTS_PER_PAGE = 12
  const IMPORTED_PER_PAGE = 25
  const [bankView, setBankView] = useState<'assessments' | 'questions' | 'pastpapers'>('assessments')
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameFolderValue, setRenameFolderValue] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)
  const [addToAssessmentId, setAddToAssessmentId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<DeleteTarget | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [subjectFilter, setSubjectFilter] = useState<string>('')
  const [questionSearch, setQuestionSearch] = useState('')
  const [assessmentSearch, setAssessmentSearch] = useState('')
  const [questionPage, setQuestionPage] = useState(1)
  const [assessmentPage, setAssessmentPage] = useState(1)
  // ── Past Papers state ───────────────────────────────────────────────────
  const [importedTopicFilter, setImportedTopicFilter] = useState<string>('')
  const [importedSearch, setImportedSearch] = useState('')
  const [importedPage, setImportedPage] = useState(1)
  const [importedSelectedIds, setImportedSelectedIds] = useState<Set<string>>(new Set())
  const [previewImported, setPreviewImported] = useState<ImportedQuestion | null>(null)
  const importedLoaded = importedQuestions.length > 0 || importedLoading

  // Keep previewQuestion in sync when the question is updated externally (e.g. after diagram regenerate)
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

  const filteredAssessments = useMemo(() => {
    let as = subjectFilter ? assessments.filter(a => a.subject === subjectFilter) : assessments
    if (assessmentSearch.trim()) {
      const s = assessmentSearch.trim().toLowerCase()
      as = as.filter(a =>
        (a.code && a.code.toLowerCase().includes(s)) ||
        a.topic.toLowerCase().includes(s)
      )
    }
    return as
  }, [assessments, subjectFilter, assessmentSearch])

  const filteredQuestions = useMemo(() => {
    let qs = subjectFilter ? questions.filter(q => q.subject === subjectFilter) : questions
    if (questionSearch.trim()) {
      const s = questionSearch.trim().toLowerCase()
      qs = qs.filter(q =>
        (q.code && q.code.toLowerCase().includes(s)) ||
        q.text.toLowerCase().includes(s)
      )
    }
    return qs
  }, [questions, subjectFilter, questionSearch])

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

  return (
    <div className="flex h-full overflow-hidden">
      {/* Folder Sidebar */}
      <div className="w-56 border-r border-stone-200 p-3 flex flex-col gap-2">
        <div className="flex gap-1">
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="New folder..."
            className="flex-1 text-xs px-2 py-1 border border-stone-300 rounded"
            onKeyDown={e => {
              if (e.key === 'Enter' && newFolderName.trim()) {
                onCreateFolder(newFolderName.trim())
                setNewFolderName('')
              }
            }}
          />
          <button
            onClick={() => { if (newFolderName.trim()) { onCreateFolder(newFolderName.trim()); setNewFolderName('') } }}
            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => onSelectFolder(undefined)}
          className={`text-left text-xs px-2 py-1.5 rounded flex items-center gap-1 ${selectedFolderId === undefined ? 'bg-emerald-100 text-emerald-800 font-medium' : 'hover:bg-stone-100 text-stone-600'}`}
        >
          <LibraryIcon className="w-3.5 h-3.5" /> All
        </button>
        {folders.map(f => (
          <div key={f.id} className="flex items-center gap-1 group">
            {renamingFolderId === f.id ? (
              <>
                <input
                  value={renameFolderValue}
                  onChange={e => setRenameFolderValue(e.target.value)}
                  className="flex-1 text-xs px-1.5 py-1 border border-emerald-400 rounded min-w-0"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && renameFolderValue.trim()) {
                      onRenameFolder(f.id, renameFolderValue.trim())
                      setRenamingFolderId(null)
                    }
                    if (e.key === 'Escape') setRenamingFolderId(null)
                  }}
                />
                <button onClick={() => { if (renameFolderValue.trim()) { onRenameFolder(f.id, renameFolderValue.trim()); setRenamingFolderId(null) } }} className="text-emerald-600 shrink-0"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setRenamingFolderId(null)} className="text-stone-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onSelectFolder(f.id)}
                  className={`flex-1 text-left text-xs px-2 py-1.5 rounded flex items-center gap-1 min-w-0 ${selectedFolderId === f.id ? 'bg-emerald-100 text-emerald-800 font-medium' : 'hover:bg-stone-100 text-stone-600'}`}
                >
                  <FolderIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
                <button
                  onClick={() => { setRenamingFolderId(f.id); setRenameFolderValue(f.name) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-400 hover:text-stone-600 shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setConfirmDelete({ type: 'folder', id: f.id, label: f.name })}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600 shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab switcher + subject filter */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 flex-wrap">
          <button
            onClick={() => { setBankView('assessments'); setSelectedIds(new Set()); setQuestionPage(1); setAssessmentPage(1) }}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${bankView === 'assessments' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Assessments ({filteredAssessments.length})
          </button>
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
          {bankView === 'assessments' && (
            <input
              type="text"
              value={assessmentSearch}
              onChange={e => { setAssessmentSearch(e.target.value); setAssessmentPage(1) }}
              placeholder="Search by code or topic…"
              className="text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-white text-stone-700 placeholder-stone-400 w-52 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          )}
          {bankView === 'questions' && (
            <input
              type="text"
              value={questionSearch}
              onChange={e => { setQuestionSearch(e.target.value); setQuestionPage(1) }}
              placeholder="Search by code or text…"
              className="text-xs border border-stone-300 rounded-lg px-2.5 py-1.5 bg-white text-stone-700 placeholder-stone-400 w-52 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
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
            </>
          )}
          <select
            value={subjectFilter}
            onChange={e => { setSubjectFilter(e.target.value); setQuestionPage(1); setAssessmentPage(1) }}
            className="ml-auto text-xs border border-stone-300 rounded-lg px-2 py-1.5 bg-white text-stone-600"
          >
            <option value="">All subjects</option>
            {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
            <div className="grid grid-cols-1 gap-3">
              {pagedAssessments.map(a => {
                const isGlobal = a.userId !== currentUserId && a.isPublic
                return (
                <div key={a.id} className={`border rounded-lg p-3 hover:shadow-sm transition-all ${isGlobal ? 'bg-sky-50 border-sky-200 hover:border-sky-400' : 'bg-white border-stone-200 hover:border-emerald-300'}`}>
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
                        <button onClick={() => onSelect(a)} className="text-left">
                          {a.code && (
                            <div className="font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded w-fit mb-1">
                              {a.code}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-stone-800">{a.topic}</span>
                            {a.userId === currentUserId && (
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
                            <span>{a.subject} · {a.difficulty} · {a.questions.length}q</span>
                            {a.userId !== currentUserId && a.isPublic && a.preparedBy && (
                              <span className="text-xs text-emerald-600">by {a.preparedBy}</span>
                            )}
                            <span className="flex items-center gap-1 text-stone-400">
                              <Calendar className="w-3 h-3" />
                              {a.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' · '}
                              {a.createdAt.toDate().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {a.userId === currentUserId && (
                        <>
                          <button onClick={() => { setRenamingId(a.id); setRenameValue(a.topic) }} className="p-1 text-stone-400 hover:text-stone-600"><Pencil className="w-3.5 h-3.5" /></button>
                          <select
                            value={a.folderId ?? ''}
                            onChange={e => onMoveAssessment(a.id, e.target.value || null)}
                            className="text-xs border border-stone-200 rounded px-1 py-0.5 text-stone-600"
                          >
                            <option value="">No folder</option>
                            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <button onClick={() => setConfirmDelete({ type: 'assessment', id: a.id, label: a.topic + (a.code ? ` (${a.code})` : '') })} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
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
            <div className="grid grid-cols-1 gap-2">
              {pagedQuestions.map(q => {
                const isSelected = selectedIds.has(q.id)
                const isGlobal = q.userId !== currentUserId && q.isPublic
                const sc = subjectColors(q.subject)
                const displayCode = q.code || autoCode(q)
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
                      </div>
                      <div className="text-xs text-stone-700 truncate">
                        {q.text
                        .replace(/```svg[\s\S]*?```/g, '[diagram]')
                        .replace(/\*\*/g, '')
                        .substring(0, 120)}...
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
                        {q.userId !== currentUserId && q.isPublic && q.preparedBy && (
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
                      {q.userId === currentUserId && (
                        <button
                          onClick={e => { e.stopPropagation(); onTogglePublicQuestion(q.id, !q.isPublic) }}
                          className={`p-1 rounded ${q.isPublic ? 'text-emerald-600 hover:text-emerald-700' : 'text-stone-300 hover:text-stone-500'}`}
                          title={q.isPublic ? 'Public' : 'Make public'}
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {q.userId === currentUserId && (
                        <>
                          <select
                            value={q.folderId ?? ''}
                            onChange={e => onMoveQuestion(q.id, e.target.value || null)}
                            className="text-xs border border-stone-200 rounded px-1 py-0.5 text-stone-600"
                          >
                            <option value="">No folder</option>
                            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
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
            <div className="grid grid-cols-1 gap-2">
              {importedLoading && (
                <div className="flex items-center gap-2 text-stone-400 text-sm py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading past paper questions…
                </div>
              )}
              {!importedLoading && !importedLoaded && (
                <div className="text-stone-400 text-sm text-center py-8">
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
                return (
                  <div
                    key={q.uid}
                    className={`border rounded-lg p-2.5 flex gap-2 items-start cursor-pointer transition-all group
                      ${isSelected
                        ? 'border-amber-400 bg-amber-50 shadow-sm'
                        : 'border-stone-200 bg-white hover:border-amber-300 hover:shadow-sm hover:bg-amber-50/30'
                      }`}
                    onClick={() => setImportedSelectedIds(prev => {
                      const next = new Set(prev)
                      next.has(q.uid) ? next.delete(q.uid) : next.add(q.uid)
                      return next
                    })}
                  >
                    {/* Checkbox */}
                    <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                      ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-stone-300 group-hover:border-amber-400'}`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="font-mono text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                          {q.rawCode}
                        </span>
                        {q.hasImage && (
                          <span className="text-[10px] text-amber-500">📷</span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">MCQ</span>
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
                        className="p-1 text-stone-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {filteredImported.length === 0 && importedLoaded && !importedLoading && (
                <div className="text-stone-400 text-sm text-center py-8">
                  {importedSearch.trim() || importedTopicFilter
                    ? 'No questions match your filters.'
                    : 'No past paper questions imported yet.'}
                </div>
              )}
              {filteredImported.length > 0 && totalImportedPages > 1 && (
                <div className="flex items-center justify-between mt-2 px-1">
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
      </div>

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
