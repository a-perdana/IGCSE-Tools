export type AIProvider = 'gemini' | 'openai' | 'anthropic'

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
}

export interface ProviderModel {
  id: string
  label: string
  hint: string
}

export const PROVIDER_MODELS: Record<AIProvider, ProviderModel[]> = {
  gemini: [
    // ── 2.5 series (stable) ──────────────────────────────────────────────────
    { id: 'gemini-2.5-flash',                      label: 'Gemini 2.5 Flash',                     hint: 'Best balance of speed and quality. May require a paid Google AI account.' },
    { id: 'gemini-2.5-pro',                        label: 'Gemini 2.5 Pro',                       hint: 'Highest quality output. Slower — use for Challenging difficulty.' },
    { id: 'gemini-2.5-flash-lite',                 label: 'Gemini 2.5 Flash Lite',                hint: 'Fastest and cheapest 2.5 model. Good for simple recall or MCQ-only.' },
    { id: 'gemini-2.5-flash-lite-preview-09-2025', label: 'Gemini 2.5 Flash Lite Preview Sep 25', hint: 'Preview build of 2.5 Flash Lite.' },
    // ── 3.x series (preview) ─────────────────────────────────────────────────
    { id: 'gemini-3.1-pro-preview',                label: 'Gemini 3.1 Pro Preview',               hint: 'Latest generation Pro model. Highest capability — slower and more expensive.' },
    { id: 'gemini-3.1-flash-lite-preview',         label: 'Gemini 3.1 Flash Lite Preview',        hint: 'Latest generation budget model. Fast and affordable.' },
    { id: 'gemini-3-pro-preview',                  label: 'Gemini 3 Pro Preview',                 hint: 'Previous generation 3 Pro preview.' },
    { id: 'gemini-3-flash-preview',                label: 'Gemini 3 Flash Preview',               hint: 'Previous generation 3 Flash preview.' },
    // ── 2.0 series (stable) ──────────────────────────────────────────────────
    { id: 'gemini-2.0-flash',                      label: 'Gemini 2.0 Flash ★ Recommended',       hint: 'Stable and reliable. Works with free tier API keys.' },
    { id: 'gemini-2.0-flash-001',                  label: 'Gemini 2.0 Flash 001',                 hint: 'Pinned stable release of Gemini 2.0 Flash.' },
    { id: 'gemini-2.0-flash-lite',                 label: 'Gemini 2.0 Flash Lite',                hint: 'Fast and cheap 2.0 model.' },
    { id: 'gemini-2.0-flash-lite-001',             label: 'Gemini 2.0 Flash Lite 001',            hint: 'Pinned stable release of Gemini 2.0 Flash Lite.' },
    // ── Always-latest aliases ────────────────────────────────────────────────
    { id: 'gemini-flash-latest',                   label: 'Gemini Flash Latest',                  hint: 'Always points to the latest stable Flash model.' },
    { id: 'gemini-flash-lite-latest',              label: 'Gemini Flash Lite Latest',             hint: 'Always points to the latest stable Flash Lite model.' },
    { id: 'gemini-pro-latest',                     label: 'Gemini Pro Latest',                    hint: 'Always points to the latest stable Pro model.' },
    // ── Specialist ───────────────────────────────────────────────────────────
    { id: 'deep-research-pro-preview-12-2025',     label: 'Deep Research Pro Preview',            hint: 'Optimised for long-form research and deep reasoning tasks.' },
  ],
  openai: [
    { id: 'gpt-4o-mini',  label: 'GPT-4o Mini',  hint: 'Fast and cost-effective. Good for straightforward assessments.' },
    { id: 'gpt-4o',       label: 'GPT-4o',        hint: 'Strong reasoning and accuracy. Recommended for structured and challenging questions.' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini',  hint: 'Efficient and affordable. Similar to 4o Mini with minor improvements.' },
    { id: 'gpt-4.1',      label: 'GPT-4.1',       hint: 'Latest GPT generation. Best OpenAI option for high-quality IGCSE assessments.' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',   hint: 'Fastest and most affordable Claude model. Good for quick drafts.' },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6',  hint: 'Best balance of quality and cost. Recommended for most IGCSE use cases.' },
    { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6',    hint: 'Most powerful Claude model. Best for complex structured and challenging questions.' },
  ],
}

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
}

export const DEFAULT_AUDIT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.5-pro',
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-4-6',
}

export const API_KEY_PLACEHOLDERS: Record<AIProvider, string> = {
  gemini: 'AIza...',
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
}

export const API_KEY_URLS: Record<AIProvider, string> = {
  gemini: 'https://aistudio.google.com/apikey',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
}

export interface FreeTierInfo {
  available: boolean
  badge: string       // short label shown next to provider name
  description: string // 1-line explanation shown in settings
  steps: string[]     // numbered steps to get a free key
}

export const FREE_TIER_INFO: Record<AIProvider, FreeTierInfo> = {
  gemini: {
    available: true,
    badge: 'Free tier available',
    description: 'Google AI Studio gives you a free API key — no credit card required.',
    steps: [
      'Go to aistudio.google.com/apikey',
      'Sign in with your Google account',
      'Click "Create API key" → "Create API key in new project"',
      'Copy the key and paste it below',
    ],
  },
  openai: {
    available: false,
    badge: 'Paid — credits required',
    description: 'OpenAI requires a paid account. New accounts receive $5 in free credits.',
    steps: [
      'Go to platform.openai.com and create an account',
      'Add a payment method under Billing',
      'Go to platform.openai.com/api-keys',
      'Click "Create new secret key" and paste it below',
    ],
  },
  anthropic: {
    available: false,
    badge: 'Paid — credits required',
    description: 'Anthropic requires a paid account. New accounts receive $5 in free credits.',
    steps: [
      'Go to console.anthropic.com and create an account',
      'Add a payment method under Billing',
      'Go to console.anthropic.com/settings/keys',
      'Click "Create Key" and paste it below',
    ],
  },
}

export const API_USAGE_URLS: Record<AIProvider, string> = {
  gemini: 'https://aistudio.google.com/usage',
  openai: 'https://platform.openai.com/usage',
  anthropic: 'https://console.anthropic.com/settings/usage',
}
