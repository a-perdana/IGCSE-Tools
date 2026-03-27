import React, { useEffect, useState } from 'react'
import type { TikzSpec, RasterSpec } from '../../lib/types'
import { renderTikz } from '../../lib/quicklatex'

export function DiagramRenderer({ spec, onError }: { spec: TikzSpec | RasterSpec | undefined | null; onError?: (error: string) => void }) {
  const [state, setState] = useState<{ url?: string; error?: string; loading: boolean }>({ loading: false })

  const tikzSpec = spec?.diagramType === 'tikz' ? spec as TikzSpec : null

  useEffect(() => {
    if (!tikzSpec?.code) { setState({ loading: false }); return }
    let cancelled = false
    setState({ loading: true })
    renderTikz(tikzSpec.code)
      .then(result => { if (!cancelled) setState({ url: result.url, loading: false }) })
      .catch(err => { if (!cancelled) { const msg = String(err); setState({ error: msg, loading: false }); onError?.(msg) } })
    return () => { cancelled = true }
  }, [tikzSpec?.code])

  if (!spec) return null

  // ── Raster image (imported past-paper diagram) ────────────────────────────
  if (spec.diagramType === 'raster') {
    const raster = spec as RasterSpec
    return (
      <div className="my-3 border-t-2 border-b-2 border-amber-100 py-3 bg-amber-50/30 rounded-sm">
        <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 inline-block" />
          Diagram
        </p>
        <div className="px-1">
          <img
            src={raster.url}
            alt="diagram"
            style={{
              maxWidth: raster.maxWidth ? `${raster.maxWidth}px` : '640px',
              display: 'block',
              margin: '0 auto',
            }}
          />
        </div>
      </div>
    )
  }

  // ── TikZ diagram ──────────────────────────────────────────────────────────
  return (
    <div className="my-3 border-t-2 border-b-2 border-violet-100 py-3 bg-violet-50/30 rounded-sm">
      <p className="text-xs font-semibold text-violet-400 mb-2 flex items-center gap-1.5 px-1">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-300 inline-block" />
        Diagram
      </p>
      <div className="px-1">
        {state.loading && (
          <div className="flex items-center gap-2 py-4 px-2 text-sm text-violet-400">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Rendering diagram…
          </div>
        )}
        {state.error && (
          <div className="py-2 px-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500 mb-1">
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
              Diagram failed to render
            </div>
            <details className="text-xs text-stone-400">
              <summary className="cursor-pointer hover:text-stone-600">Show details</summary>
              <p className="font-mono whitespace-pre-wrap mt-1 text-red-400">{state.error}</p>
              <p className="mt-2 font-semibold text-stone-500">TikZ source:</p>
              <pre className="font-mono text-stone-400 whitespace-pre-wrap text-[10px] mt-1 max-h-40 overflow-y-auto">{tikzSpec?.code}</pre>
            </details>
          </div>
        )}
        {state.url && (
          <img
            src={state.url}
            alt="diagram"
            style={{
              maxWidth: tikzSpec?.maxWidth ? `${tikzSpec.maxWidth}px` : '640px',
              display: 'block',
              margin: '0 auto',
            }}
          />
        )}
      </div>
    </div>
  )
}
