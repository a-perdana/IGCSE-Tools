import { useState, useCallback, useRef } from 'react'
import type { Assessment, PracticeAnswerRecord, PracticeAttempt, GenerationConfig } from '../lib/types'
import { checkPracticeAnswer, getQuestionHint } from '../lib/ai'
import { savePracticeAttempt } from '../lib/firebase'
import { Timestamp } from 'firebase/firestore'

export interface PracticeSession {
  assessment: Assessment
  currentIndex: number
  answers: Record<string, PracticeAnswerRecord>
  checkedQuestions: Set<string>
  draftAnswers: Record<string, string>
  isChecking: boolean
  checkError: string | null
  isComplete: boolean
  isSaving: boolean
  hints: Record<string, string>   // questionId → hint text
  isHinting: boolean              // true while fetching a hint
}

export function usePractice(
  assessment: Assessment,
  provider: GenerationConfig['provider'],
  apiKey: string,
  model: string,
  onComplete: (attempt: PracticeAttempt) => void,
  notify: (msg: string, type: 'success' | 'error' | 'info') => void,
) {
  const startedAt = useRef(Date.now())
  const sessionRef = useRef<PracticeSession | null>(null)

  const [session, setSession] = useState<PracticeSession>({
    assessment,
    currentIndex: 0,
    answers: {},
    checkedQuestions: new Set(),
    draftAnswers: {},
    isChecking: false,
    checkError: null,
    isComplete: false,
    isSaving: false,
    hints: {},
    isHinting: false,
  })

  // Keep sessionRef always up-to-date so finishSession can read current state
  // without stale closure issues
  const setSessionSafe = useCallback((updater: (s: PracticeSession) => PracticeSession) => {
    setSession(prev => {
      const next = updater(prev)
      sessionRef.current = next
      return next
    })
  }, [])

  const setDraftAnswer = useCallback((questionId: string, value: string) => {
    setSessionSafe(s => ({ ...s, draftAnswers: { ...s.draftAnswers, [questionId]: value } }))
  }, [setSessionSafe])

  const checkAnswer = useCallback(async (questionId: string) => {
    const question = assessment.questions.find(q => q.id === questionId)
    if (!question) return

    const userAnswer = (sessionRef.current ?? session).draftAnswers[questionId]?.trim() ?? ''
    if (!userAnswer) return

    // MCQ: deterministic client-side check
    if (question.type === 'mcq') {
      const correct = question.answer?.trim()
      // Find which option matches the answer — compare by option text or by letter (A/B/C/D)
      const opts = question.options ?? []
      const selectedIndex = opts.findIndex(o => o === userAnswer)
      const correctIndex = opts.findIndex(o => o === correct)
      // Also support answer being A/B/C/D letter
      const letterIndex = ['A', 'B', 'C', 'D'].indexOf(correct?.toUpperCase() ?? '')
      const isCorrect =
        (selectedIndex !== -1 && selectedIndex === correctIndex) ||
        (letterIndex !== -1 && selectedIndex === letterIndex) ||
        userAnswer.toLowerCase() === correct?.toLowerCase()

      const record: PracticeAnswerRecord = {
        userAnswer,
        isCorrect,
        marksAwarded: isCorrect ? question.marks : 0,
      }
      setSessionSafe(s => ({
        ...s,
        answers: { ...s.answers, [questionId]: record },
        checkedQuestions: new Set([...s.checkedQuestions, questionId]),
      }))
      return
    }

    // short_answer / structured: AI check
    if (!apiKey.trim()) {
      setSessionSafe(s => ({
        ...s,
        checkError: 'No API key set. Please add your API key in the API Settings panel.',
      }))
      return
    }

    setSessionSafe(s => ({ ...s, isChecking: true, checkError: null }))
    try {
      const result = await checkPracticeAnswer(
        assessment.subject,
        question,
        userAnswer,
        model,
        provider,
        apiKey,
      )
      const record: PracticeAnswerRecord = { userAnswer, ...result }
      setSessionSafe(s => ({
        ...s,
        isChecking: false,
        answers: { ...s.answers, [questionId]: record },
        checkedQuestions: new Set([...s.checkedQuestions, questionId]),
      }))
    } catch (err) {
      setSessionSafe(s => ({
        ...s,
        isChecking: false,
        checkError: err instanceof Error ? err.message : 'Could not evaluate answer.',
      }))
    }
  }, [assessment, apiKey, model, provider]) // draftAnswers read via sessionRef

  const getHint = useCallback(async (questionId: string) => {
    const s = sessionRef.current ?? session
    if (s.hints[questionId] || s.isHinting) return
    const question = assessment.questions.find(q => q.id === questionId)
    if (!question) return
    if (!apiKey.trim()) {
      setSessionSafe(s => ({ ...s, hints: { ...s.hints, [questionId]: 'No API key set — add your key in API Settings to get hints.' } }))
      return
    }
    setSessionSafe(s => ({ ...s, isHinting: true }))
    const hint = await getQuestionHint(assessment.subject, question, model, provider, apiKey)
    setSessionSafe(s => ({ ...s, isHinting: false, hints: { ...s.hints, [questionId]: hint } }))
  }, [assessment, apiKey, model, provider]) // hints/isHinting read via sessionRef

  const goToQuestion = useCallback((index: number) => {
    setSession(s => ({ ...s, currentIndex: index }))
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

  const finishSession = useCallback(async () => {
    // Read from ref to avoid stale closure — always gets the latest session state
    const currentSession = sessionRef.current ?? session
    // Auto-check any MCQ questions that have a draft answer but haven't been checked yet
    const autoAnswers: Record<string, PracticeAnswerRecord> = { ...currentSession.answers }
    for (const question of assessment.questions) {
      if (currentSession.checkedQuestions.has(question.id)) continue
      const userAnswer = currentSession.draftAnswers[question.id]?.trim() ?? ''
      if (!userAnswer) continue

      if (question.type === 'mcq') {
        const correct = question.answer?.trim()
        const opts = question.options ?? []
        const selectedIndex = opts.findIndex(o => o === userAnswer)
        const correctIndex = opts.findIndex(o => o === correct)
        const letterIndex = ['A', 'B', 'C', 'D'].indexOf(correct?.toUpperCase() ?? '')
        const isCorrect =
          (selectedIndex !== -1 && selectedIndex === correctIndex) ||
          (letterIndex !== -1 && selectedIndex === letterIndex) ||
          userAnswer.toLowerCase() === correct?.toLowerCase()
        autoAnswers[question.id] = { userAnswer, isCorrect, marksAwarded: isCorrect ? question.marks : 0, syllabusObjective: question.syllabusObjective }
      } else {
        // short_answer / structured without AI check — mark as unevaluated (0 marks)
        autoAnswers[question.id] = { userAnswer, isCorrect: false, marksAwarded: 0, aiFeedback: 'Not checked — submitted without AI evaluation.', syllabusObjective: question.syllabusObjective }
      }
    }

    // Also tag syllabusObjective on already-checked answers that don't have it yet
    for (const question of assessment.questions) {
      if (autoAnswers[question.id] && !autoAnswers[question.id].syllabusObjective && question.syllabusObjective) {
        autoAnswers[question.id] = { ...autoAnswers[question.id], syllabusObjective: question.syllabusObjective }
      }
    }

    const totalMarks = assessment.questions.reduce((sum, q) => sum + q.marks, 0)
    const marksAwarded = Object.values(autoAnswers).reduce((sum, a) => sum + a.marksAwarded, 0)
    const durationSeconds = Math.round((Date.now() - startedAt.current) / 1000)

    setSession(s => ({ ...s, answers: autoAnswers, isSaving: true }))
    try {
      const id = await savePracticeAttempt({
        assessmentId: assessment.id,
        subject: assessment.subject,
        topic: assessment.topic,
        answers: autoAnswers,
        totalMarks,
        marksAwarded,
        durationSeconds,
      })
      const attempt: PracticeAttempt = {
        id,
        userId: '',   // filled server-side
        assessmentId: assessment.id,
        subject: assessment.subject,
        topic: assessment.topic,
        answers: autoAnswers,
        totalMarks,
        marksAwarded,
        completedAt: Timestamp.now(),
        durationSeconds,
      }
      setSession(s => ({ ...s, isSaving: false, isComplete: true }))
      onComplete(attempt)
    } catch (err) {
      notify('Could not save attempt. ' + (err instanceof Error ? err.message : ''), 'error')
      setSession(s => ({ ...s, isSaving: false, isComplete: true }))
    }
  }, [assessment, onComplete, notify]) // session reads via sessionRef — no stale closure

  const reset = useCallback(() => {
    startedAt.current = Date.now()
    setSession({
      assessment,
      currentIndex: 0,
      answers: {},
      checkedQuestions: new Set(),
      draftAnswers: {},
      isChecking: false,
      checkError: null,
      isComplete: false,
      isSaving: false,
      hints: {},
      isHinting: false,
    })
  }, [assessment])

  return { session, setDraftAnswer, checkAnswer, goToNext, goToPrev, goToQuestion, finishSession, reset, getHint }
}
