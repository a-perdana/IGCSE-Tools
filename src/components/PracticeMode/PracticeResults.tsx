import type { Assessment, PracticeAnswerRecord } from '../../lib/types'

interface Props {
  assessment: Assessment
  answers: Record<string, PracticeAnswerRecord>
  totalMarks: number
  marksAwarded: number
  durationSeconds: number
  isSaving: boolean
  onRetry: () => void
  onExit: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function PracticeResults({
  assessment,
  answers,
  totalMarks,
  marksAwarded,
  durationSeconds,
  isSaving,
  onRetry,
  onExit,
}: Props) {
  const pct = totalMarks > 0 ? Math.round((marksAwarded / totalMarks) * 100) : 0
  const scoreColor = pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'
  const scoreBg = pct >= 70 ? 'bg-emerald-50 border-emerald-200' : pct >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  const grade = pct >= 70 ? 'Well done!' : pct >= 50 ? 'Good effort' : 'Keep practising'

  return (
    <div className="flex flex-col gap-8 max-w-xl mx-auto py-6">
      {/* Score card */}
      <div className={`rounded-2xl border-2 p-8 text-center ${scoreBg}`}>
        <p className="text-sm font-medium text-slate-500 mb-1">{grade}</p>
        <p className={`text-6xl font-bold tabular-nums ${scoreColor}`}>{pct}%</p>
        <p className="mt-2 text-lg text-slate-600">
          {marksAwarded} / {totalMarks} marks
        </p>
        <p className="mt-1 text-sm text-slate-400">Time: {formatDuration(durationSeconds)}</p>
      </div>

      {/* Per-question breakdown */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Question breakdown</h3>
        {assessment.questions.map((q, i) => {
          const a = answers[q.id]
          const awarded = a?.marksAwarded ?? 0
          const correct = a?.isCorrect ?? false
          const attempted = a !== undefined
          const notChecked = attempted && a.aiFeedback === 'Not checked — submitted without AI evaluation.'

          return (
            <div
              key={q.id}
              className={[
                'flex flex-col gap-1.5 px-4 py-3 rounded-lg border text-sm',
                !attempted
                  ? 'bg-slate-50 border-slate-200 text-slate-400'
                  : notChecked
                    ? 'bg-slate-50 border-slate-300 text-slate-500'
                    : correct
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : awarded > 0
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-red-50 border-red-200 text-red-800',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <span className={[
                  'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0',
                  !attempted
                    ? 'bg-slate-200 text-slate-500'
                    : notChecked
                      ? 'bg-slate-300 text-slate-600'
                      : correct
                        ? 'bg-emerald-500 text-white'
                        : awarded > 0
                          ? 'bg-amber-500 text-white'
                          : 'bg-red-500 text-white',
                ].join(' ')}>
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-current opacity-80">
                  {q.text.slice(0, 60)}{q.text.length > 60 ? '…' : ''}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {!attempted ? `–/${q.marks}` : notChecked ? `?/${q.marks}` : `${awarded}/${q.marks}`}
                </span>
              </div>
              {notChecked && a.userAnswer && (
                <p className="text-xs text-slate-400 pl-9 italic">
                  Your answer: "{a.userAnswer.slice(0, 80)}{a.userAnswer.length > 80 ? '…' : ''}" — not AI-evaluated
                </p>
              )}
              {attempted && !correct && !notChecked && q.type === 'mcq' && q.answer && (
                <div className="pl-9 flex items-center gap-3 text-xs">
                  <span className="text-red-600">Your answer: <span className="font-medium">{a.userAnswer.slice(0, 60)}</span></span>
                  <span className="text-emerald-700">Correct: <span className="font-medium">{q.answer}</span></span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 px-4 py-2.5 rounded-lg border border-violet-300 text-violet-700 text-sm font-medium hover:bg-violet-50 transition-colors"
        >
          Practice Again
        </button>
        <button
          onClick={onExit}
          disabled={isSaving}
          className="flex-1 px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving…' : 'Back to Library'}
        </button>
      </div>
    </div>
  )
}
