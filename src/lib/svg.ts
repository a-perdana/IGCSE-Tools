/**
 * Safely parses an SVG string using DOMParser.
 * Returns the validated outerHTML, or null if the SVG is malformed.
 */
export function parseSVGSafe(svgString: string): string | null {
  if (!svgString.trim()) return null
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return null
  return doc.documentElement.outerHTML
}
