function stripMarkdownFences(text: string): string {
  const cleaned = text.trim()
  if (!cleaned.startsWith('```')) return cleaned
  return cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
}

function removeTrailingCommas(candidate: string): string {
  return candidate.replace(/,\s*([}\]])/g, '$1')
}

/** Models sometimes emit LaTeX inside JSON strings with single backslashes
 *  (e.g. "\frac{1}{2}" instead of "\\frac{1}{2}"), which JSON.parse turns
 *  into control chars like form-feed. Pre-escape common LaTeX commands. */
function protectLatexBackslashes(candidate: string): string {
  const cmd =
    '(?:frac|sqrt|text|mathrm|mathbf|mathit|left|right|circ|degree|times|cdot|pm|mp|leq|geq|neq|approx|equiv|sim|sum|int|prod|lim|infty|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|chi|psi|omega|Gamma|Lambda|Sigma|Phi|Omega|vec|hat|bar|tilde|overline|underline|angle|triangle|perp|parallel|therefore|because)'
  const re = new RegExp(`(?<!\\\\)\\\\(${cmd})\\b`, 'g')
  return candidate.replace(re, '\\\\$1')
}

export function parseJsonWithRecovery<T = any>(text: string, source = 'model'): T {
  const cleaned = stripMarkdownFences(text)
  const candidates: string[] = [cleaned]

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end > start) candidates.push(cleaned.substring(start, end + 1))

  for (const c of candidates) {
    const normalized = protectLatexBackslashes(removeTrailingCommas(c))
    try {
      return JSON.parse(normalized) as T
    } catch {
      // try next candidate
    }
  }

  const e: any = new Error(`Invalid JSON response from ${source}`)
  e.status = 422
  e.type = 'invalid_response'
  e.context = cleaned.substring(Math.max(0, cleaned.length - 500))
  throw e
}
