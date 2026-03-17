import { describe, it, expect } from 'vitest'
import { estimateCostIDR, MODEL_PRICING } from '../pricing'

describe('estimateCostIDR', () => {
  it('calculates cost for flash model', () => {
    const cost = estimateCostIDR('gemini-2.5-flash', 1_000_000, 1_000_000)
    // (0.15 + 0.60) * 15800 = 11850
    expect(cost).toBe(11850)
  })

  it('calculates cost for pro model', () => {
    const cost = estimateCostIDR('gemini-2.5-pro', 1_000_000, 1_000_000)
    // (1.25 + 10.00) * 15800 = 177750
    expect(cost).toBe(177750)
  })

  it('falls back to default pricing for unknown model', () => {
    const fallback = Math.round(((0.1 * 100_000 / 1_000_000) + (0.4 * 100_000 / 1_000_000)) * 15800)
    const unknown = estimateCostIDR('gemini-unknown-model', 100_000, 100_000)
    expect(unknown).toBe(fallback)
  })

  it('returns 0 for 0 tokens', () => {
    expect(estimateCostIDR('gemini-2.5-flash', 0, 0)).toBe(0)
  })

  it('MODEL_PRICING contains both models', () => {
    expect(MODEL_PRICING).toHaveProperty('gemini-2.5-flash')
    expect(MODEL_PRICING).toHaveProperty('gemini-2.5-pro')
  })
})
