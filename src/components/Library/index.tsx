import React, { useState } from 'react'
import { Folder as FolderIcon, Trash2, Plus, Library as LibraryIcon, Pencil, X, Check } from 'lucide-react'
import type { Assessment, Question, Folder } from '../../lib/types'

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
  selectedFolderId: string | null | undefined
  onSelectFolder: (id: string | null | undefined) => void
}

export function Library({
  assessments, questions, folders, loading,
  onSelect, onDeleteAssessment, onMoveAssessment, onRenameAssessment,
  onDeleteQuestion, onMoveQuestion,
  onCreateFolder, onDeleteFolder,
  selectedFolderId, onSelectFolder,
}: Props) {
  const [bankView, setBankView] = useState<'assessments' | 'questions'>('assessments')
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  return (
    <div className="flex h-full">
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
            <button
              onClick={() => onSelectFolder(f.id)}
              className={`flex-1 text-left text-xs px-2 py-1.5 rounded flex items-center gap-1 ${selectedFolderId === f.id ? 'bg-emerald-100 text-emerald-800 font-medium' : 'hover:bg-stone-100 text-stone-600'}`}
            >
              <FolderIcon className="w-3.5 h-3.5" /> {f.name}
            </button>
            <button
              onClick={() => onDeleteFolder(f.id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setBankView('assessments')}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${bankView === 'assessments' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Assessments ({assessments.length})
          </button>
          <button
            onClick={() => setBankView('questions')}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${bankView === 'questions' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Questions ({questions.length})
          </button>
        </div>

        {loading && <div className="text-stone-400 text-sm">Loading...</div>}

        {bankView === 'assessments' && (
          <div className="grid grid-cols-1 gap-3">
            {assessments.map(a => (
              <div key={a.id} className="border border-stone-200 rounded-lg p-3 hover:border-emerald-300 bg-white">
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
                        <div className="text-sm font-medium text-stone-800">{a.topic}</div>
                        <div className="text-xs text-stone-500">{a.subject} · {a.difficulty} · {a.questions.length}q</div>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setRenamingId(a.id); setRenameValue(a.topic) }} className="p-1 text-stone-400 hover:text-stone-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <select
                      value={a.folderId ?? ''}
                      onChange={e => onMoveAssessment(a.id, e.target.value || null)}
                      className="text-xs border border-stone-200 rounded px-1 py-0.5 text-stone-600"
                    >
                      <option value="">No folder</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <button onClick={() => onDeleteAssessment(a.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
            {assessments.length === 0 && !loading && (
              <div className="text-stone-400 text-sm text-center py-8">No assessments saved yet.</div>
            )}
          </div>
        )}

        {bankView === 'questions' && (
          <div className="grid grid-cols-1 gap-2">
            {questions.map(q => (
              <div key={q.id} className="border border-stone-200 rounded p-2 bg-white flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-stone-700 truncate">{q.text.replace(/\*\*/g, '').substring(0, 120)}...</div>
                  <div className="text-xs text-stone-400">{q.subject} · {q.marks}m · {q.commandWord}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    value={q.folderId ?? ''}
                    onChange={e => onMoveQuestion(q.id, e.target.value || null)}
                    className="text-xs border border-stone-200 rounded px-1 py-0.5 text-stone-600"
                  >
                    <option value="">No folder</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <button onClick={() => onDeleteQuestion(q.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
            {questions.length === 0 && !loading && (
              <div className="text-stone-400 text-sm text-center py-8">No questions saved yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
