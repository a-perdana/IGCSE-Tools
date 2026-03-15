import React, { useRef } from 'react'
import { Bold, Italic, List, ListOrdered, Minus } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minRows?: number
}

export function RichEditor({ value, onChange, placeholder, minRows = 4 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const wrap = (before: string, after: string) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || 'text'
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    }, 0)
  }

  const prefixLines = (prefix: string) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const lines = value.split('\n')
    let charCount = 0
    const result = lines.map(line => {
      const lineStart = charCount
      charCount += line.length + 1
      if (lineStart <= end && charCount > start) return prefix + line
      return line
    })
    onChange(result.join('\n'))
    setTimeout(() => el.focus(), 0)
  }

  const insertAtCursor = (text: string) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const next = value.slice(0, start) + text + value.slice(start)
    onChange(next)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + text.length, start + text.length) }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); wrap('**', '**') }
      if (e.key === 'i') { e.preventDefault(); wrap('*', '*') }
    }
  }

  const tools = [
    { icon: <Bold className="w-3.5 h-3.5" />, title: 'Bold (Ctrl+B)', action: () => wrap('**', '**') },
    { icon: <Italic className="w-3.5 h-3.5" />, title: 'Italic (Ctrl+I)', action: () => wrap('*', '*') },
    { icon: <List className="w-3.5 h-3.5" />, title: 'Bullet list', action: () => prefixLines('- ') },
    { icon: <ListOrdered className="w-3.5 h-3.5" />, title: 'Numbered list', action: () => prefixLines('1. ') },
    { icon: <Minus className="w-3.5 h-3.5" />, title: 'Horizontal rule', action: () => insertAtCursor('\n\n---\n\n') },
  ]

  return (
    <div className="border border-stone-300 rounded-lg overflow-hidden focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400">
      <div className="flex gap-0.5 px-2 py-1 bg-stone-50 border-b border-stone-200">
        {tools.map((t, i) => (
          <button
            key={i}
            type="button"
            title={t.title}
            onMouseDown={e => { e.preventDefault(); t.action() }}
            className="p-1 rounded text-stone-500 hover:bg-stone-200 hover:text-stone-700"
          >
            {t.icon}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={minRows}
        className="w-full px-3 py-2 text-sm font-mono resize-y bg-white outline-none"
      />
    </div>
  )
}
