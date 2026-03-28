import React, { useState, useMemo, useEffect, useRef } from 'react'
import { X, Pencil, Trash2, Plus, Check, Loader2, Upload, Search, Image as ImageIcon, FileText, Sparkles, Eye, EyeOff, AlertCircle, List, LayoutGrid } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import type { DiagramPoolEntry, DiagramCategory, QuestionItem } from '../../lib/types'
import { IGCSE_SUBJECTS, generateQuestionFromDiagram, type GenerateFromDiagramConfig, type GeneratedDiagramQuestion } from '../../lib/gemini'
import { PdfDiagramExtractor } from './PdfDiagramExtractor'

const CATEGORY_LABELS: Record<DiagramCategory, string> = {
  diagram: 'Diagram',
  graph: 'Graph',
  photo: 'Photo',
  table: 'Table',
  other: 'Other',
}

const CATEGORY_COLORS: Record<DiagramCategory, string> = {
  diagram: 'bg-blue-100 text-blue-700',
  graph: 'bg-violet-100 text-violet-700',
  photo: 'bg-emerald-100 text-emerald-700',
  table: 'bg-amber-100 text-amber-700',
  other: 'bg-stone-100 text-stone-500',
}

interface Props {
  entries: DiagramPoolEntry[]
  loading: boolean
  onLoad: (subject?: string) => void
  onUpdate: (id: string, updates: Partial<DiagramPoolEntry>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpload: (file: File, subject: string, meta: { description: string; category: DiagramCategory; topics: string[]; tags: string[] }) => Promise<void>
  onSaveQuestions?: (questions: Omit<QuestionItem, 'id'>[], subject: string, topic: string) => Promise<void>
  geminiApiKey?: string
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({
  entry,
  onClose,
  onSave,
}: {
  entry: DiagramPoolEntry
  onClose: () => void
  onSave: (updates: Partial<DiagramPoolEntry>) => Promise<void>
}) {
  const [draft, setDraft] = useState({
    description: entry.description ?? '',
    category: entry.category ?? 'diagram',
    topics: entry.topics.join(', '),
    tags: entry.tags.join(', '),
    subject: entry.subject ?? '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        description: draft.description,
        category: draft.category as DiagramCategory,
        topics: draft.topics.split(',').map(t => t.trim()).filter(Boolean),
        tags: draft.tags.split(',').map(t => t.trim()).filter(Boolean),
        subject: draft.subject,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <span className="text-sm font-semibold text-stone-800">Edit Diagram</span>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <img src={entry.imageURL} alt={entry.imageName} className="w-full max-h-48 object-contain rounded-lg border border-stone-200 bg-stone-50" />

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Subject</label>
            <select
              value={draft.subject}
              onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))}
              className="w-full text-xs border border-stone-300 rounded px-2 py-1.5 bg-white"
            >
              {IGCSE_SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Category</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(CATEGORY_LABELS) as DiagramCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setDraft(d => ({ ...d, category: cat }))}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors ${
                    draft.category === cat
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-stone-600 border-stone-300 hover:border-emerald-400'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Description</label>
            <textarea
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              rows={2}
              placeholder="Short description of what this diagram shows…"
              className="w-full text-xs border border-stone-300 rounded px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Topics (comma-separated)</label>
            <input
              value={draft.topics}
              onChange={e => setDraft(d => ({ ...d, topics: e.target.value }))}
              placeholder="e.g. Enzymes, Digestion, Biological molecules"
              className="w-full text-xs border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Tags (comma-separated)</label>
            <input
              value={draft.tags}
              onChange={e => setDraft(d => ({ ...d, tags: e.target.value }))}
              placeholder="e.g. active site, lock and key, enzyme inhibition"
              className="w-full text-xs border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-stone-200">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({
  onClose,
  onUpload,
}: {
  onClose: () => void
  onUpload: (file: File, subject: string, meta: { description: string; category: DiagramCategory; topics: string[]; tags: string[] }) => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [subject, setSubject] = useState(IGCSE_SUBJECTS[0])
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<DiagramCategory>('diagram')
  const [topics, setTopics] = useState('')
  const [tags, setTags] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      await onUpload(file, subject, {
        description,
        category,
        topics: topics.split(',').map(t => t.trim()).filter(Boolean),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      })
      onClose()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <span className="text-sm font-semibold text-stone-800">Upload Diagram</span>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            {preview ? (
              <img src={preview} alt="preview" className="max-h-40 mx-auto rounded object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-stone-400">
                <Upload className="w-8 h-8" />
                <span className="text-xs">Click or drag image here</span>
                <span className="text-[10px] text-stone-300">PNG, JPG, SVG</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full text-xs border border-stone-300 rounded px-2 py-1.5 bg-white">
              {IGCSE_SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Category</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(CATEGORY_LABELS) as DiagramCategory[]).map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors ${category === cat ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-stone-600 border-stone-300 hover:border-emerald-400'}`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="What does this diagram show?"
              className="w-full text-xs border border-stone-300 rounded px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Topics (comma-separated)</label>
            <input value={topics} onChange={e => setTopics(e.target.value)} placeholder="e.g. Photosynthesis, Plant nutrition"
              className="w-full text-xs border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">Tags (comma-separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. chloroplast, leaf cross section"
              className="w-full text-xs border border-stone-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-stone-200">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200">Cancel</button>
          <button onClick={handleUpload} disabled={!file || uploading}
            className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5"
          >
            {uploading && <Loader2 className="w-3 h-3 animate-spin" />} Upload
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MathText ─────────────────────────────────────────────────────────────────
function MathText({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {children}
    </ReactMarkdown>
  )
}

// ─── GenerateQuestionModal ────────────────────────────────────────────────────
function GenerateQuestionModal({
  entry,
  geminiApiKey,
  onClose,
  onSave,
}: {
  entry: DiagramPoolEntry
  geminiApiKey?: string
  onClose: () => void
  onSave: (q: GeneratedDiagramQuestion) => Promise<void>
}) {
  const [config, setConfig] = useState<GenerateFromDiagramConfig>({
    subject: entry.subject || IGCSE_SUBJECTS[0],
    topic: entry.topics[0] ?? entry.description ?? '',
    type: 'short_answer',
    difficulty: 2,
    marks: 2,
    assessmentObjective: 'AO2',
  })
  const [result, setResult] = useState<GeneratedDiagramQuestion | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

  const handleGenerate = async () => {
    if (!geminiApiKey) { setError('No Gemini API key set. Open API Settings to add your key.'); return }
    setError(null)
    setGenerating(true)
    try {
      const q = await generateQuestionFromDiagram(entry.imageURL, config, geminiApiKey)
      setResult(q)
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      await onSave(result)
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const patch = (p: Partial<GenerateFromDiagramConfig>) => setConfig(c => ({ ...c, ...p }))
  const patchResult = (p: Partial<GeneratedDiagramQuestion>) => setResult(r => r ? { ...r, ...p } : r)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-semibold text-stone-800">Generate Question from Diagram</span>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: diagram preview + config */}
          <div className="w-56 shrink-0 flex flex-col border-r border-stone-200 overflow-y-auto">
            <img src={entry.imageURL} alt={entry.description || entry.imageName}
              className="w-full object-contain bg-stone-50 p-2 border-b border-stone-100" style={{ maxHeight: 160 }} />

            <div className="p-3 space-y-3">
              {/* Subject */}
              <div>
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Subject</label>
                <select value={config.subject} onChange={e => patch({ subject: e.target.value })}
                  className="w-full text-xs border border-stone-300 rounded px-2 py-1.5 bg-white">
                  {IGCSE_SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {/* Topic */}
              <div>
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Topic hint</label>
                <input value={config.topic} onChange={e => patch({ topic: e.target.value })}
                  placeholder="e.g. Transformations"
                  className="w-full text-xs border border-stone-300 rounded px-2 py-1.5" />
              </div>

              {/* Type */}
              <div>
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Question type</label>
                <div className="flex flex-col gap-1">
                  {(['mcq', 'short_answer', 'structured'] as const).map(t => (
                    <button key={t} onClick={() => patch({ type: t })}
                      className={`px-2 py-1 text-xs rounded font-medium border transition-colors text-left ${config.type === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-stone-600 border-stone-300 hover:border-violet-400'}`}>
                      {t === 'mcq' ? 'MCQ' : t === 'short_answer' ? 'Short Answer' : 'Structured'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Marks */}
              <div>
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Marks</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map(m => (
                    <button key={m} onClick={() => patch({ marks: m })}
                      className={`flex-1 py-1 text-xs rounded font-medium border transition-colors ${config.marks === m ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-stone-500 border-stone-300 hover:border-violet-400'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Difficulty</label>
                <div className="flex gap-1">
                  {([1, 2, 3] as const).map(d => (
                    <button key={d} onClick={() => patch({ difficulty: d })}
                      className={`flex-1 py-1 text-xs rounded font-medium border transition-colors ${config.difficulty === d ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-stone-500 border-stone-300 hover:border-violet-400'}`}>
                      {'★'.repeat(d)}
                    </button>
                  ))}
                </div>
              </div>

              {/* AO */}
              <div>
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Assessment Obj.</label>
                <div className="flex gap-1">
                  {(['AO1', 'AO2', 'AO3'] as const).map(ao => (
                    <button key={ao} onClick={() => patch({ assessmentObjective: ao })}
                      className={`flex-1 py-1 text-xs rounded font-medium border transition-colors ${config.assessmentObjective === ao ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-stone-500 border-stone-300 hover:border-violet-400'}`}>
                      {ao}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button onClick={handleGenerate} disabled={generating}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60">
                {generating ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</> : <><Sparkles className="w-3 h-3" /> {result ? 'Regenerate' : 'Generate'}</>}
              </button>
            </div>
          </div>

          {/* Right: result */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!result && !generating && !error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-300 p-6">
                <Sparkles className="w-10 h-10" />
                <p className="text-xs text-center">Configure options and click Generate.<br />Gemini will write a question based on the diagram.</p>
              </div>
            )}

            {error && (
              <div className="m-4 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {generating && (
              <div className="flex-1 flex items-center justify-center gap-2 text-stone-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Gemini is studying the diagram…</span>
              </div>
            )}

            {result && !generating && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Preview toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-600">Generated Question</span>
                  <button onClick={() => setShowPreview(p => !p)}
                    className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-600">
                    {showPreview ? <><EyeOff className="w-3 h-3" /> Raw</> : <><Eye className="w-3 h-3" /> Preview</>}
                  </button>
                </div>

                {/* Question text */}
                <div>
                  <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Question</label>
                  {showPreview ? (
                    <div className="text-xs text-stone-800 leading-relaxed bg-stone-50 rounded-lg p-3 border border-stone-200 prose prose-sm max-w-none">
                      <MathText>{result.text}</MathText>
                    </div>
                  ) : (
                    <textarea value={result.text} onChange={e => patchResult({ text: e.target.value })}
                      rows={4} className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 font-mono resize-y" />
                  )}
                </div>

                {/* MCQ options */}
                {result.type === 'mcq' && result.options && (
                  <div>
                    <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Options</label>
                    <div className="space-y-1">
                      {result.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-400 w-4">{String.fromCharCode(65 + i)}</span>
                          {showPreview ? (
                            <div className="flex-1 text-xs bg-stone-50 rounded px-2 py-1 border border-stone-200 prose prose-sm max-w-none">
                              <MathText>{opt}</MathText>
                            </div>
                          ) : (
                            <input value={opt} onChange={e => {
                              const opts = [...(result.options ?? [])]
                              opts[i] = e.target.value
                              patchResult({ options: opts })
                            }} className="flex-1 text-xs border border-stone-300 rounded px-2 py-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mark scheme */}
                <div>
                  <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1 block">Mark Scheme</label>
                  {showPreview ? (
                    <div className="text-xs text-stone-700 bg-emerald-50 rounded-lg p-3 border border-emerald-100 prose prose-sm max-w-none">
                      <MathText>{result.markScheme}</MathText>
                    </div>
                  ) : (
                    <textarea value={result.markScheme} onChange={e => patchResult({ markScheme: e.target.value })}
                      rows={3} className="w-full text-xs border border-stone-300 rounded-lg px-3 py-2 font-mono resize-y" />
                  )}
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded font-medium">{result.type === 'mcq' ? 'MCQ' : result.type === 'short_answer' ? 'Short Answer' : 'Structured'}</span>
                  <span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded">{result.marks} mark{result.marks !== 1 ? 's' : ''}</span>
                  <span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded">{'★'.repeat(result.difficultyStars)}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{result.assessmentObjective}</span>
                  {result.commandWord && <span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded">{result.commandWord}</span>}
                  {result.syllabusObjective && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded truncate max-w-xs">{result.syllabusObjective}</span>}
                </div>

                {result.topic && (
                  <p className="text-[10px] text-stone-400">Topic: {result.topic}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {result && !generating && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-stone-200 shrink-0">
            <button onClick={onClose} className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-60">
              {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</> : <><Check className="w-3 h-3" /> Save to Library</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const PER_PAGE = 30

export function DiagramLibrary({ entries, loading, onLoad, onUpdate, onDelete, onUpload, onSaveQuestions, geminiApiKey }: Props) {
  const [subjectFilter, setSubjectFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<DiagramCategory | ''>('')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [page, setPage] = useState(1)
  const [editEntry, setEditEntry] = useState<DiagramPoolEntry | null>(null)
  const [generateEntry, setGenerateEntry] = useState<DiagramPoolEntry | null>(null)
  const [layout, setLayout] = useState<'gallery' | 'list'>('gallery')
  const [showUpload, setShowUpload] = useState(false)
  const [showPdfExtractor, setShowPdfExtractor] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const hasLoaded = useRef(false)

  // Load on mount (once)
  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true
      onLoad()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when subject filter changes (skip initial mount)
  const isFirstSubjectChange = useRef(true)
  useEffect(() => {
    if (isFirstSubjectChange.current) { isFirstSubjectChange.current = false; return }
    onLoad(subjectFilter || undefined)
    setPage(1)
  }, [subjectFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = entries
    if (categoryFilter) list = list.filter(e => e.category === categoryFilter)
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter(e =>
        e.description?.toLowerCase().includes(s) ||
        e.topics.some(t => t.toLowerCase().includes(s)) ||
        e.tags.some(t => t.toLowerCase().includes(s)) ||
        e.imageName.toLowerCase().includes(s)
      )
    }
    // Sort by createdAt — entries without a timestamp (null) go to top when newest
    list = [...list].sort((a, b) => {
      const aMs = a.createdAt?.toMillis?.() ?? Infinity
      const bMs = b.createdAt?.toMillis?.() ?? Infinity
      return sortOrder === 'newest' ? bMs - aMs : aMs - bMs
    })
    return list
  }, [entries, categoryFilter, search, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    setDeleting(true)
    try { await onDelete(confirmDeleteId) } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-200 flex-wrap shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search description, topic, tag…"
            className="w-full text-xs pl-7 pr-2 py-1.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>

        {/* Subject filter */}
        <select
          value={subjectFilter}
          onChange={e => setSubjectFilter(e.target.value)}
          className="text-xs border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">All subjects</option>
          {IGCSE_SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value as any); setPage(1) }}
          className="text-xs border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">All types</option>
          {(Object.entries(CATEGORY_LABELS) as [DiagramCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <span className="text-xs text-stone-400">{filtered.length} diagrams</span>

        <div className="flex rounded-lg border border-stone-200 overflow-hidden ml-auto shrink-0">
          <button
            onClick={() => setLayout('gallery')}
            className={`p-1.5 transition-colors ${layout === 'gallery' ? 'bg-emerald-600 text-white' : 'bg-white text-stone-400 hover:bg-stone-50'}`}
            title="Gallery view"
          ><LayoutGrid className="w-3.5 h-3.5" /></button>
          <button
            onClick={() => setLayout('list')}
            className={`p-1.5 border-l border-stone-200 transition-colors ${layout === 'list' ? 'bg-emerald-600 text-white' : 'bg-white text-stone-400 hover:bg-stone-50'}`}
            title="List view"
          ><List className="w-3.5 h-3.5" /></button>
        </div>

        {/* Sort order */}
        <button
          onClick={() => { setSortOrder(s => s === 'newest' ? 'oldest' : 'newest'); setPage(1) }}
          className="text-xs border border-stone-300 rounded-lg px-2 py-1.5 bg-white text-stone-600 hover:border-emerald-400 whitespace-nowrap"
          title="Toggle sort order"
        >
          {sortOrder === 'newest' ? '↓ Newest' : '↑ Oldest'}
        </button>

        <button
          onClick={() => setShowPdfExtractor(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-700"
          title="Extract diagrams from a PDF"
        >
          <FileText className="w-3.5 h-3.5" /> From PDF
        </button>

        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Plus className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 text-stone-400 py-16">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading diagrams…
          </div>
        )}
        {!loading && entries.length === 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-stone-400">
            <ImageIcon className="w-10 h-10" />
            <p className="text-xs">No diagrams in pool yet.</p>
          </div>
        )}
        {!loading && entries.length > 0 && filtered.length === 0 && (
          <div className="text-center text-stone-400 text-sm py-16">
            {search || categoryFilter ? 'No diagrams match your filters.' : 'No diagrams in pool yet.'}
          </div>
        )}

        {layout === 'gallery' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {paged.map(entry => (
            <div key={entry.id} className="group relative border border-stone-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
              {/* Image */}
              <div className="aspect-square bg-stone-50 flex items-center justify-center overflow-hidden">
                <img
                  src={entry.imageURL}
                  alt={entry.description || entry.imageName}
                  className="w-full h-full object-contain p-1"
                  loading="lazy"
                />
              </div>

              {/* Meta */}
              <div className="px-2 py-1.5 space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other}`}>
                    {CATEGORY_LABELS[entry.category] ?? 'Other'}
                  </span>
                  <span className="text-[10px] text-stone-400 truncate">{entry.subject}</span>
                </div>
                {entry.description ? (
                  <p className="text-[10px] text-stone-600 line-clamp-2 leading-snug">{entry.description}</p>
                ) : (
                  <p className="text-[10px] text-stone-300 italic">No description</p>
                )}
                {entry.topics.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {entry.topics.slice(0, 2).map(t => (
                      <span key={t} className="text-[9px] bg-stone-100 text-stone-500 px-1 py-0.5 rounded">{t}</span>
                    ))}
                    {entry.topics.length > 2 && (
                      <span className="text-[9px] text-stone-400">+{entry.topics.length - 2}</span>
                    )}
                  </div>
                )}
                {entry.usedInQuestionUids?.length > 0 && (
                  <p className="text-[9px] text-stone-400">{entry.usedInQuestionUids.length} question{entry.usedInQuestionUids.length > 1 ? 's' : ''}</p>
                )}
              </div>

              {/* Hover actions */}
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {geminiApiKey && onSaveQuestions && (
                  <button
                    onClick={() => setGenerateEntry(entry)}
                    className="p-1 bg-white rounded-lg shadow text-stone-500 hover:text-violet-600"
                    title="Generate question from this diagram"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setEditEntry(entry)}
                  className="p-1 bg-white rounded-lg shadow text-stone-500 hover:text-emerald-600"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(entry.id)}
                  className="p-1 bg-white rounded-lg shadow text-stone-500 hover:text-red-500"
                  title="Remove from pool"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        ) : (
          /* ── List view ── */
          <div className="flex flex-col gap-1">
            {paged.map(entry => (
              <div key={entry.id} className="group flex items-center gap-3 px-3 py-2 border border-stone-200 rounded-xl bg-white hover:shadow-sm transition-shadow">
                <img
                  src={entry.imageURL}
                  alt={entry.description || entry.imageName}
                  className="w-12 h-12 object-contain rounded-lg border border-stone-100 bg-stone-50 shrink-0"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other}`}>
                      {CATEGORY_LABELS[entry.category] ?? 'Other'}
                    </span>
                    <span className="text-[10px] text-stone-400">{entry.subject}</span>
                    {entry.usedInQuestionUids?.length > 0 && (
                      <span className="text-[10px] text-stone-400">{entry.usedInQuestionUids.length}q</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-700 truncate mt-0.5">
                    {entry.description || <span className="text-stone-300 italic">No description</span>}
                  </p>
                  {entry.topics.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {entry.topics.slice(0, 3).map(t => (
                        <span key={t} className="text-[9px] bg-stone-100 text-stone-500 px-1 py-0.5 rounded">{t}</span>
                      ))}
                      {entry.topics.length > 3 && <span className="text-[9px] text-stone-400">+{entry.topics.length - 3}</span>}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {geminiApiKey && onSaveQuestions && (
                    <button onClick={() => setGenerateEntry(entry)} className="p-1.5 rounded-lg text-stone-400 hover:text-violet-600 hover:bg-violet-50" title="Generate question">
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setEditEntry(entry)} className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirmDeleteId(entry.id)} className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50" title="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-xs text-stone-500">Page {safePage} / {totalPages}</span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {generateEntry && (
        <GenerateQuestionModal
          entry={generateEntry}
          geminiApiKey={geminiApiKey}
          onClose={() => setGenerateEntry(null)}
          onSave={async (q) => {
            if (!onSaveQuestions) return
            await onSaveQuestions([{
              text: q.text,
              answer: q.markScheme,
              markScheme: q.markScheme,
              marks: q.marks,
              commandWord: q.commandWord,
              type: q.type,
              hasDiagram: true,
              diagram: { diagramType: 'raster', url: generateEntry.imageURL },
              options: q.options,
              syllabusObjective: q.syllabusObjective,
              assessmentObjective: q.assessmentObjective,
              difficultyStars: q.difficultyStars,
            }], generateEntry.subject, q.topic)
          }}
        />
      )}

      {editEntry && (
        <EditModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSave={async (updates) => { await onUpdate(editEntry.id, updates) }}
        />
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUpload={onUpload}
        />
      )}

      {showPdfExtractor && (
        <PdfDiagramExtractor
          onClose={() => setShowPdfExtractor(false)}
          onUpload={onUpload}
          onSaveQuestions={onSaveQuestions}
          geminiApiKey={geminiApiKey}
          defaultSubject={subjectFilter || undefined}
        />
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-stone-800">Remove from pool?</h2>
            <p className="text-xs text-stone-500">This removes the entry from the diagram pool. The original image in Storage is not deleted.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg font-medium hover:bg-stone-200">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60 flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="w-3 h-3 animate-spin" />} Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
