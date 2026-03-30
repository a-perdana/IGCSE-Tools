import { useState, useCallback, useRef } from 'react'
import type { UserProfile, BadgeId, PracticeAttempt } from '../lib/types'
import { BADGE_DEFINITIONS } from '../lib/types'
import { getUserProfile, saveUserProfile } from '../lib/firebase'

// ── Level formula: each level needs level*200 XP ──────────────────────────────

export function levelFromXP(xp: number): { level: number; currentXP: number; nextXP: number } {
  let level = 1
  let needed = 200
  let remaining = xp
  while (remaining >= needed) {
    remaining -= needed
    level++
    needed = level * 200
  }
  return { level, currentXP: remaining, nextXP: needed }
}

// ── Today's date string 'YYYY-MM-DD' in local time ────────────────────────────

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Check which new badges should be unlocked ─────────────────────────────────

function checkNewBadges(profile: UserProfile): BadgeId[] {
  const already = new Set(profile.badges)
  const newBadges: BadgeId[] = []

  const add = (id: BadgeId) => { if (!already.has(id)) newBadges.push(id) }

  const q = profile.totalQuestionsAnswered
  if (q >= 1)   add('first_question')
  if (q >= 10)  add('questions_10')
  if (q >= 50)  add('questions_50')
  if (q >= 100) add('questions_100')
  if (q >= 500) add('questions_500')

  if (profile.streak >= 3)  add('streak_3')
  if (profile.streak >= 7)  add('streak_7')
  if (profile.streak >= 30) add('streak_30')

  if (profile.level >= 5)  add('level_5')
  if (profile.level >= 10) add('level_10')

  if (profile.dailyChallengesCompleted >= 1) add('daily_3')

  const maxSubject = Math.max(0, ...Object.values(profile.subjectQuestionCounts))
  if (maxSubject >= 50) add('subject_master')

  const hour = new Date().getHours()
  if (hour >= 22) add('night_owl')
  if (hour < 7)   add('early_bird')

  return newBadges
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface GamificationState {
  profile: UserProfile | null
  loading: boolean
  newlyUnlockedBadges: BadgeId[]
  dismissBadge: () => void
  applyAttempt: (attempt: PracticeAttempt) => Promise<void>
  applyDailyComplete: (marksAwarded: number, totalMarks: number) => Promise<void>
  reload: () => Promise<void>
}

const EMPTY_PROFILE: UserProfile = {
  uid: '',
  xp: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  totalQuestionsAnswered: 0,
  totalMarksAwarded: 0,
  totalMarksPossible: 0,
  badges: [],
  subjectQuestionCounts: {},
  dailyChallengesCompleted: 0,
  updatedAt: 0,
}

export function useGamification(): GamificationState {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<BadgeId[]>([])
  const profileRef = useRef<UserProfile | null>(null)

  const setProfileSafe = (p: UserProfile | null) => {
    profileRef.current = p
    setProfile(p)
  }

  const reload = useCallback(async () => {
    setLoading(true)
    const p = await getUserProfile()
    setProfileSafe(p)
    setLoading(false)
  }, [])

  const dismissBadge = useCallback(() => {
    setNewlyUnlockedBadges(prev => prev.slice(1))
  }, [])

  /** Call after a practice/exam session completes to update XP, streak, badges. */
  const applyAttempt = useCallback(async (attempt: PracticeAttempt) => {
    const base = profileRef.current ?? { ...EMPTY_PROFILE, uid: attempt.userId }

    const questionsAnswered = Object.keys(attempt.answers).length
    const xpGained = attempt.marksAwarded * 10
    const today = todayStr()
    const yesterday = yesterdayStr()

    // Streak logic
    let newStreak = base.streak
    if (base.lastActiveDate === today) {
      // already counted today — no change
    } else if (base.lastActiveDate === yesterday) {
      newStreak = base.streak + 1
    } else {
      newStreak = 1  // reset
    }

    // Subject counts
    const subjectCounts = { ...base.subjectQuestionCounts }
    if (attempt.subject) {
      subjectCounts[attempt.subject] = (subjectCounts[attempt.subject] ?? 0) + questionsAnswered
    }

    const newXP = base.xp + xpGained
    const { level } = levelFromXP(newXP)

    const updated: UserProfile = {
      ...base,
      xp: newXP,
      level,
      streak: newStreak,
      longestStreak: Math.max(base.longestStreak, newStreak),
      lastActiveDate: today,
      totalQuestionsAnswered: base.totalQuestionsAnswered + questionsAnswered,
      totalMarksAwarded: base.totalMarksAwarded + attempt.marksAwarded,
      totalMarksPossible: base.totalMarksPossible + attempt.totalMarks,
      subjectQuestionCounts: subjectCounts,
      updatedAt: Date.now(),
    }

    // Check for perfect score badge
    const isPerfect = attempt.totalMarks > 0 && attempt.marksAwarded === attempt.totalMarks
    if (isPerfect && !updated.badges.includes('first_perfect')) {
      updated.badges = [...updated.badges, 'first_perfect']
    }

    // Check other badges
    const newBadges = checkNewBadges(updated)
    if (newBadges.length > 0) {
      // Add XP rewards for badges
      const bonusXP = newBadges.reduce((sum, id) => sum + BADGE_DEFINITIONS[id].xpReward, 0)
      updated.xp += bonusXP
      updated.level = levelFromXP(updated.xp).level
      updated.badges = [...updated.badges, ...newBadges]
      setNewlyUnlockedBadges(prev => [...prev, ...newBadges])
    }

    setProfileSafe(updated)
    await saveUserProfile(updated)
  }, [])

  /** Call after completing a daily challenge. */
  const applyDailyComplete = useCallback(async (marksAwarded: number, totalMarks: number) => {
    const base = profileRef.current
    if (!base) return

    const bonusXP = 150 + marksAwarded * 5  // base bonus + marks bonus
    const newXP = base.xp + bonusXP
    const { level } = levelFromXP(newXP)

    const updated: UserProfile = {
      ...base,
      xp: newXP,
      level,
      dailyChallengesCompleted: base.dailyChallengesCompleted + 1,
      totalMarksAwarded: base.totalMarksAwarded + marksAwarded,
      totalMarksPossible: base.totalMarksPossible + totalMarks,
      updatedAt: Date.now(),
    }

    const newBadges = checkNewBadges(updated)
    if (newBadges.length > 0) {
      const bonusBadgeXP = newBadges.reduce((sum, id) => sum + BADGE_DEFINITIONS[id].xpReward, 0)
      updated.xp += bonusBadgeXP
      updated.level = levelFromXP(updated.xp).level
      updated.badges = [...updated.badges, ...newBadges]
      setNewlyUnlockedBadges(prev => [...prev, ...newBadges])
    }

    setProfileSafe(updated)
    await saveUserProfile(updated)
  }, [])

  return { profile, loading, newlyUnlockedBadges, dismissBadge, applyAttempt, applyDailyComplete, reload }
}
