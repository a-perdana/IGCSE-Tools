import { describe, it, expect } from 'vitest'
import { parseSVGSafe } from '../svg'

describe('parseSVGSafe', () => {
  it('returns outerHTML for valid SVG', () => {
    const svgString = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>'
    const result = parseSVGSafe(svgString)
    expect(result).not.toBeNull()
    expect(result).toContain('<circle')
  })

  it('returns null for invalid SVG', () => {
    const invalid = '<svg><unclosed'
    const result = parseSVGSafe(invalid)
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseSVGSafe('')).toBeNull()
  })

  it('handles SVG with nested elements', () => {
    const nested = '<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="10" height="10"/></g></svg>'
    const result = parseSVGSafe(nested)
    expect(result).not.toBeNull()
    expect(result).toContain('<rect')
  })
})
