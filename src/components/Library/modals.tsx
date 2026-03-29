import React, { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import { Pencil, X, Check, Loader2, Bold, Italic, List, Upload, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Question, Folder, ImportedQuestion, RasterSpec, Assessment, QuestionItem } from '../../lib/types'
import { preprocessLatex } from '../../lib/latex'
import { RichEditor } from '../RichEditor'
import { DiagramRenderer } from '../DiagramRenderer'
import { useExamViewImport } from '../../hooks/useExamViewImport'

// ─── Shared markdown renderer ─────────────────────────────────────────────────

export function QMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeKatex]}
    >
      {preprocessLatex(content)}
    </ReactMarkdown>
  )
}

// Renders an MCQ option that may be plain text, markdown, or an image-only
// markdown snippet like "![](<url>)" or "![A](<url>)".
// preprocessLatex can corrupt image URLs so we handle the image case directly.
const MCQ_IMAGE_RE = /^!\[[^\]]*\]\(<?(https?:\/\/[^)>]+?)>?\)\s*$/

export function OptionContent({ opt }: { opt: string }) {
  const m = opt.trim().match(MCQ_IMAGE_RE)
  if (m) {
    return <img src={m[1]} alt="" className="max-h-24 object-contain" />
  }
  return <QMarkdown content={opt} />
}

// ─── Helper: ImportedQuestion → Question ─────────────────────────────────────

export function importedToQuestionItem(iq: ImportedQuestion): Question {
  const letterLabels = ['A', 'B', 'C', 'D']
  // If any option is an image markdown ("![](<url>)"), don't embed options into
  // q.text — they will be rendered separately via OptionContent which handles
  // image URLs without running preprocessLatex over them.
  const hasImageOptions = iq.options.some(o => MCQ_IMAGE_RE.test(o.trim()))
  const optionsText = hasImageOptions
    ? ''
    : iq.options
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

// ─── DeleteTarget type ────────────────────────────────────────────────────────

export type DeleteTarget = { type: 'assessment' | 'question' | 'folder'; id: string; label: string }

// ─── ConfirmDeleteModal ───────────────────────────────────────────────────────

export function ConfirmDeleteModal({ target, onConfirm, onCancel, isDeleting }: {
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

// ─── ImportedPreviewModal ─────────────────────────────────────────────────────

type ImportedDraft = {
  questionText: string
  options: [string, string, string, string]
  correctAnswer: string | null
  topic: string
  subtopic: string
}

export function ImportedPreviewModal({
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
                        <span className="text-stone-700 min-w-0"><OptionContent opt={opt} /></span>
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

// ─── QuestionPreviewModal ─────────────────────────────────────────────────────

export function QuestionPreviewModal({
  question,
  onClose,
  onUpdate,
  onRegenerateDiagram,
}: {
  question: Question
  onClose: () => void
  onUpdate?: (updates: { text: string; answer: string; markScheme: string; syllabusObjective: string; topic: string; difficulty: string; options?: string[] }) => void
  onRegenerateDiagram?: (q: Question) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [draft, setDraft] = useState({
    text: question.text,
    answer: question.answer,
    markScheme: question.markScheme,
    syllabusObjective: (question as any).syllabusObjective ?? '',
    topic: question.topic ?? '',
    difficulty: question.difficulty ?? '',
    options: question.options ? [...question.options] : ['', '', '', ''],
  })

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
                    onClick={() => { onUpdate({ text: draft.text, answer: draft.answer, markScheme: draft.markScheme, syllabusObjective: draft.syllabusObjective, topic: draft.topic, difficulty: draft.difficulty, ...(question.type === 'mcq' ? { options: draft.options.filter(Boolean).length >= 4 ? draft.options : question.options } : {}) }); setEditing(false) }}
                    className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => { setDraft({ text: question.text, answer: question.answer, markScheme: question.markScheme, syllabusObjective: (question as any).syllabusObjective ?? '', topic: question.topic ?? '', difficulty: question.difficulty ?? '', options: question.options ? [...question.options] : ['', '', '', ''] }); setEditing(false) }}
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
              {question.type === 'mcq' && (
                <div>
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Options (A–D)</label>
                  <div className="space-y-1.5">
                    {(['A', 'B', 'C', 'D'] as const).map((letter, i) => (
                      <div key={letter} className="flex items-center gap-2">
                        <span className="font-semibold text-stone-500 w-4 text-xs shrink-0">{letter}</span>
                        <input
                          value={draft.options[i] ?? ''}
                          onChange={e => {
                            const opts = [...draft.options]
                            opts[i] = e.target.value
                            setDraft(d => ({ ...d, options: opts }))
                          }}
                          className="flex-1 text-xs border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Topic</label>
                  <input className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400" value={draft.topic} onChange={e => setDraft(d => ({ ...d, topic: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 mb-1 block">Difficulty</label>
                  <select className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400" value={draft.difficulty} onChange={e => setDraft(d => ({ ...d, difficulty: e.target.value }))}>
                    <option value="">—</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 mb-1 block">Learning Objective</label>
                <input className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400" value={draft.syllabusObjective} onChange={e => setDraft(d => ({ ...d, syllabusObjective: e.target.value }))} />
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
              {((question as any).syllabusObjective || question.topic || question.difficulty) && (
                <div className="mt-3 flex flex-col gap-1 text-xs text-stone-500 border-t border-stone-100 pt-3">
                  {question.topic && <span><span className="font-semibold">Topic:</span> {question.topic}</span>}
                  {question.difficulty && <span><span className="font-semibold">Difficulty:</span> {question.difficulty}</span>}
                  {(question as any).syllabusObjective && <span><span className="font-semibold">Objective:</span> {(question as any).syllabusObjective}</span>}
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

// ─── ExamViewImportModal ──────────────────────────────────────────────────────

const KNOWN_SUBJECTS = [
  'Mathematics', 'Biology', 'Chemistry', 'Physics',
  'English', 'History', 'Geography', 'Computer Science',
  'Economics', 'Business Studies', 'Accounting',
  'Pre-Algebra', 'Algebra', 'Geometry', 'Other',
]

export function ExamViewImportModal({ onClose, onDone, folders }: {
  onClose: () => void
  onDone: () => void
  folders: Folder[]
}) {
  const { state, pickAndParse, setSubject, setFolderId, confirmImport, reset } = useExamViewImport()
  const fileRef = React.useRef<HTMLInputElement>(null)

  const flattenedFolderOptions = useMemo(() => {
    const result: { id: string; label: string }[] = []
    const childrenByParent: Record<string, Folder[]> = {}
    folders.forEach(f => {
      const key = f.parentId ?? '__root__'
      if (!childrenByParent[key]) childrenByParent[key] = []
      childrenByParent[key].push(f)
    })
    const visit = (f: Folder, depth: number) => {
      result.push({ id: f.id, label: '\u00a0'.repeat(depth * 4) + (depth > 0 ? '→ ' : '') + f.name })
      ;(childrenByParent[f.id] ?? []).forEach(child => visit(child, depth + 1))
    }
    ;(childrenByParent['__root__'] ?? []).forEach(f => visit(f, 0))
    return result
  }, [folders])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) pickAndParse(file)
  }

  function handleClose() { reset(); onClose() }

  function handleDone() { reset(); onDone() }

  const { stage, parsed, subject, folderId, progress, error, savedCount } = state

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-stone-800">Import from ExamView</span>
          </div>
          <button onClick={handleClose} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">

          {/* idle / parsing */}
          {(stage === 'idle' || stage === 'parsing') && (
            <>
              <p className="text-xs text-stone-500">
                Export from ExamView via <strong>File → Export → Blackboard 7.1-9.0</strong>, then upload the ZIP here.
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={stage === 'parsing'}
                className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-stone-300 rounded-lg text-sm text-stone-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                {stage === 'parsing'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</>
                  : <><Upload className="w-4 h-4" /> Choose Blackboard ZIP file</>
                }
              </button>
              <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={handleFile} />
            </>
          )}

          {/* preview */}
          {stage === 'preview' && parsed && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-xs text-emerald-800">
                <p className="font-semibold">{parsed.sourceFile}</p>
                <p className="mt-0.5">
                  {parsed.questions.length} questions
                  ({parsed.questions.filter(q => q.type === 'mcq').length} MCQ,{' '}
                  {parsed.questions.filter(q => q.type === 'short_answer').length} Short Answer)
                  · {parsed.allImages.size} images
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-stone-700">Subject <span className="text-red-500">*</span></label>
                <select
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="text-sm border border-stone-300 rounded-lg px-3 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                >
                  <option value="">Select subject…</option>
                  {KNOWN_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {folders.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-stone-700">Save to folder (optional)</label>
                  <select
                    value={folderId ?? ''}
                    onChange={e => setFolderId(e.target.value || undefined)}
                    className="text-sm border border-stone-300 rounded-lg px-3 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  >
                    <option value="">No folder</option>
                    {flattenedFolderOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={handleClose} className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200">Cancel</button>
                <button
                  onClick={confirmImport}
                  disabled={!subject}
                  className="px-4 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> Import {parsed.questions.length} questions
                </button>
              </div>
            </>
          )}

          {/* importing */}
          {stage === 'importing' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              <p className="text-sm text-stone-700">
                {progress.done === 0
                  ? 'Uploading images…'
                  : `Saving questions… ${progress.done} / ${progress.total}`}
              </p>
              <div className="w-full bg-stone-200 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${progress.total && progress.done > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* done */}
          {stage === 'done' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Check className="w-8 h-8 text-emerald-600" />
              <p className="text-sm font-semibold text-stone-800">{savedCount} questions imported!</p>
              <p className="text-xs text-stone-500">They are now in your Questions library.</p>
              <button onClick={handleDone} className="mt-1 px-4 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Done</button>
            </div>
          )}

          {/* error */}
          {stage === 'error' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
              <button onClick={reset} className="text-xs text-stone-600 underline">Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Assessment View Modal (read-only) ────────────────────────────────────────

function QuestionCard({ q, index }: { q: QuestionItem; index: number }) {
  const [tab, setTab] = useState<'question' | 'answer'>('question')
  return (
    <div className="border border-stone-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 border-b border-stone-100">
        <span className="text-xs font-bold text-stone-500">Q{index + 1}</span>
        <span className="text-xs text-stone-400">{q.marks}m</span>
        {q.type && <span className="text-[10px] bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded capitalize">{q.type.replace('_', ' ')}</span>}
        {q.commandWord && <span className="text-[10px] text-stone-500 italic">{q.commandWord}</span>}
        <div className="ml-auto flex rounded-md overflow-hidden border border-stone-200 text-[10px]">
          <button onClick={() => setTab('question')} className={`px-2 py-0.5 ${tab === 'question' ? 'bg-emerald-600 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>Question</button>
          <button onClick={() => setTab('answer')} className={`px-2 py-0.5 border-l border-stone-200 ${tab === 'answer' ? 'bg-emerald-600 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>Answer</button>
        </div>
      </div>
      <div className="p-3 text-sm text-stone-800 prose prose-sm max-w-none">
        {tab === 'question' ? (
          <>
            {q.diagram && <DiagramRenderer spec={q.diagram} />}
            <QMarkdown content={q.text} />
            {q.options && q.type === 'mcq' && (
              <div className="mt-2 space-y-1">
                {q.options.map((opt, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-semibold shrink-0 text-stone-500">{['A','B','C','D'][i]}.</span>
                    <QMarkdown content={opt} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            {q.answer && (
              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1">Answer</p>
                <QMarkdown content={q.answer} />
              </div>
            )}
            {q.markScheme && (
              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1">Mark Scheme</p>
                <QMarkdown content={q.markScheme} />
              </div>
            )}
            {!q.answer && !q.markScheme && <p className="text-xs text-stone-300 italic">No answer recorded.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export function AssessmentViewModal({
  assessment,
  onClose,
  onPractice,
  onExam,
  onShare,
}: {
  assessment: Assessment
  onClose: () => void
  onPractice?: (a: Assessment) => void
  onExam?: (a: Assessment) => void
  onShare?: (a: Assessment) => void
}) {
  const [page, setPage] = useState(0)
  const qs = assessment.questions
  const total = qs.length
  const PER_PAGE = 5
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const pageQs = qs.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-2xl sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {assessment.subject && (
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{assessment.subject}</span>
              )}
              {assessment.code && (
                <span className="font-mono text-xs text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">{assessment.code}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-stone-800 mt-1 truncate">{assessment.topic}</p>
            <p className="text-xs text-stone-400">{assessment.difficulty} · {total} question{total !== 1 ? 's' : ''} · {qs.reduce((s, q) => s + q.marks, 0)} marks</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-600 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Questions */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {pageQs.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={page * PER_PAGE + i} />
          ))}
          {total === 0 && (
            <p className="text-sm text-stone-400 text-center py-8">No questions in this assessment.</p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-stone-100 px-5 py-3 flex items-center gap-2 flex-wrap">
          {totalPages > 1 && (
            <div className="flex items-center gap-1 mr-auto">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-stone-500">{page + 1}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            {onPractice && (
              <button onClick={() => { onClose(); onPractice(assessment) }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200">
                ▶ Practice
              </button>
            )}
            {onExam && (
              <button onClick={() => { onClose(); onExam(assessment) }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200">
                ⏱ Exam
              </button>
            )}
            {onShare && (
              <button onClick={() => { onClose(); onShare(assessment) }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200">
                ↗ Share
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── QuickEditModal ───────────────────────────────────────────────────────────

export function QuickEditModal({
  question,
  onClose,
  onSave,
}: {
  question: QuestionItem
  onClose: () => void
  onSave: (updates: Partial<QuestionItem>) => void
}) {
  const [text, setText] = useState(question.text)
  const [markScheme, setMarkScheme] = useState(question.markScheme)
  const [options, setOptions] = useState<string[]>(
    question.options ? [...question.options] : ['', '', '', ''],
  )

  function handleSave() {
    const updates: Partial<QuestionItem> = { text, markScheme }
    if (question.type === 'mcq') updates.options = options
    onSave(updates)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 shrink-0">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-stone-700">Quick Edit</span>
            <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
              {question.marks}m · {question.commandWord} · {question.type}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              Save
            </button>
            <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4 flex flex-col gap-4">
          {/* Question text */}
          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 block">Question</label>
            <RichEditor value={text} onChange={setText} minRows={6} />
          </div>

          {/* MCQ options */}
          {question.type === 'mcq' && (
            <div>
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 block">Options (A–D)</label>
              <div className="flex flex-col gap-1.5">
                {(['A', 'B', 'C', 'D'] as const).map((letter, i) => (
                  <div key={letter} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-400 w-4 shrink-0">{letter}</span>
                    <input
                      value={options[i] ?? ''}
                      onChange={e => {
                        const next = [...options]
                        next[i] = e.target.value
                        setOptions(next)
                      }}
                      className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                      placeholder={`Option ${letter}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mark scheme */}
          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 block">Mark Scheme</label>
            <RichEditor value={markScheme} onChange={setMarkScheme} minRows={4} />
          </div>
        </div>
      </div>
    </div>
  )
}
