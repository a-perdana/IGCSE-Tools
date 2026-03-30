import { useState, useCallback } from 'react'
import type { DailyChallenge, Question, ImportedQuestion } from '../lib/types'
import { getDailyChallenge, completeDailyChallenge } from '../lib/firebase'
import { todayStr } from './useGamification'

// ── Seed-deterministic shuffle using date as seed ─────────────────────────────
// This ensures the same 3 questions are chosen all day for the same user.

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0x100000000
  }
}

function dateSeed(dateStr: string): number {
  return dateStr.split('-').reduce((acc, n) => acc * 100 + parseInt(n), 0)
}

function pickDailyQuestions(
  questions: Question[],
  importedQuestions: ImportedQuestion[],
  today: string,
  count = 3,
): string[] {
  // Prefer MCQ questions (faster to check)
  const mcq = questions.filter(q => q.type === 'mcq')
  const pool = mcq.length >= count ? mcq : questions
  if (pool.length === 0) return []

  const rand = seededRandom(dateSeed(today))
  const shuffled = [...pool].sort(() => rand() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length)).map(q => q.id)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface DailyChallengeState {
  challenge: DailyChallenge | null
  loading: boolean
  isCompleted: boolean
  load: (questions: Question[], importedQuestions: ImportedQuestion[]) => Promise<void>
  complete: (marksAwarded: number, totalMarks: number) => Promise<void>
}

export function useDailyChallenge(): DailyChallengeState {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [loading, setLoading] = useState(false)

  const isCompleted = !!(challenge?.completedAt)

  const load = useCallback(async (questions: Question[], importedQuestions: ImportedQuestion[]) => {
    setLoading(true)
    const today = todayStr()
    const ids = pickDailyQuestions(questions, importedQuestions, today)
    if (ids.length === 0) { setLoading(false); return }
    const c = await getDailyChallenge(today, ids)
    setChallenge(c)
    setLoading(false)
  }, [])

  const complete = useCallback(async (marksAwarded: number, totalMarks: number) => {
    if (!challenge) return
    await completeDailyChallenge(challenge.date, marksAwarded, totalMarks)
    setChallenge(prev => prev ? { ...prev, completedAt: Date.now(), marksAwarded, totalMarks } : prev)
  }, [challenge])

  return { challenge, loading, isCompleted, load, complete }
}
