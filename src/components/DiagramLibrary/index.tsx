import React, { useState, useMemo, useEffect, useRef } from 'react'
import { X, Pencil, Trash2, Plus, Check, Loader2, Upload, Search, Tag, Image as ImageIcon, FileText } from 'lucide-react'
import type { DiagramPoolEntry, DiagramCategory, QuestionItem } from '../../lib/types'
import { IGCSE_SUBJECTS } from '../../lib/gemini'
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

// ─── Main component ───────────────────────────────────────────────────────────

const PER_PAGE = 30

export function DiagramLibrary({ entries, loading, onLoad, onUpdate, onDelete, onUpload, onSaveQuestions, geminiApiKey }: Props) {
  const [subjectFilter, setSubjectFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<DiagramCategory | ''>('')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [page, setPage] = useState(1)
  const [editEntry, setEditEntry] = useState<DiagramPoolEntry | null>(null)
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

        <span className="text-xs text-stone-400 ml-auto">{filtered.length} diagrams</span>

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
