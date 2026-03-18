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
  // Trim each line and remove blanks (handles \r\n and leading/trailing blank lines)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // QuickLaTeX response lines (order may vary across versions):
  //   one line is "0" (success) or a non-zero error code
  //   one line is the image URL (starts with "http")
  //   one line is "width height" (two integers separated by space)
  const url = lines.find(l => l.startsWith('http'))
  if (!url) throw new Error('QuickLaTeX returned no image URL')

  // If the URL points to QuickLaTeX's own error image, the render failed
  if (url.includes('/error.png')) {
    const msg = lines.filter(l => !l.startsWith('http') && !/^\d/.test(l)).join(' ').trim()
    throw new Error(`QuickLaTeX: ${msg || 'render error'}`)
  }

  const dimLine = lines.find(l => /^\d+ \d+$/.test(l)) ?? '400 300'
  const [w, h] = dimLine.split(' ').map(Number)
  const result: QuickLaTeXResult = { url, width: isNaN(w) ? 400 : w, height: isNaN(h) ? 300 : h }
  cache.set(formula, result)
  return result
}
