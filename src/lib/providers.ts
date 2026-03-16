export type AIProvider = 'gemini' | 'openai' | 'anthropic'

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
}

export interface ProviderModel {
  id: string
  label: string
}

export const PROVIDER_MODELS: Record<AIProvider, ProviderModel[]> = {
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
  ],
}

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
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

export const API_USAGE_URLS: Record<AIProvider, string> = {
  gemini: 'https://aistudio.google.com/usage',
  openai: 'https://platform.openai.com/usage',
  anthropic: 'https://console.anthropic.com/settings/usage',
}
