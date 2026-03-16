import { useState, useCallback } from 'react'

const LS_APIKEY = 'igcse_tools_api_key'
const LS_MODEL = 'igcse_tools_custom_model'

export function useApiSettings() {
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem(LS_APIKEY) ?? '')
  const [customModel, setCustomModelState] = useState(() => localStorage.getItem(LS_MODEL) ?? '')

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem(LS_APIKEY, key)
    setApiKeyState(key)
  }, [])

  const setCustomModel = useCallback((model: string) => {
    localStorage.setItem(LS_MODEL, model)
    setCustomModelState(model)
  }, [])

  return { apiKey, setApiKey, customModel, setCustomModel }
}
