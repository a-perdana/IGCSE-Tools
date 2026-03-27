export const MODEL_PRICING: Record<string, { input: number; output: number }> =
  {
    "gemini-3-flash-preview": { input: 0.1, output: 0.4 },
    "gemini-3.1-pro-preview": { input: 1.25, output: 5.0 },
  };

const FALLBACK_MODEL = "gemini-3-flash-preview";
const IDR_RATE = 15800;

export type CostCurrency = 'IDR' | 'USD';

export function estimateCostUSD(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICING[modelId] ?? MODEL_PRICING[FALLBACK_MODEL];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

export function estimateCostIDR(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  return Math.round(estimateCostUSD(modelId, inputTokens, outputTokens) * IDR_RATE);
}

export function formatCost(usd: number, currency: CostCurrency): string {
  if (currency === 'USD') {
    return usd < 0.001 ? `$${(usd * 100).toFixed(3)}¢` : `$${usd.toFixed(4)}`
  }
  return `Rp ${Math.round(usd * IDR_RATE).toLocaleString('id-ID')}`
}
