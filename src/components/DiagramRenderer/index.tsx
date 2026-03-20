import React, { useEffect, useRef } from 'react'
import type { TikzSpec } from '../../lib/types'

declare global {
  interface Window {
    TikzJax?: any
  }
}

export function DiagramRenderer({ spec }: { spec: TikzSpec | undefined | null }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!spec?.code || !containerRef.current) return

    const container = containerRef.current

    // Extract tikzpicture block
    const blockMatch = spec.code.match(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/)
    const tikzBlock = blockMatch ? blockMatch[0] : spec.code

    // Extract usetikzlibrary calls
    const libMatches = [...spec.code.matchAll(/\\usetikzlibrary\{([^}]+)\}/g)]
    const libs = [...new Set(libMatches.flatMap(m => m[1].split(',').map(s => s.trim()).filter(Boolean)))]
    const libLine = libs.length > 0 ? `\\usetikzlibrary{${libs.join(',')}}` : ''

    const fullCode = `${libLine}\n${tikzBlock}`

    // TikZJax renders <script type="text/tikz"> elements
    container.innerHTML = ''
    const script = document.createElement('script')
    script.type = 'text/tikz'
    script.textContent = fullCode
    container.appendChild(script)

    // Trigger TikZJax to process the new element
    if (window.TikzJax) {
      // TikZJax auto-processes on DOMContentLoaded; for dynamic content dispatch a custom event
      document.dispatchEvent(new Event('tikzjax-load-finished'))
    }
  }, [spec?.code])

  if (!spec) return null

  return (
    <div className="my-3 border-t-2 border-b-2 border-violet-100 py-3 bg-violet-50/30 rounded-sm">
      <p className="text-xs font-semibold text-violet-400 mb-2 flex items-center gap-1.5 px-1">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-300 inline-block" />
        Diagram
      </p>
      <div
        ref={containerRef}
        className="px-1 flex justify-center"
        style={{ maxWidth: spec.maxWidth ? `${spec.maxWidth}px` : '360px', margin: '0 auto' }}
      />
    </div>
  )
}
