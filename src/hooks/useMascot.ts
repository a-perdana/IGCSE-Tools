import { useState, useCallback, useEffect, useRef } from 'react'
import type { MascotMood, MascotForm } from '../components/Mascot/MascotSVG'
import { formFromLevel } from '../components/Mascot/MascotSVG'
import type { BadgeId, UserProfile } from '../lib/types'

export type { MascotMood, MascotForm }

export interface MascotState {
  mood: MascotMood
  form: MascotForm
  previousForm: MascotForm | null  // set during level-up evolution
  didEvolve: boolean               // true for one render cycle after evolution
  setMood: (mood: MascotMood, durationMs?: number) => void
  onCorrectAnswer: () => void
  onWrongAnswer: () => void
  onSessionStart: () => void
  onLevelUp: (newLevel: number) => void
  clearEvolution: () => void
}

export function useMascot(profile: UserProfile | null): MascotState {
  const [mood, setMoodState] = useState<MascotMood>('idle')
  const [didEvolve, setDidEvolve] = useState(false)
  const [previousForm, setPreviousForm] = useState<MascotForm | null>(null)
  const moodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevLevelRef = useRef<number>(profile?.level ?? 1)

  const level = profile?.level ?? 1
  const form = formFromLevel(level)

  // Detect level-up from profile change
  useEffect(() => {
    const prev = prevLevelRef.current
    if (profile && profile.level > prev) {
      const prevForm = formFromLevel(prev)
      const newForm  = formFromLevel(profile.level)
      if (newForm !== prevForm) {
        setPreviousForm(prevForm)
        setDidEvolve(true)
      }
      prevLevelRef.current = profile.level
    } else if (profile) {
      prevLevelRef.current = profile.level
    }
  }, [profile?.level])

  const setMood = useCallback((newMood: MascotMood, durationMs = 3000) => {
    if (moodTimerRef.current) clearTimeout(moodTimerRef.current)
    setMoodState(newMood)
    if (newMood !== 'idle') {
      moodTimerRef.current = setTimeout(() => setMoodState('idle'), durationMs)
    }
  }, [])

  const onCorrectAnswer = useCallback(() => setMood('happy', 2500), [setMood])
  const onWrongAnswer   = useCallback(() => setMood('thinking', 3000), [setMood])
  const onSessionStart  = useCallback(() => setMood('ready', 2000), [setMood])
  const onLevelUp       = useCallback((_newLevel: number) => setMood('excited', 5000), [setMood])
  const clearEvolution  = useCallback(() => { setDidEvolve(false); setPreviousForm(null) }, [])

  return {
    mood, form, previousForm, didEvolve,
    setMood, onCorrectAnswer, onWrongAnswer, onSessionStart, onLevelUp, clearEvolution,
  }
}
