import { useState } from 'react'
import type { Assessment, ExamAttempt, GenerationConfig, QuestionItem } from '../../lib/types'
import { useExamMode } from '../../hooks/useExamMode'
import { ExamQuestion } from './ExamQuestion'
import { ExamResults } from './ExamResults'
import { ExamTimer } from './ExamTimer'
import { QuickEditModal } from '../Library/modals'

interface Props {
  assessment: Assessment
  provider: GenerationConfig['provider']
  apiKey: string
  model: string
  onExit: () => void
  onComplete: (attempt: ExamAttempt) => void
  notify: (msg: string, type: 'success' | 'error' | 'info') => void
  /** If provided, skip the setup screen and start immediately with this time limit. */
  forcedTimeLimitSeconds?: number
}

const PRESET_MINUTES = [15, 30, 45, 60, 90]

function SetupScreen({ assessment, onStart, onExit }: {
  assessment: Assessment
  onStart: (seconds: number) => void
  onExit: () => void
}) {
  const defaultMinutes = Math.max(15, assessment.questions.length * 3)
  const [minutes, setMinutes] = useState(defaultMinutes)

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <div className="text-4xl mb-3">📝</div>
          <h2 className="text-xl font-bold text-slate-800">Exam Mode</h2>
          <p className="text-sm text-slate-500 mt-1">
            {assessment.subject} · {assessment.topic}
          </p>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Questions', value: assessment.questions.length },
            { label: 'Total Marks', value: assessment.questions.reduce((s, q) => s + q.marks, 0) },
            { label: 'Time Limit', value: `${minutes}m` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-lg font-bold text-slate-800">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>

        {/* Time picker */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Time Limit</p>
          <div className="flex gap-2 flex-wrap">
            {PRESET_MINUTES.map(m => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                  minutes === m
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400',
                ].join(' ')}
              >
                {m}m
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={5}
              max={180}
              step={5}
              value={minutes}
              onChange={e => setMinutes(Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <span className="text-sm font-mono font-semibold text-slate-700 w-12 text-right">{minutes}m</span>
          </div>
        </div>

        {/* Exam rules */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-xs text-blue-700 space-y-1">
          <p className="font-semibold text-blue-800 mb-1.5">Exam rules</p>
          <p>• All questions must be answered before submitting</p>
          <p>• Answers are <strong>not</strong> checked until you submit</p>
          <p>• Exam auto-submits when the timer reaches 0:00</p>
          <p>• AI grading runs after submission (short/structured questions)</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onExit}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(minutes * 60)}
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Start Exam →
          </button>
        </div>
      </div>
    </div>
  )
}

export function ExamMode({ assessment, provider, apiKey, model, onExit, onComplete, notify, forcedTimeLimitSeconds }: Props) {
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(forcedTimeLimitSeconds ?? null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null)
  const [questionOverrides, setQuestionOverrides] = useState<Record<string, Partial<QuestionItem>>>({})

  const exam = useExamMode(
    assessment,
    timeLimitSeconds ?? 0,
    provider,
    apiKey,
    model,
    onComplete,
    notify,
  )

  // Show setup screen first
  if (timeLimitSeconds === null) {
    return (
      <SetupScreen
        assessment={assessment}
        onStart={secs => setTimeLimitSeconds(secs)}
        onExit={onExit}
      />
    )
  }

  const questions = assessment.questions.map(q =>
    questionOverrides[q.id] ? { ...q, ...questionOverrides[q.id] } : q
  )
  const currentQuestion = questions[exam.session.currentIndex]
  const answeredCount = Object.values(exam.session.draftAnswers).filter(v => v.trim() !== '').length

  // Grading overlay
  if (exam.session.isSubmitted && (exam.session.isGrading || exam.session.isSaving)) {
    const total = questions.length
    const done = exam.session.gradingProgress
    return (
      <div className="fixed inset-0 z-40 bg-white flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-4xl">🔍</div>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800">
            {exam.session.isSaving ? 'Saving results…' : 'Grading your answers…'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {exam.session.isSaving ? 'Almost done' : `${done} / ${total} questions graded`}
          </p>
        </div>
        <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${exam.session.isSaving ? 100 : (done / Math.max(total, 1)) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  // Results
  if (exam.session.isSubmitted && !exam.session.isGrading) {
    return (
      <div className="fixed inset-0 z-40 bg-white flex flex-col overflow-y-auto">
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Exam Results</p>
            <p className="text-sm font-semibold text-slate-700 truncate">{assessment.subject} · {assessment.topic}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ExamResults
            assessment={assessment}
            results={exam.session.results}
            totalMarks={questions.reduce((s, q) => s + q.marks, 0)}
            marksAwarded={Object.values(exam.session.results).reduce((s, r) => s + r.marksAwarded, 0)}
            durationSeconds={timeLimitSeconds - exam.session.timeRemainingSeconds}
            timeLimitSeconds={timeLimitSeconds}
            autoSubmitted={exam.session.autoSubmitted}
            isSaving={exam.session.isSaving}
            onRetry={() => { setTimeLimitSeconds(null); exam.reset() }}
            onExit={onExit}
          />
        </div>
      </div>
    )
  }

  // Active exam
  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">
            {assessment.subject} · {assessment.topic}
          </p>
          <p className="text-sm font-semibold text-slate-700">Exam Mode</p>
        </div>

        <span className="text-xs text-slate-400 hidden sm:block">
          {answeredCount}/{questions.length} answered
        </span>

        <ExamTimer
          timeRemainingSeconds={exam.session.timeRemainingSeconds}
          timeLimitSeconds={timeLimitSeconds}
        />

        <button
          onClick={() => setShowSubmitConfirm(true)}
          className="shrink-0 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Submit
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          {currentQuestion && (
            <ExamQuestion
              question={currentQuestion}
              questionNumber={exam.session.currentIndex + 1}
              totalQuestions={questions.length}
              draftAnswer={exam.session.draftAnswers[currentQuestion.id] ?? ''}
              onAnswerChange={v => exam.setDraftAnswer(currentQuestion.id, v)}
              onNext={exam.goToNext}
              onPrev={exam.goToPrev}
              canGoNext={exam.session.currentIndex < questions.length - 1}
              canGoPrev={exam.session.currentIndex > 0}
              onGoTo={exam.goToQuestion}
              answeredCount={answeredCount}
              allDraftAnswers={exam.session.draftAnswers}
              questions={questions}
              onEdit={() => setEditingQuestion(currentQuestion)}
            />
          )}
        </div>
      </div>

      {editingQuestion && (
        <QuickEditModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSave={updates => setQuestionOverrides(prev => ({ ...prev, [editingQuestion.id]: { ...(prev[editingQuestion.id] ?? {}), ...updates } }))}
        />
      )}

      {/* 10-second countdown warning */}
      {exam.session.showCountdownWarning && !exam.session.isSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4 border-2 border-red-400">
            <div className="text-center">
              <div className="text-4xl mb-2">⏰</div>
              <h3 className="text-lg font-bold text-red-600">Time's almost up!</h3>
              <p className="text-sm text-slate-500 mt-1">
                <span className="font-bold text-red-600 text-2xl tabular-nums">{exam.session.timeRemainingSeconds}</span>
                {' '}seconds remaining — exam will auto-submit.
              </p>
            </div>
            <button
              onClick={() => exam.dismissCountdownWarning()}
              className="w-full px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Got it — continue
            </button>
          </div>
        </div>
      )}

      {/* Submit confirm modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
            <h3 className="text-base font-semibold text-slate-800">Submit exam?</h3>
            <p className="text-sm text-slate-500">
              You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
              {answeredCount < questions.length && (
                <span className="text-amber-600"> {questions.length - answeredCount} unanswered question{questions.length - answeredCount !== 1 ? 's' : ''} will receive 0 marks.</span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Continue exam
              </button>
              <button
                onClick={() => { setShowSubmitConfirm(false); exam.handleSubmit(false) }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Submit now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
