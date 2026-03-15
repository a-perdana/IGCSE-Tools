import { useState, useEffect, useCallback } from 'react'
import type { Notification } from '../lib/types'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(n => n.filter(x => x.dismissAt > Date.now()))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const notify = useCallback((message: string, type: Notification['type'] = 'info', durationMs = 5000) => {
    const id = crypto.randomUUID()
    setNotifications(n => [...n, { id, message, type, dismissAt: Date.now() + durationMs }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications(n => n.filter(x => x.id !== id))
  }, [])

  return { notifications, notify, dismiss }
}

export type NotifyFn = ReturnType<typeof useNotifications>['notify']
