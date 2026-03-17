import { describe, it, expect } from 'vitest'
import { parseSVGSafe, normalizeSvgMarkdown } from '../svg'

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

describe('normalizeSvgMarkdown', () => {
  it('wraps raw svg blocks with fenced svg markdown', () => {
    const input = 'Question text\n<svg xmlns="http://www.w3.org/2000/svg"></svg>\nMore text'
    const result = normalizeSvgMarkdown(input)
    expect(result).toContain('```svg')
    expect(result).toContain('</svg>\n```')
  })

  it('fixes malformed svg prefix like svg<svg', () => {
    const input = 'svg<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    const result = normalizeSvgMarkdown(input)
    expect(result).not.toContain('svg<svg')
    expect(result).toContain('<svg xmlns=')
  })
})
