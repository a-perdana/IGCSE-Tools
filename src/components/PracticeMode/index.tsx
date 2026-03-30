import { useState } from 'react'
import type { Assessment, PracticeAttempt, GenerationConfig, QuestionItem } from '../../lib/types'
import { usePractice } from '../../hooks/usePractice'
import { PracticeQuestion } from './PracticeQuestion'
import { PracticeResults } from './PracticeResults'
import { QuickEditModal } from '../Library/modals'
import { X } from 'lucide-react'

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
  const checkedCount = session.checkedQuestions.size
  const totalQ = questions.length
  const progress = checkedCount / Math.max(totalQ, 1)
  const allChecked = checkedCount === totalQ
  const allAnswered = questions.every(q => (session.draftAnswers[q.id] ?? '').trim() !== '')

  function handleQuickSave(updates: Partial<QuestionItem>) {
    if (!editingQuestion) return
    setQuestionOverrides(prev => ({ ...prev, [editingQuestion.id]: { ...(prev[editingQuestion.id] ?? {}), ...updates } }))
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)' }}>

      {/* ── Quest header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white/90 backdrop-blur border-b border-indigo-100 px-4 sm:px-6 py-3 flex items-center gap-4 shadow-sm">

        {/* Subject + mode label */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider truncate">
            {assessment.subject} · {assessment.topic}
          </p>
          <p className="text-sm font-black text-slate-800 truncate flex items-center gap-1.5">
            ⚡ Practice Mode
          </p>
        </div>

        {/* Quest progress bar */}
        <div className="flex-1 max-w-xs hidden sm:block">
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className="text-indigo-500">{checkedCount} / {totalQ} checked</span>
            <span className="text-slate-400">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-3 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full quest-bar-fill"
              style={{
                width: `${progress * 100}%`,
                background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
              }}
            />
          </div>
        </div>

        <button
          onClick={onExit}
          className="shrink-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          title="Exit without saving"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
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
