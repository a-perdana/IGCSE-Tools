import React, { useState, useRef, useCallback, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {
  X, Upload, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Crop,
  Check, Loader2, Trash2, FileText, Image as ImageIcon, Sparkles,
  Eye, EyeOff, AlertCircle, Maximize2, Minimize2,
} from 'lucide-react'
import type { DiagramCategory, QuestionItem } from '../../lib/types'
import { IGCSE_SUBJECTS, parsePdfQuestionsWithGemini, type ParsedPdfQuestion } from '../../lib/gemini'

// ── pdfjs worker ────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// ── Types ────────────────────────────────────────────────────────────────────
interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

interface CroppedItem {
  id: string
  dataUrl: string   // PNG blob URL for preview
  blob: Blob
  pageNum: number
  subject: string
  description: string
  category: DiagramCategory
  topics: string
  tags: string
}

type ExtractorMode = 'diagrams' | 'questions'

interface Props {
  onClose: () => void
  onUpload: (
    file: File,
    subject: string,
    meta: { description: string; category: DiagramCategory; topics: string[]; tags: string[] }
  ) => Promise<void>
  onSaveQuestions?: (questions: Omit<QuestionItem, 'id'>[], subject: string, topic: string) => Promise<void>
  geminiApiKey?: string
}

const CATEGORY_LABELS: Record<DiagramCategory, string> = {
  diagram: 'Diagram',
  graph: 'Graph',
  photo: 'Photo',
  table: 'Table',
  other: 'Other',
}

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0]
const DEFAULT_ZOOM_INDEX = 4 // 2.0×

// ── Helpers ──────────────────────────────────────────────────────────────────
function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: 'image/png' })
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ── usePdfRenderer hook ──────────────────────────────────────────────────────
function usePdfRenderer() {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [pageLoading, setPageLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  const scale = ZOOM_LEVELS[zoomIndex]

  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, num: number, s: number) => {
    if (!canvasRef.current) return
    // cancel any in-flight render
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel() } catch {}
      renderTaskRef.current = null
    }
    setPageLoading(true)
    try {
      const page = await doc.getPage(num)
      const viewport = page.getViewport({ scale: s })
      const canvas = canvasRef.current
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      const task = page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D & { canvas: HTMLCanvasElement }, viewport, canvas: canvas as unknown as HTMLCanvasElement })
      renderTaskRef.current = task
      await task.promise
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'RenderingCancelledException') {
        console.error('PDF render error', e)
      }
    } finally {
      setPageLoading(false)
    }
  }, [])

  const loadPdf = useCallback(async (file: File) => {
    // Cancel any in-flight render before touching pdfDoc state
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel() } catch {}
      renderTaskRef.current = null
    }
    setPdfLoading(true)
    setPdfError(null)
    setPdfDoc(null)
    setTotalPages(0)
    setPageNum(1)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      setTotalPages(doc.numPages)
      setPdfDoc(doc)
      // renderPage is triggered by the useEffect below when pdfDoc changes
    } catch (e) {
      setPdfError('Failed to load PDF. Make sure it is a valid PDF file.')
      console.error(e)
    } finally {
      setPdfLoading(false)
    }
  }, [])

  // Single source of truth: render whenever doc/page/scale changes
  useEffect(() => {
    if (pdfDoc) renderPage(pdfDoc, pageNum, scale)
  }, [pdfDoc, pageNum, scale, renderPage])

  const goTo = useCallback((n: number) => setPageNum(n), [])
  const zoomIn = useCallback(() => setZoomIndex(i => Math.min(ZOOM_LEVELS.length - 1, i + 1)), [])
  const zoomOut = useCallback(() => setZoomIndex(i => Math.max(0, i - 1)), [])

  return {
    pdfDoc, totalPages, pageNum, scale, zoomIndex,
    pageLoading, pdfLoading, pdfError,
    canvasRef, loadPdf, goTo, zoomIn, zoomOut,
  }
}

// ── useCropSelection hook ────────────────────────────────────────────────────
function useCropSelection(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [dragging, setDragging] = useState(false)
  const [rect, setRect] = useState<CropRect | null>(null)
  // Keep a ref in sync so cropToBlob always reads the latest value
  // regardless of closure staleness
  const rectRef = useRef<CropRect | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const getCanvasPos = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const bounds = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (e.clientY - bounds.top) * (canvas.height / bounds.height),
    }
  }

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const pos = getCanvasPos(e)
    startRef.current = pos
    rectRef.current = null
    setRect(null)
    setDragging(true)
  }

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging || !startRef.current) return
    const pos = getCanvasPos(e)
    const r = {
      x: Math.min(startRef.current.x, pos.x),
      y: Math.min(startRef.current.y, pos.y),
      w: Math.abs(pos.x - startRef.current.x),
      h: Math.abs(pos.y - startRef.current.y),
    }
    rectRef.current = r
    setRect(r)
  }

  const onMouseUp = () => setDragging(false)

  // Reads from rectRef — always has the latest value, no stale closure issue
  const cropToBlob = useCallback((): Promise<Blob | null> => {
    return new Promise(resolve => {
      const canvas = canvasRef.current
      const r = rectRef.current
      if (!canvas || !r || r.w < 4 || r.h < 4) return resolve(null)
      const offscreen = document.createElement('canvas')
      offscreen.width = r.w
      offscreen.height = r.h
      const ctx = offscreen.getContext('2d')!
      ctx.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
      offscreen.toBlob(b => resolve(b), 'image/png')
    })
  }, [canvasRef])

  const clearRect = () => {
    rectRef.current = null
    setRect(null)
  }

  return { rect, dragging, onMouseDown, onMouseMove, onMouseUp, cropToBlob, clearRect }
}

// ── CroppedItemCard ──────────────────────────────────────────────────────────
function CroppedItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: CroppedItem
  onChange: (id: string, patch: Partial<CroppedItem>) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
      <div className="relative bg-stone-50">
        <img src={item.dataUrl} alt="crop" className="w-full max-h-44 object-contain p-2" />
        <button
          onClick={() => onRemove(item.id)}
          className="absolute top-1 right-1 p-1 bg-white rounded-lg shadow text-stone-400 hover:text-red-500"
          title="Remove"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <span className="absolute bottom-1 left-1 text-[9px] bg-black/40 text-white rounded px-1 py-0.5">
          p.{item.pageNum}
        </span>
      </div>

      <div className="p-2.5 space-y-2">
        {/* Subject */}
        <select
          value={item.subject}
          onChange={e => onChange(item.id, { subject: e.target.value })}
          className="w-full text-xs border border-stone-300 rounded px-2 py-1 bg-white"
        >
          {IGCSE_SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>

        {/* Category */}
        <div className="flex gap-1 flex-wrap">
          {(Object.keys(CATEGORY_LABELS) as DiagramCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => onChange(item.id, { category: cat })}
              className={`px-2 py-0.5 text-[10px] rounded font-medium border transition-colors ${
                item.category === cat
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-stone-500 border-stone-300 hover:border-emerald-400'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Description */}
        <input
          value={item.description}
          onChange={e => onChange(item.id, { description: e.target.value })}
          placeholder="Description…"
          className="w-full text-xs border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />

        {/* Topics */}
        <input
          value={item.topics}
          onChange={e => onChange(item.id, { topics: e.target.value })}
          placeholder="Topics (comma-separated)"
          className="w-full text-xs border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />

        {/* Tags */}
        <input
          value={item.tags}
          onChange={e => onChange(item.id, { tags: e.target.value })}
          placeholder="Tags (comma-separated)"
          className="w-full text-xs border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
      </div>
    </div>
  )
}

// ── MathText: renders markdown + KaTeX inline ────────────────────────────────
function MathText({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <span>{children}</span>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

// ── ParsedQuestionCard ────────────────────────────────────────────────────────
function ParsedQuestionCard({
  item,
  onChange,
  onRemove,
  saveStatus,
}: {
  item: ParsedPdfQuestion
  onChange: (id: string, patch: Partial<ParsedPdfQuestion>) => void
  onRemove: (id: string) => void
  saveStatus?: 'pending' | 'done' | 'error'
}) {
  const [preview, setPreview] = useState(false)

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden bg-white text-xs relative">
      {/* Status overlay */}
      {saveStatus === 'done' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 rounded-xl">
          <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
            <Check className="w-4 h-4" /> Saved
          </div>
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 rounded-xl">
          <div className="flex items-center gap-1.5 text-red-500 font-semibold">
            <AlertCircle className="w-4 h-4" /> Save failed
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-stone-50 border-b border-stone-100">
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            item.type === 'mcq' ? 'bg-violet-100 text-violet-700' :
            item.type === 'structured' ? 'bg-amber-100 text-amber-700' :
            'bg-blue-100 text-blue-700'
          }`}>{item.type}</span>
          <span className="text-stone-400">{item.marks}m</span>
          <span className="text-stone-400">·</span>
          <span className="text-stone-400">{item.assessmentObjective}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreview(p => !p)}
            className="p-1 text-stone-400 hover:text-emerald-600"
            title={preview ? 'Edit' : 'Preview math'}
          >
            {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onRemove(item.id)} className="p-1 text-stone-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-2.5 space-y-2">
        {/* Topic + marks row */}
        <div className="flex gap-1.5">
          <input
            value={item.topic}
            onChange={e => onChange(item.id, { topic: e.target.value })}
            placeholder="Topic"
            className="flex-1 border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <input
            type="number"
            min={1}
            max={20}
            value={item.marks}
            onChange={e => onChange(item.id, { marks: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-12 border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-center"
            title="Marks"
          />
        </div>

        {/* Type + AO */}
        <div className="flex gap-1.5">
          <select
            value={item.type}
            onChange={e => onChange(item.id, { type: e.target.value as ParsedPdfQuestion['type'] })}
            className="flex-1 border border-stone-300 rounded px-2 py-1 bg-white"
          >
            <option value="short_answer">Short answer</option>
            <option value="structured">Structured</option>
            <option value="mcq">MCQ</option>
          </select>
          <select
            value={item.assessmentObjective}
            onChange={e => onChange(item.id, { assessmentObjective: e.target.value as ParsedPdfQuestion['assessmentObjective'] })}
            className="w-20 border border-stone-300 rounded px-2 py-1 bg-white"
          >
            <option>AO1</option>
            <option>AO2</option>
            <option>AO3</option>
          </select>
        </div>

        {/* Question text */}
        <div>
          <label className="text-[10px] font-medium text-stone-500 mb-0.5 block">Question</label>
          {preview ? (
            <div className="border border-stone-200 rounded p-2 bg-stone-50 min-h-10 leading-relaxed">
              <MathText>{item.text}</MathText>
            </div>
          ) : (
            <textarea
              value={item.text}
              onChange={e => onChange(item.id, { text: e.target.value })}
              rows={3}
              placeholder="Question text… use $x^2$ for inline math, $$\frac{a}{b}$$ for display"
              className="w-full border border-stone-300 rounded px-2 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono leading-relaxed"
            />
          )}
        </div>

        {/* MCQ options */}
        {item.type === 'mcq' && (
          <div>
            <label className="text-[10px] font-medium text-stone-500 mb-0.5 block">Options (A–D)</label>
            <div className="space-y-1">
              {(['A','B','C','D'] as const).map((letter, i) => (
                <div key={letter} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-stone-400 w-4 shrink-0">{letter}</span>
                  <input
                    value={item.options?.[i] ?? ''}
                    onChange={e => {
                      const opts = [...(item.options ?? ['','','',''])]
                      opts[i] = e.target.value
                      onChange(item.id, { options: opts })
                    }}
                    className="flex-1 border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mark scheme */}
        <div>
          <label className="text-[10px] font-medium text-stone-500 mb-0.5 block">Mark scheme / Answer</label>
          {preview ? (
            <div className="border border-stone-200 rounded p-2 bg-stone-50 min-h-8 leading-relaxed">
              <MathText>{item.markScheme}</MathText>
            </div>
          ) : (
            <textarea
              value={item.markScheme}
              onChange={e => onChange(item.id, { markScheme: e.target.value })}
              rows={2}
              placeholder="Expected answer / mark scheme…"
              className="w-full border border-stone-300 rounded px-2 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono leading-relaxed"
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function PdfDiagramExtractor({ onClose, onUpload, onSaveQuestions, geminiApiKey }: Props) {
  const pdfFileRef = useRef<HTMLInputElement>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [mode, setMode] = useState<ExtractorMode>('diagrams')
  const [fullscreen, setFullscreen] = useState(false)

  // ── Diagram mode state ───────────────────────────────────────────────────
  const [crops, setCrops] = useState<CroppedItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, 'pending' | 'done' | 'error'>>({})

  // ── Question mode state ──────────────────────────────────────────────────
  const [qSubject, setQSubject] = useState(IGCSE_SUBJECTS[0])
  const [parsedQuestions, setParsedQuestions] = useState<ParsedPdfQuestion[]>([])
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [qSaveProgress, setQSaveProgress] = useState<Record<string, 'pending' | 'done' | 'error'>>({})
  const [savingQuestions, setSavingQuestions] = useState(false)
  const [parseSource, setParseSource] = useState<'page' | 'crop'>('page')

  const scrollRef = useRef<HTMLDivElement>(null)

  const pdf = usePdfRenderer()
  const crop = useCropSelection(pdf.canvasRef)

  // Capture crop on mouse up — only adds to crop list in Diagrams mode
  const handleMouseUp = useCallback(async () => {
    crop.onMouseUp()
    // In Questions/Selection mode the crop stays visible for Extract button — don't auto-add
    if (mode !== 'diagrams') return
    const blob = await crop.cropToBlob()
    if (!blob) return
    const dataUrl = URL.createObjectURL(blob)
    const newItem: CroppedItem = {
      id: uid(),
      dataUrl,
      blob,
      pageNum: pdf.pageNum,
      subject: IGCSE_SUBJECTS[0],
      description: '',
      category: 'diagram',
      topics: '',
      tags: '',
    }
    setCrops(prev => [...prev, newItem])
    crop.clearRect()
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }, [crop, pdf.pageNum, mode])

  const handlePdfFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) return
    setPdfFile(f)
    pdf.loadPdf(f)
    setCrops([])
    setParsedQuestions([])
  }

  // ── Get current page as PNG data URL ─────────────────────────────────────
  const getPageDataUrl = useCallback((): string | null => {
    const canvas = pdf.canvasRef.current
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  }, [pdf.canvasRef])

  // ── Get current crop as PNG data URL ─────────────────────────────────────
  const getCropDataUrl = useCallback(async (): Promise<string | null> => {
    const blob = await crop.cropToBlob()
    if (!blob) return null
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  }, [crop])

  // ── Parse questions with Gemini ───────────────────────────────────────────
  const handleParseQuestions = useCallback(async () => {
    if (!geminiApiKey) {
      setParseError('No Gemini API key set. Please add your key in API Settings.')
      return
    }
    setParseError(null)
    setParsing(true)
    try {
      let dataUrl: string | null = null
      if (parseSource === 'crop') {
        dataUrl = await getCropDataUrl()
        if (!dataUrl) {
          setParseError('No crop selected. Drag to select an area first, or switch to "Full page" mode.')
          setParsing(false)
          return
        }
      } else {
        dataUrl = getPageDataUrl()
        if (!dataUrl) {
          setParseError('No page rendered yet.')
          setParsing(false)
          return
        }
      }
      const results = await parsePdfQuestionsWithGemini(dataUrl, qSubject, geminiApiKey)
      if (results.length === 0) {
        setParseError('No questions found on this page. Try a different page or select a specific area.')
      } else {
        setParsedQuestions(prev => [...prev, ...results])
        setQSaveProgress({})
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
        }, 100)
      }
    } catch (e: unknown) {
      setParseError(`Parse failed: ${(e as Error).message ?? 'Unknown error'}`)
    } finally {
      setParsing(false)
    }
  }, [geminiApiKey, parseSource, getCropDataUrl, getPageDataUrl, qSubject])

  // ── Update / remove parsed questions ─────────────────────────────────────
  const updateParsedQ = (id: string, patch: Partial<ParsedPdfQuestion>) => {
    setParsedQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
  }

  const removeParsedQ = (id: string) => {
    setParsedQuestions(prev => prev.filter(q => q.id !== id))
    setQSaveProgress(p => { const n = { ...p }; delete n[id]; return n })
  }

  // ── Save parsed questions to Firestore ────────────────────────────────────
  const handleSaveQuestions = useCallback(async () => {
    if (!onSaveQuestions || parsedQuestions.length === 0) return
    setSavingQuestions(true)
    const progress: Record<string, 'pending' | 'done' | 'error'> = {}
    parsedQuestions.forEach(q => { progress[q.id] = 'pending' })
    setQSaveProgress({ ...progress })

    for (const q of parsedQuestions) {
      try {
        const item: Omit<QuestionItem, 'id'> = {
          text: q.text,
          answer: q.markScheme,
          markScheme: q.markScheme,
          marks: q.marks,
          commandWord: q.commandWord,
          type: q.type,
          hasDiagram: false,
          options: q.type === 'mcq' ? q.options : undefined,
          assessmentObjective: q.assessmentObjective,
          difficultyStars: 1,
          syllabusObjective: q.topic,
        }
        await onSaveQuestions([item], qSubject, q.topic)
        setQSaveProgress(p => ({ ...p, [q.id]: 'done' }))
      } catch {
        setQSaveProgress(p => ({ ...p, [q.id]: 'error' }))
      }
    }
    setSavingQuestions(false)
  }, [parsedQuestions, onSaveQuestions, qSubject])

  const allQSaved = parsedQuestions.length > 0 &&
    Object.values(qSaveProgress).length > 0 &&
    Object.values(qSaveProgress).every(s => s === 'done')

  const updateCrop = (id: string, patch: Partial<CroppedItem>) => {
    setCrops(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  const removeCrop = (id: string) => {
    setCrops(prev => {
      const item = prev.find(c => c.id === id)
      if (item) URL.revokeObjectURL(item.dataUrl)
      return prev.filter(c => c.id !== id)
    })
  }

  const handleUploadAll = async () => {
    if (crops.length === 0) return
    setUploading(true)
    const progress: Record<string, 'pending' | 'done' | 'error'> = {}
    crops.forEach(c => { progress[c.id] = 'pending' })
    setUploadProgress({ ...progress })

    for (const item of crops) {
      try {
        const filename = `diagram_p${item.pageNum}_${Date.now()}.png`
        const file = blobToFile(item.blob, filename)
        await onUpload(file, item.subject, {
          description: item.description,
          category: item.category,
          topics: item.topics.split(',').map(t => t.trim()).filter(Boolean),
          tags: item.tags.split(',').map(t => t.trim()).filter(Boolean),
        })
        setUploadProgress(p => ({ ...p, [item.id]: 'done' }))
      } catch {
        setUploadProgress(p => ({ ...p, [item.id]: 'error' }))
      }
    }
    setUploading(false)
  }

  const allDone = crops.length > 0 && Object.values(uploadProgress).every(s => s === 'done')

  // Compute overlay rect in CSS % for the crop indicator overlay
  const overlayStyle = (() => {
    const canvas = pdf.canvasRef.current
    if (!crop.rect || !canvas) return null
    const { x, y, w, h } = crop.rect
    return {
      left: `${(x / canvas.width) * 100}%`,
      top: `${(y / canvas.height) * 100}%`,
      width: `${(w / canvas.width) * 100}%`,
      height: `${(h / canvas.height) * 100}%`,
    }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/50" onClick={onClose}>
      <div
        className={`relative flex flex-col bg-white shadow-2xl overflow-hidden transition-all duration-200 ${
          fullscreen
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-6xl mx-auto my-4 rounded-2xl'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mode tabs */}
            <div className="flex rounded-lg border border-stone-200 overflow-hidden">
              <button
                onClick={() => setMode('diagrams')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'diagrams'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Diagrams
              </button>
              <button
                onClick={() => setMode('questions')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-stone-200 ${
                  mode === 'questions'
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Questions
              </button>
            </div>
            {pdfFile && (
              <span className="text-xs text-stone-400 truncate max-w-48">{pdfFile.name}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Diagram mode save button */}
            {mode === 'diagrams' && crops.length > 0 && !allDone && (
              <button
                onClick={handleUploadAll}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {uploading
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                  : <><Upload className="w-3 h-3" /> Save {crops.length} diagram{crops.length > 1 ? 's' : ''}</>
                }
              </button>
            )}
            {mode === 'diagrams' && allDone && (
              <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700">
                <Check className="w-3 h-3" /> Done
              </button>
            )}

            {/* Question mode save button */}
            {mode === 'questions' && parsedQuestions.length > 0 && !allQSaved && onSaveQuestions && (
              <button
                onClick={handleSaveQuestions}
                disabled={savingQuestions}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {savingQuestions
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                  : <><Check className="w-3 h-3" /> Save {parsedQuestions.length} question{parsedQuestions.length > 1 ? 's' : ''}</>
                }
              </button>
            )}
            {mode === 'questions' && allQSaved && (
              <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-700">
                <Check className="w-3 h-3" /> Done
              </button>
            )}

            <button
              onClick={() => setFullscreen(f => !f)}
              className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Left: PDF viewer ── */}
          <div className="flex flex-col flex-1 overflow-hidden border-r border-stone-200">

            {/* PDF toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-100 bg-stone-50 shrink-0 flex-wrap">
              {/* File picker */}
              <button
                onClick={() => pdfFileRef.current?.click()}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white border border-stone-300 rounded-lg hover:border-emerald-400 font-medium text-stone-600"
              >
                <Upload className="w-3.5 h-3.5" />
                {pdfFile ? 'Change PDF' : 'Open PDF'}
              </button>
              <input
                ref={pdfFileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfFile(f) }}
              />

              {pdf.totalPages > 0 && (
                <>
                  {/* Page nav */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => pdf.goTo(Math.max(1, pdf.pageNum - 1))}
                      disabled={pdf.pageNum <= 1 || pdf.pageLoading}
                      className="p-1 rounded hover:bg-stone-200 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-stone-600 min-w-16 text-center">
                      {pdf.pageNum} / {pdf.totalPages}
                    </span>
                    <button
                      onClick={() => pdf.goTo(Math.min(pdf.totalPages, pdf.pageNum + 1))}
                      disabled={pdf.pageNum >= pdf.totalPages || pdf.pageLoading}
                      className="p-1 rounded hover:bg-stone-200 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Zoom */}
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={pdf.zoomOut} disabled={pdf.zoomIndex === 0} className="p-1 rounded hover:bg-stone-200 disabled:opacity-30">
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-stone-500 min-w-10 text-center">{Math.round(ZOOM_LEVELS[pdf.zoomIndex] * 100)}%</span>
                    <button onClick={pdf.zoomIn} disabled={pdf.zoomIndex === ZOOM_LEVELS.length - 1} className="p-1 rounded hover:bg-stone-200 disabled:opacity-30">
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Canvas area */}
            <div className="flex-1 overflow-auto bg-stone-100 relative">
              {/* Drop zone (no PDF loaded) */}
              {!pdfFile && !pdf.pdfLoading && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-400 cursor-pointer hover:bg-stone-200/50 transition-colors"
                  onClick={() => pdfFileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const f = e.dataTransfer.files[0]
                    if (f) handlePdfFile(f)
                  }}
                >
                  <Upload className="w-10 h-10" />
                  <p className="text-sm font-medium">Click or drop a PDF here</p>
                  <p className="text-xs">Then drag on the page to select diagram areas</p>
                </div>
              )}

              {/* Loading spinner */}
              {(pdf.pdfLoading || pdf.pageLoading) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              )}

              {/* Error */}
              {pdf.pdfError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-red-500">{pdf.pdfError}</p>
                </div>
              )}

              {/* Hint banner */}
              {pdfFile && !pdf.pdfLoading && !pdf.pdfError && mode === 'diagrams' && (
                <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-700">
                  <Crop className="w-3 h-3" />
                  Drag on the page to select a diagram area
                </div>
              )}
              {pdfFile && !pdf.pdfLoading && !pdf.pdfError && mode === 'questions' && (
                <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border-b border-violet-100 text-xs text-violet-700">
                  <Sparkles className="w-3 h-3" />
                  {parseSource === 'crop'
                    ? 'Drag to select a question area, then click Extract'
                    : 'Navigate to a page with questions, then click Extract'}
                </div>
              )}

              {/* Canvas wrapper — crop interaction layer */}
              <div
                className="relative inline-block cursor-crosshair select-none"
                onMouseDown={crop.onMouseDown}
                onMouseMove={crop.onMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <canvas ref={pdf.canvasRef} className="block" />

                {/* Live crop rect overlay */}
                {overlayStyle && (
                  <div
                    className="absolute pointer-events-none border-2 border-emerald-500 bg-emerald-400/10"
                    style={overlayStyle}
                  />
                )}
              </div>
            </div>
          </div>

          {/* ── Right panel — switches by mode ── */}
          <div className="w-96 flex flex-col shrink-0 overflow-hidden">

            {/* ── Diagrams panel ── */}
            {mode === 'diagrams' && (
              <>
                <div className="px-4 py-2 border-b border-stone-100 bg-stone-50 shrink-0 flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-600">Cropped ({crops.length})</span>
                  {crops.length > 0 && (
                    <button
                      onClick={() => { crops.forEach(c => URL.revokeObjectURL(c.dataUrl)); setCrops([]); setUploadProgress({}) }}
                      className="text-[10px] text-stone-400 hover:text-red-500"
                    >Clear all</button>
                  )}
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                  {crops.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-stone-300">
                      <Crop className="w-8 h-8" />
                      <p className="text-xs text-center">Drag on the PDF to crop diagrams</p>
                    </div>
                  )}
                  {crops.map(item => (
                    <div key={item.id} className="relative">
                      {uploadProgress[item.id] === 'done' && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded-xl">
                          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold"><Check className="w-4 h-4" /> Saved</div>
                        </div>
                      )}
                      {uploadProgress[item.id] === 'error' && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded-xl">
                          <p className="text-xs text-red-500 font-medium">Upload failed</p>
                        </div>
                      )}
                      <CroppedItemCard item={item} onChange={updateCrop} onRemove={removeCrop} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Questions panel ── */}
            {mode === 'questions' && (
              <>
                {/* Controls */}
                <div className="px-3 py-2 border-b border-stone-100 bg-stone-50 shrink-0 space-y-2">
                  {/* Subject */}
                  <select
                    value={qSubject}
                    onChange={e => setQSubject(e.target.value)}
                    className="w-full text-xs border border-stone-300 rounded px-2 py-1.5 bg-white"
                  >
                    {IGCSE_SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>

                  {/* Source toggle */}
                  <div className="flex rounded-lg border border-stone-200 overflow-hidden text-xs">
                    <button
                      onClick={() => setParseSource('page')}
                      className={`flex-1 py-1 font-medium transition-colors ${parseSource === 'page' ? 'bg-violet-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
                    >Full page</button>
                    <button
                      onClick={() => setParseSource('crop')}
                      className={`flex-1 py-1 font-medium border-l border-stone-200 transition-colors ${parseSource === 'crop' ? 'bg-violet-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
                    >Selection</button>
                  </div>

                  {/* Extract button */}
                  <button
                    onClick={handleParseQuestions}
                    disabled={parsing || !pdfFile}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {parsing
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Extracting…</>
                      : <><Sparkles className="w-3 h-3" /> Extract questions</>
                    }
                  </button>

                  {/* Error */}
                  {parseError && (
                    <div className="flex items-start gap-1.5 text-[10px] text-red-600 bg-red-50 rounded p-2">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      {parseError}
                    </div>
                  )}

                  {!geminiApiKey && (
                    <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 rounded p-2">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      Gemini API key required. Add it in API Settings.
                    </div>
                  )}
                </div>

                {/* Parsed questions list */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-stone-100 shrink-0">
                  <span className="text-xs font-semibold text-stone-600">Questions ({parsedQuestions.length})</span>
                  {parsedQuestions.length > 0 && (
                    <button
                      onClick={() => { setParsedQuestions([]); setQSaveProgress({}) }}
                      className="text-[10px] text-stone-400 hover:text-red-500"
                    >Clear all</button>
                  )}
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                  {parsedQuestions.length === 0 && !parsing && (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-stone-300">
                      <FileText className="w-8 h-8" />
                      <p className="text-xs text-center">Click "Extract questions" to parse the current page</p>
                    </div>
                  )}
                  {parsedQuestions.map(q => (
                    <ParsedQuestionCard
                      key={q.id}
                      item={q}
                      onChange={updateParsedQ}
                      onRemove={removeParsedQ}
                      saveStatus={qSaveProgress[q.id]}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
