import { describe, it, expect } from 'vitest'
import { estimateCostIDR, MODEL_PRICING } from '../pricing'

describe('estimateCostIDR', () => {
  it('calculates cost for flash model', () => {
    const cost = estimateCostIDR('gemini-3-flash-preview', 1_000_000, 1_000_000)
    // (0.10 + 0.40) * 15800 = 7900
    expect(cost).toBe(7900)
  })

  it('calculates cost for pro model', () => {
    const cost = estimateCostIDR('gemini-3.1-pro-preview', 1_000_000, 1_000_000)
    // (1.25 + 5.00) * 15800 = 98750
    expect(cost).toBe(98750)
  })

  it('falls back to flash pricing for unknown model', () => {
    const flash = estimateCostIDR('gemini-3-flash-preview', 100_000, 100_000)
    const unknown = estimateCostIDR('gemini-unknown-model', 100_000, 100_000)
    expect(unknown).toBe(flash)
  })

  it('returns 0 for 0 tokens', () => {
    expect(estimateCostIDR('gemini-3-flash-preview', 0, 0)).toBe(0)
  })

  it('MODEL_PRICING contains both models', () => {
    expect(MODEL_PRICING).toHaveProperty('gemini-3-flash-preview')
    expect(MODEL_PRICING).toHaveProperty('gemini-3.1-pro-preview')
  })
})
