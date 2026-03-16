import { useState, useCallback } from 'react'
import type { AIProvider } from '../lib/providers'
import { DEFAULT_MODELS } from '../lib/providers'

const LS_PROVIDER = 'igcse_tools_provider'
const LS_APIKEYS = 'igcse_tools_api_keys'
const LS_CUSTOM_MODEL = 'igcse_tools_custom_model'

type ApiKeys = Record<AIProvider, string>

function loadApiKeys(): ApiKeys {
  try { return JSON.parse(localStorage.getItem(LS_APIKEYS) ?? '{}') } catch { return {} as ApiKeys }
}

export function useApiSettings() {
  const [provider, setProviderState] = useState<AIProvider>(
    () => (localStorage.getItem(LS_PROVIDER) as AIProvider | null) ?? 'gemini'
  )
  const [apiKeys, setApiKeysState] = useState<ApiKeys>(loadApiKeys)
  const [customModel, setCustomModelState] = useState(() => localStorage.getItem(LS_CUSTOM_MODEL) ?? '')

  const setProvider = useCallback((p: AIProvider) => {
    localStorage.setItem(LS_PROVIDER, p)
    setProviderState(p)
  }, [])

  const setApiKey = useCallback((p: AIProvider, key: string) => {
    setApiKeysState(prev => {
      const next = { ...prev, [p]: key }
      localStorage.setItem(LS_APIKEYS, JSON.stringify(next))
      return next
    })
  }, [])

  const setCustomModel = useCallback((model: string) => {
    localStorage.setItem(LS_CUSTOM_MODEL, model)
    setCustomModelState(model)
  }, [])

  const currentApiKey = apiKeys[provider] ?? ''
  const defaultModel = DEFAULT_MODELS[provider]

  return {
    provider,
    setProvider,
    apiKeys,
    setApiKey,
    currentApiKey,
    customModel,
    setCustomModel,
    defaultModel,
  }
}
