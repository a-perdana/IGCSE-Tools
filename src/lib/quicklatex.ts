/**
 * LaTeX render client — sends TikZ code to /api/latex proxy
 * (Vercel Edge Function → Railway pdflatex renderer).
 */

interface RenderResult {
  url: string;
  width: number;
  height: number;
}

const cache = new Map<string, RenderResult>();

function sanitize(code: string): string {
  // Strip markdown code fences
  const fenced = code.match(/```(?:latex|tex)?\s*([\s\S]*?)```/i)
  if (fenced) code = fenced[1]
  // Fix double-escaped backslashes from JSON context
  return code
    .replace(/\\n/g, '\n')
    .replace(/\\\\(draw|node|fill|filldraw|coordinate|path|begin|end|tikz|usetikzlibrary|usepackage|def|scope)\b/g, '\\$1')
    .trim()
}

export async function renderTikz(code: string): Promise<RenderResult> {
  const clean = sanitize(code)
  const cached = cache.get(clean)
  if (cached) return cached

  const res = await fetch('/api/latex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: clean }),
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`LaTeX render error: HTTP ${res.status}${msg ? ` — ${msg}` : ''}`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const result: RenderResult = { url, width: 400, height: 300 }
  cache.set(clean, result)
  return result
}
