import React, { useRef, useState } from 'react'
import { BrainCircuit, Calculator, Loader2, Database, Trash2, Plus, KeyRound, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react'
import type { GenerationConfig, Resource } from '../../lib/types'
import { IGCSE_SUBJECTS, IGCSE_TOPICS, DIFFICULTY_LEVELS } from '../../lib/gemini'
import { estimateCostIDR, MODEL_PRICING } from '../../lib/pricing'

const QUESTION_TYPES = ['Mixed', 'Multiple Choice', 'Short Answer', 'Structured']
const MODELS = Object.keys(MODEL_PRICING)

interface Props {
  config: GenerationConfig
  onConfigChange: (patch: Partial<GenerationConfig>) => void
  onGenerate: () => void
  isGenerating: boolean
  isAuditing: boolean
  retryCount: number
  resources: Resource[]
  knowledgeBase: Resource[]
  onUploadResource: (file: File, subject: string) => void
  onAddToKB: (resource: Resource) => void
  onRemoveFromKB: (id: string) => void
  onDeleteResource: (resource: Resource) => void
  studentMode: boolean
  onStudentModeToggle: () => void
  syllabusContext: string
  onSyllabusContextChange: (v: string) => void
  apiKey: string
  onApiKeyChange: (v: string) => void
  customModel: string
  onCustomModelChange: (v: string) => void
}

export function Sidebar({
  config, onConfigChange, onGenerate, isGenerating, isAuditing, retryCount,
  resources, knowledgeBase, onUploadResource, onAddToKB, onRemoveFromKB, onDeleteResource,
  studentMode, onStudentModeToggle, syllabusContext, onSyllabusContextChange,
  apiKey, onApiKeyChange, customModel, onCustomModelChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const inputTokens = Math.round(1500 + (syllabusContext.length / 4))
  const outputTokens = config.count * 600
  const costIDR = estimateCostIDR(config.model, inputTokens, outputTokens)

  return (
    <div className="w-80 border-r border-stone-200 bg-stone-50 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-stone-200">
        <h2 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-emerald-600" />
          Assessment Designer
        </h2>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Subject */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">Subject</label>
          <select
            value={config.subject}
            onChange={e => onConfigChange({ subject: e.target.value, topic: IGCSE_TOPICS[e.target.value][0] })}
            className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {IGCSE_SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Topic */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">Topic</label>
          <select
            value={config.topic}
            onChange={e => onConfigChange({ topic: e.target.value })}
            className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {(IGCSE_TOPICS[config.subject] ?? []).map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">Difficulty</label>
          <select
            value={config.difficulty}
            onChange={e => onConfigChange({ difficulty: e.target.value })}
            className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {DIFFICULTY_LEVELS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        {/* Count */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">
            Questions: {config.count}
          </label>
          <input
            type="range" min={1} max={20} value={config.count}
            onChange={e => onConfigChange({ count: Number(e.target.value) })}
            className="w-full accent-emerald-600"
          />
        </div>

        {/* Type */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">Question Type</label>
          <select
            value={config.type}
            onChange={e => onConfigChange({ type: e.target.value })}
            className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {QUESTION_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">AI Model</label>
          <select
            value={config.model}
            onChange={e => onConfigChange({ model: e.target.value })}
            className="w-full text-sm border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
          >
            {MODELS.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        {/* Calculator */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="calc" checked={config.calculator}
            onChange={e => onConfigChange({ calculator: e.target.checked })}
            className="accent-emerald-600"
          />
          <label htmlFor="calc" className="text-xs text-stone-600 flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" /> Calculator Allowed
          </label>
        </div>

        {/* Syllabus context */}
        <div>
          <label className="text-xs font-medium text-stone-600 mb-1 block">Syllabus Context (optional)</label>
          <textarea
            value={syllabusContext}
            onChange={e => onSyllabusContextChange(e.target.value)}
            placeholder="Paste specific learning objectives..."
            rows={3}
            className="w-full text-xs border border-stone-300 rounded-lg px-2 py-1.5 resize-none"
          />
        </div>

        {/* Cost estimate */}
        <div className="text-xs text-stone-500 bg-stone-100 rounded px-2 py-1.5">
          Estimated cost: ~Rp {costIDR.toLocaleString('id-ID')}
        </div>

        {/* Student mode */}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="student" checked={studentMode} onChange={onStudentModeToggle} className="accent-emerald-600" />
          <label htmlFor="student" className="text-xs text-stone-600">Student Mode (hide answers)</label>
        </div>

        {/* Generate button */}
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isAuditing ? 'Auditing...' : retryCount > 0 ? `Retry ${retryCount}/3...` : 'Generating...'}
            </>
          ) : (
            <>
              <BrainCircuit className="w-4 h-4" />
              Generate Assessment
            </>
          )}
        </button>

        {/* Knowledge Base */}
        <div className="border-t border-stone-200 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-600 flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> Knowledge Base
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) onUploadResource(file, config.subject)
                e.target.value = ''
              }}
            />
          </div>
          {resources.length === 0 && (
            <div className="text-xs text-stone-400 italic">No resources uploaded</div>
          )}
          {resources.map(r => {
            const inKB = knowledgeBase.some(x => x.id === r.id)
            return (
              <div key={r.id} className="flex items-center gap-1 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={inKB}
                  onChange={() => inKB ? onRemoveFromKB(r.id) : onAddToKB(r)}
                  className="accent-emerald-600"
                />
                <span className="flex-1 truncate text-stone-700">{r.name}</span>
                <button onClick={() => onDeleteResource(r)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
        {/* API Settings */}
        <div className="border-t border-stone-200 pt-3">
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className="flex items-center justify-between w-full text-xs font-medium text-stone-600 mb-2"
          >
            <span className="flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" /> API Settings
            </span>
            {settingsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {settingsOpen && (
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Gemini API Key</label>
                <div className="flex gap-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => onApiKeyChange(e.target.value)}
                    placeholder="AIza..."
                    className="flex-1 text-xs border border-stone-300 rounded-lg px-2 py-1.5 font-mono min-w-0"
                  />
                  <button
                    onClick={() => setShowApiKey(s => !s)}
                    className="p-1.5 text-stone-400 hover:text-stone-600 border border-stone-300 rounded-lg"
                    title={showApiKey ? 'Hide' : 'Show'}
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {apiKey && (
                  <p className="text-xs text-emerald-600 mt-0.5">Using your API key</p>
                )}
                {!apiKey && (
                  <p className="text-xs text-stone-400 mt-0.5">Using shared key (may hit rate limits)</p>
                )}
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Custom Model ID <span className="text-stone-400">(overrides dropdown)</span></label>
                <input
                  type="text"
                  value={customModel}
                  onChange={e => onCustomModelChange(e.target.value)}
                  placeholder="e.g. gemini-2.0-flash"
                  className="w-full text-xs border border-stone-300 rounded-lg px-2 py-1.5 font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
