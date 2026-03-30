import type { Assessment, ExamAnswerRecord } from '../../lib/types'
import { QMarkdown } from '../Library/modals'

interface Props {
  assessment: Assessment
  results: Record<string, ExamAnswerRecord>
  totalMarks: number
  marksAwarded: number
  durationSeconds: number
  timeLimitSeconds: number
  autoSubmitted: boolean
  isSaving: boolean
  onRetry: () => void
  onExit: () => void
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

export function ExamResults({
  assessment,
  results,
  totalMarks,
  marksAwarded,
  durationSeconds,
  timeLimitSeconds,
  autoSubmitted,
  isSaving,
  onRetry,
  onExit,
}: Props) {
  const pct = totalMarks > 0 ? Math.round((marksAwarded / totalMarks) * 100) : 0
  const grade =
    pct >= 80 ? { label: 'Excellent!',   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' } :
    pct >= 70 ? { label: 'Well done!',    color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' } :
    pct >= 50 ? { label: 'Good effort',   color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' } :
                { label: 'Keep revising', color: 'text-red-500',     bg: 'bg-red-50 border-red-200' }

  const attempted = Object.values(results).filter(r => r.userAnswer.trim() !== '').length
  const unanswered = assessment.questions.length - attempted

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto py-6">
      {/* Auto-submit banner */}
      {autoSubmitted && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Time's up — exam was automatically submitted.
        </div>
      )}

      {/* Score card */}
      <div className={`rounded-2xl border-2 p-8 text-center ${grade.bg}`}>
        <p className={`text-sm font-medium text-slate-500 mb-1`}>{grade.label}</p>
        <p className={`text-6xl font-bold tabular-nums ${grade.color}`}>{pct}%</p>
        <p className="mt-2 text-lg text-slate-600">{marksAwarded} / {totalMarks} marks</p>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-400 flex-wrap">
          <span>Time used: {formatDuration(durationSeconds)} / {formatDuration(timeLimitSeconds)}</span>
          {unanswered > 0 && <span className="text-amber-600">{unanswered} unanswered</span>}
        </div>
      </div>

      {/* Per-question review */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Question Review</h3>
        {assessment.questions.map((q, i) => {
          const r = results[q.id]
          const awarded = r?.marksAwarded ?? 0
          const correct = r?.isCorrect ?? false
          const answered = r?.userAnswer.trim() !== ''

          return (
            <details key={q.id} className={[
              'rounded-lg border overflow-hidden group',
              !answered ? 'border-slate-200' :
              correct    ? 'border-emerald-200' :
              awarded > 0 ? 'border-amber-200' :
                            'border-red-200',
            ].join(' ')}>
              <summary className={[
                'flex items-center gap-3 px-4 py-3 cursor-pointer select-none list-none',
                !answered ? 'bg-slate-50' :
                correct    ? 'bg-emerald-50' :
                awarded > 0 ? 'bg-amber-50' :
                              'bg-red-50',
              ].join(' ')}>
                <span className={[
                  'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0',
                  !answered ? 'bg-slate-200 text-slate-500' :
                  correct    ? 'bg-emerald-500 text-white' :
                  awarded > 0 ? 'bg-amber-500 text-white' :
                                'bg-red-500 text-white',
                ].join(' ')}>{i + 1}</span>
                <span className="flex-1 text-sm text-slate-700 truncate">
                  {q.text.slice(0, 70)}{q.text.length > 70 ? '…' : ''}
                </span>
                <span className="shrink-0 text-sm font-medium text-slate-500 tabular-nums">
                  {answered ? `${awarded}/${q.marks}` : `–/${q.marks}`}
                </span>
                <svg className="w-3 h-3 text-slate-400 group-open:rotate-90 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </summary>

              <div className="px-4 py-3 border-t border-slate-100 bg-white flex flex-col gap-3 text-sm">
                {r?.userAnswer ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Your answer</p>
                      <p className={['text-sm whitespace-pre-wrap', correct ? 'text-emerald-700' : awarded > 0 ? 'text-amber-700' : 'text-red-700'].join(' ')}>
                        {r.userAnswer}
                      </p>
                    </div>
                    {!correct && q.type === 'mcq' && q.answer && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Correct answer</p>
                        <p className="text-sm text-emerald-700 font-medium">{q.answer}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Not answered</p>
                )}
                {r?.aiFeedback && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Feedback</p>
                    <p className="text-slate-600">{r.aiFeedback}</p>
                  </div>
                )}
                {r?.criteriaBreakdown && r.criteriaBreakdown.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Mark breakdown</p>
                    <div className="flex flex-col gap-1">
                      {r.criteriaBreakdown.map((c, ci) => (
                        <div key={ci} className="flex items-start gap-2 text-xs">
                          <span className={['shrink-0 font-bold mt-0.5', c.awarded ? 'text-emerald-600' : 'text-red-500'].join(' ')}>
                            {c.awarded ? '✓' : '✗'}
                          </span>
                          <span className={c.awarded ? 'text-slate-700' : 'text-slate-500'}>{c.criterion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <details className="group/ms">
                  <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600 select-none list-none flex items-center gap-1">
                    <svg className="w-3 h-3 group-open/ms:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    Mark scheme
                  </summary>
                  <div className="mt-2 pl-4 border-l-2 border-slate-200 prose prose-sm max-w-none text-slate-700">
                    <QMarkdown content={q.markScheme} />
                  </div>
                </details>
              </div>
            </details>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 px-4 py-2.5 rounded-lg border border-blue-300 text-blue-700 text-sm font-medium hover:bg-blue-50 transition-colors"
        >
          Retake Exam
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
