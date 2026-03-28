import { useState, useCallback, useRef } from 'react'
import type { Assessment, PracticeAnswerRecord, PracticeAttempt, GenerationConfig } from '../lib/types'
import { checkPracticeAnswer } from '../lib/ai'
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
  })

  const setDraftAnswer = useCallback((questionId: string, value: string) => {
    setSession(s => ({ ...s, draftAnswers: { ...s.draftAnswers, [questionId]: value } }))
  }, [])

  const checkAnswer = useCallback(async (questionId: string) => {
    const question = assessment.questions.find(q => q.id === questionId)
    if (!question) return

    const userAnswer = session.draftAnswers[questionId]?.trim() ?? ''
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
      setSession(s => ({
        ...s,
        answers: { ...s.answers, [questionId]: record },
        checkedQuestions: new Set([...s.checkedQuestions, questionId]),
      }))
      return
    }

    // short_answer / structured: AI check
    if (!apiKey.trim()) {
      setSession(s => ({
        ...s,
        checkError: 'No API key set. Please add your API key in the API Settings panel.',
      }))
      return
    }

    setSession(s => ({ ...s, isChecking: true, checkError: null }))
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
      setSession(s => ({
        ...s,
        isChecking: false,
        answers: { ...s.answers, [questionId]: record },
        checkedQuestions: new Set([...s.checkedQuestions, questionId]),
      }))
    } catch (err) {
      setSession(s => ({
        ...s,
        isChecking: false,
        checkError: err instanceof Error ? err.message : 'Could not evaluate answer.',
      }))
    }
  }, [assessment, session.draftAnswers, apiKey, model, provider])

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
    const totalMarks = assessment.questions.reduce((sum, q) => sum + q.marks, 0)
    const marksAwarded = Object.values(session.answers).reduce((sum, a) => sum + a.marksAwarded, 0)
    const durationSeconds = Math.round((Date.now() - startedAt.current) / 1000)

    setSession(s => ({ ...s, isSaving: true }))
    try {
      const id = await savePracticeAttempt({
        assessmentId: assessment.id,
        subject: assessment.subject,
        topic: assessment.topic,
        answers: session.answers,
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
        answers: session.answers,
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
  }, [assessment, session.answers, onComplete, notify])

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
    })
  }, [assessment])

  return { session, setDraftAnswer, checkAnswer, goToNext, goToPrev, finishSession, reset }
}
