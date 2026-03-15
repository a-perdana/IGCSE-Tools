export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-3-flash-preview': { input: 0.10, output: 0.40 },
  'gemini-3.1-pro-preview': { input: 1.25, output: 5.00 },
}

const FALLBACK_MODEL = 'gemini-3-flash-preview'
const IDR_RATE = 15800

export function estimateCostIDR(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = MODEL_PRICING[modelId] ?? MODEL_PRICING[FALLBACK_MODEL]
  const usd = (inputTokens / 1_000_000 * p.input) + (outputTokens / 1_000_000 * p.output)
  return Math.round(usd * IDR_RATE)
}
