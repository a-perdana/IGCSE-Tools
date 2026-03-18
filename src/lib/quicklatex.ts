/**
 * QuickLaTeX client — renders TikZ code to a PNG image via the proxy.
 * In production: /api/quicklatex (Vercel Edge Function).
 * In dev: /api/quicklatex (Vite configureServer middleware in vite.config.ts).
 */

interface QuickLaTeXResult {
  url: string
  width: number
  height: number
}

// Simple in-memory cache keyed by TikZ code
const cache = new Map<string, QuickLaTeXResult>()

/**
 * Wraps bare TikZ body in \begin{tikzpicture}...\end{tikzpicture} if needed.
 */
function wrapTikz(code: string): string {
  const trimmed = code.trim()
  if (trimmed.startsWith('\\begin{tikzpicture}')) return trimmed
  return `\\begin{tikzpicture}\n${trimmed}\n\\end{tikzpicture}`
}

/**
 * Fixes common AI TikZ generation mistakes before sending to QuickLaTeX.
 */
function sanitizeTikz(code: string): string {
  return code
    // AI sometimes produces literal \n instead of actual newlines
    .replace(/\\n/g, '\n')
    // Extra escaped backslashes: \\\\draw → \\draw (AI double-escapes in JSON context)
    .replace(/\\\\(draw|node|fill|coordinate|path|foreach|pgf|text|begin|end|tikz|usepackage|usetikzlibrary|def|let|scope)\b/g, '\\$1')
    // Stray +- or -+ sequences that aren't valid TikZ
    .replace(/\+\s*-\s*\(/g, '(')
    .replace(/-\s*\+\s*\(/g, '(')
    // Trailing + before semicolons
    .replace(/\+\s*;/g, ';')
    // Ensure \begin{tikzpicture} lines end properly
    .trim()
}

/**
 * Renders TikZ code and returns a PNG URL hosted on quicklatex.com.
 * Throws if rendering fails.
 */
export async function renderTikz(code: string): Promise<QuickLaTeXResult> {
  const formula = wrapTikz(sanitizeTikz(code))
  const cached = cache.get(formula)
  if (cached) return cached

  const res = await fetch('/api/quicklatex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formula }),
  })

  if (!res.ok) throw new Error(`QuickLaTeX proxy error: HTTP ${res.status}`)

  const text = await res.text()
  // QuickLaTeX puts URL, status, and dimensions on the same line:
  //   "https://quicklatex.com/.../ql_xxx.png 0 207 202"
  // Find the line containing the image URL
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const urlLine = lines.find(l => l.startsWith('http'))
  if (!urlLine) throw new Error('QuickLaTeX returned no image URL')

  // The URL is only the first token — status and dimensions follow on the same line
  const url = urlLine.split(/\s+/)[0]

  // If the URL points to QuickLaTeX's own error image, the render failed
  if (url.includes('/error.png')) {
    const msg = lines.filter(l => !l.startsWith('http') && !/^\d/.test(l)).join(' ').trim()
    throw new Error(`QuickLaTeX: ${msg || 'render error'}`)
  }

  // Dimensions: last two numbers on the URL line (e.g. "207 202")
  const dimMatch = urlLine.match(/(\d+)\s+(\d+)\s*$/)
  const w = dimMatch ? parseInt(dimMatch[1]) : 400
  const h = dimMatch ? parseInt(dimMatch[2]) : 300
  const result: QuickLaTeXResult = { url, width: isNaN(w) ? 400 : w, height: isNaN(h) ? 300 : h }
  cache.set(formula, result)
  return result
}
