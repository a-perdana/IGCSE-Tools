import { useState, useCallback, useRef, useEffect } from 'react'
import type { Assessment, ExamAnswerRecord, ExamAttempt, GenerationConfig } from '../lib/types'
import { checkPracticeAnswer } from '../lib/ai'
import { saveExamAttempt } from '../lib/firebase'
import { Timestamp } from 'firebase/firestore'

export interface ExamSession {
  currentIndex: number
  draftAnswers: Record<string, string>       // answers entered during exam
  isSubmitted: boolean
  isGrading: boolean                         // AI grading in flight after submit
  gradingProgress: number                    // 0–total questions
  results: Record<string, ExamAnswerRecord>  // filled after grading
  isSaving: boolean
  autoSubmitted: boolean
  timeRemainingSeconds: number
  showCountdownWarning: boolean              // true when ≤10 seconds remain
}

export function useExamMode(
  assessment: Assessment,
  timeLimitSeconds: number,
  provider: GenerationConfig['provider'],
  apiKey: string,
  model: string,
  onComplete: (attempt: ExamAttempt) => void,
  notify: (msg: string, type: 'success' | 'error' | 'info') => void,
) {
  const startedAt = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [session, setSession] = useState<ExamSession>({
    currentIndex: 0,
    draftAnswers: {},
    isSubmitted: false,
    isGrading: false,
    gradingProgress: 0,
    results: {},
    isSaving: false,
    autoSubmitted: false,
    timeRemainingSeconds: timeLimitSeconds,
    showCountdownWarning: false,
  })

  // ── countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLimitSeconds <= 0) return  // not started yet (setup screen still showing)
    timerRef.current = setInterval(() => {
      setSession(s => {
        if (s.isSubmitted) {
          clearInterval(timerRef.current!)
          return s
        }
        const next = s.timeRemainingSeconds - 1
        if (next <= 0) {
          clearInterval(timerRef.current!)
          return { ...s, timeRemainingSeconds: 0 }
        }
        const showCountdownWarning = next <= 10 && next > 0
        return { ...s, timeRemainingSeconds: next, showCountdownWarning }
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timeLimitSeconds]) // restart when time limit is set

  // ── auto-submit when timer hits 0 ────────────────────────────────────────
  useEffect(() => {
    if (timeLimitSeconds > 0 && session.timeRemainingSeconds === 0 && !session.isSubmitted) {
      handleSubmit(true)
    }
  }, [session.timeRemainingSeconds]) // eslint-disable-line react-hooks/exhaustive-deps

  const setDraftAnswer = useCallback((questionId: string, value: string) => {
    setSession(s => ({ ...s, draftAnswers: { ...s.draftAnswers, [questionId]: value } }))
  }, [])

  const goToNext = useCallback(() => {
    setSession(s => ({
      ...s,
      currentIndex: Math.min(s.currentIndex + 1, assessment.questions.length - 1),
    }))
  }, [assessment.questions.length])

  const goToPrev = useCallback(() => {
    setSession(s => ({ ...s, currentIndex: Math.max(s.currentIndex - 1, 0) }))
  }, [])

  const goToQuestion = useCallback((index: number) => {
    setSession(s => ({ ...s, currentIndex: index }))
  }, [])

  const handleSubmit = useCallback(async (auto = false) => {
    if (timerRef.current) clearInterval(timerRef.current)

    setSession(s => ({ ...s, isSubmitted: true, autoSubmitted: auto, isGrading: true, gradingProgress: 0 }))

    const questions = assessment.questions
    const draftAnswers = session.draftAnswers
    const results: Record<string, ExamAnswerRecord> = {}

    // Phase 1: Grade MCQ and empty answers instantly (client-side, no API needed)
    let instantCount = 0
    for (const q of questions) {
      const userAnswer = draftAnswers[q.id]?.trim() ?? ''
      const syllabusObjective = q.syllabusObjective
      if (!userAnswer) {
        results[q.id] = { userAnswer: '', isCorrect: false, marksAwarded: 0, syllabusObjective }
        instantCount++
      } else if (q.type === 'mcq') {
        const correct = q.answer?.trim()
        const opts = q.options ?? []
        const selectedIndex = opts.findIndex(o => o === userAnswer)
        const correctIndex = opts.findIndex(o => o === correct)
        const letterIndex = ['A', 'B', 'C', 'D'].indexOf(correct?.toUpperCase() ?? '')
        const isCorrect =
          (selectedIndex !== -1 && selectedIndex === correctIndex) ||
          (letterIndex !== -1 && selectedIndex === letterIndex) ||
          userAnswer.toLowerCase() === correct?.toLowerCase()
        results[q.id] = { userAnswer, isCorrect, marksAwarded: isCorrect ? q.marks : 0, syllabusObjective }
        instantCount++
      }
    }
    setSession(s => ({ ...s, gradingProgress: instantCount }))

    // Phase 2: Grade short_answer / structured in parallel (AI calls)
    const aiQuestions = questions.filter(q => {
      const userAnswer = draftAnswers[q.id]?.trim() ?? ''
      return userAnswer && q.type !== 'mcq'
    })

    if (aiQuestions.length > 0) {
      const aiResults = await Promise.all(
        aiQuestions.map(async q => {
          const userAnswer = draftAnswers[q.id]?.trim() ?? ''
          const syllabusObjective = q.syllabusObjective
          if (!apiKey.trim()) {
            return { id: q.id, record: { userAnswer, isCorrect: false, marksAwarded: 0, aiFeedback: 'No API key — answer recorded but not graded.', syllabusObjective } as ExamAnswerRecord }
          }
          try {
            const res = await checkPracticeAnswer(assessment.subject, q, userAnswer, model, provider, apiKey)
            return { id: q.id, record: { userAnswer, ...res, syllabusObjective } as ExamAnswerRecord }
          } catch {
            return { id: q.id, record: { userAnswer, isCorrect: false, marksAwarded: 0, aiFeedback: 'Could not grade.', syllabusObjective } as ExamAnswerRecord }
          }
        })
      )
      // Merge AI results and update progress incrementally
      for (const { id, record } of aiResults) {
        results[id] = record
      }
      setSession(s => ({ ...s, gradingProgress: questions.length }))
    }

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)
    const marksAwarded = Object.values(results).reduce((sum, r) => sum + r.marksAwarded, 0)
    const durationSeconds = Math.round((Date.now() - startedAt.current) / 1000)

    setSession(s => ({ ...s, isGrading: false, results, isSaving: true }))

    try {
      const id = await saveExamAttempt({
        assessmentId: assessment.id,
        subject: assessment.subject,
        topic: assessment.topic,
        timeLimitSeconds,
        answers: results,
        totalMarks,
        marksAwarded,
        durationSeconds,
        autoSubmitted: auto,
      })
      const attempt: ExamAttempt = {
        id,
        userId: '',
        assessmentId: assessment.id,
        subject: assessment.subject,
        topic: assessment.topic,
        timeLimitSeconds,
        answers: results,
        totalMarks,
        marksAwarded,
        completedAt: Timestamp.now(),
        durationSeconds,
        autoSubmitted: auto,
      }
      setSession(s => ({ ...s, isSaving: false }))
      onComplete(attempt)
    } catch (err) {
      notify('Could not save exam attempt. ' + (err instanceof Error ? err.message : ''), 'error')
      setSession(s => ({ ...s, isSaving: false }))
    }
  }, [assessment, session.draftAnswers, apiKey, model, provider, timeLimitSeconds, onComplete, notify])

  const dismissCountdownWarning = useCallback(() => {
    setSession(s => ({ ...s, showCountdownWarning: false }))
  }, [])

  const reset = useCallback(() => {
    startedAt.current = Date.now()
    setSession({
      currentIndex: 0,
      draftAnswers: {},
      isSubmitted: false,
      isGrading: false,
      gradingProgress: 0,
      results: {},
      isSaving: false,
      autoSubmitted: false,
      timeRemainingSeconds: timeLimitSeconds,
      showCountdownWarning: false,
    })
  }, [timeLimitSeconds])

  return { session, setDraftAnswer, goToNext, goToPrev, goToQuestion, handleSubmit, reset, dismissCountdownWarning }
}
