import { useState } from 'react'
import type { Assessment, PracticeAttempt, GenerationConfig, QuestionItem } from '../../lib/types'
import { usePractice } from '../../hooks/usePractice'
import { PracticeQuestion } from './PracticeQuestion'
import { PracticeResults } from './PracticeResults'
import { QuickEditModal } from '../Library/modals'

interface Props {
  assessment: Assessment
  provider: GenerationConfig['provider']
  apiKey: string
  model: string
  onExit: () => void
  onComplete: (attempt: PracticeAttempt) => void
  notify: (msg: string, type: 'success' | 'error' | 'info') => void
}

export function PracticeMode({ assessment, provider, apiKey, model, onExit, onComplete, notify }: Props) {
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null)
  const [questionOverrides, setQuestionOverrides] = useState<Record<string, Partial<QuestionItem>>>({})

  const { session, setDraftAnswer, checkAnswer, goToNext, goToPrev, goToQuestion, finishSession, reset, getHint } = usePractice(
    assessment,
    provider,
    apiKey,
    model,
    onComplete,
    notify,
  )

  const questions = assessment.questions.map(q =>
    questionOverrides[q.id] ? { ...q, ...questionOverrides[q.id] } : q
  )
  const currentQuestion = questions[session.currentIndex]
  const progress = session.checkedQuestions.size / Math.max(questions.length, 1)
  const allChecked = session.checkedQuestions.size === questions.length
  const allAnswered = questions.every(q => (session.draftAnswers[q.id] ?? '').trim() !== '')

  function handleQuickSave(updates: Partial<QuestionItem>) {
    if (!editingQuestion) return
    setQuestionOverrides(prev => ({ ...prev, [editingQuestion.id]: { ...(prev[editingQuestion.id] ?? {}), ...updates } }))
  }

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">
            {assessment.subject} · {assessment.topic}
          </p>
          <p className="text-sm font-semibold text-slate-700 truncate">Practice Mode</p>
        </div>

        {/* Progress bar */}
        <div className="flex-1 max-w-xs hidden sm:block">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>{session.checkedQuestions.size} checked</span>
            <span>{questions.length} total</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={onExit}
          className="shrink-0 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Exit without saving"
        >
          Exit
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          {session.isComplete ? (
            <PracticeResults
              assessment={assessment}
              answers={session.answers}
              totalMarks={questions.reduce((s, q) => s + q.marks, 0)}
              marksAwarded={Object.values(session.answers).reduce((s, a) => s + a.marksAwarded, 0)}
              durationSeconds={0}
              isSaving={session.isSaving}
              onRetry={reset}
              onExit={onExit}
            />
          ) : currentQuestion ? (
            <PracticeQuestion
              question={currentQuestion}
              questionNumber={session.currentIndex + 1}
              totalQuestions={questions.length}
              draftAnswer={session.draftAnswers[currentQuestion.id] ?? ''}
              checkedResult={session.answers[currentQuestion.id]}
              isChecking={session.isChecking}
              checkError={session.checkError}
              questions={questions}
              onAnswerChange={v => setDraftAnswer(currentQuestion.id, v)}
              onCheck={() => checkAnswer(currentQuestion.id)}
              onNext={goToNext}
              onPrev={goToPrev}
              canGoNext={session.currentIndex < questions.length - 1}
              canGoPrev={session.currentIndex > 0}
              onGoTo={goToQuestion}
              onFinish={finishSession}
              isLastQuestion={session.currentIndex === questions.length - 1}
              allChecked={allChecked}
              allAnswered={allAnswered}
              allDraftAnswers={session.draftAnswers}
              checkedQuestions={session.checkedQuestions}
              hint={session.hints[currentQuestion.id]}
              isHinting={session.isHinting}
              onHint={() => getHint(currentQuestion.id)}
              onEdit={() => setEditingQuestion(currentQuestion)}
            />
          ) : null}
        </div>
      </div>

      {editingQuestion && (
        <QuickEditModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSave={handleQuickSave}
        />
      )}
    </div>
  )
}
