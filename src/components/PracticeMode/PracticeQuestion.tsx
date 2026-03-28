import type { QuestionItem, PracticeAnswerRecord } from '../../lib/types'
import { QMarkdown } from '../Library/modals'
import { DiagramRenderer } from '../DiagramRenderer'
import { Pencil } from 'lucide-react'

interface Props {
  question: QuestionItem
  questionNumber: number
  totalQuestions: number
  draftAnswer: string
  checkedResult: PracticeAnswerRecord | undefined
  isChecking: boolean
  checkError: string | null
  onAnswerChange: (value: string) => void
  onCheck: () => void
  onNext: () => void
  onPrev: () => void
  canGoNext: boolean
  canGoPrev: boolean
  onFinish: () => void
  isLastQuestion: boolean
  allChecked: boolean
  onEdit?: () => void
}

export function PracticeQuestion({
  question,
  questionNumber,
  totalQuestions,
  draftAnswer,
  checkedResult,
  isChecking,
  checkError,
  onAnswerChange,
  onCheck,
  onNext,
  onPrev,
  canGoNext,
  canGoPrev,
  onFinish,
  isLastQuestion,
  allChecked,
  onEdit,
}: Props) {
  const isChecked = checkedResult !== undefined
  const canCheck = draftAnswer.trim() !== '' && !isChecking && !isChecked

  return (
    <div className="flex flex-col gap-6">
      {/* Question header */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span className="font-medium text-slate-700">
          Question {questionNumber} <span className="text-slate-400">/ {totalQuestions}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
            {question.marks} mark{question.marks !== 1 ? 's' : ''}
          </span>
          {question.syllabusObjective && (
            <span className="hidden sm:inline text-xs text-slate-400">{question.syllabusObjective}</span>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 text-slate-300 hover:text-violet-500 transition-colors rounded"
              title="Quick edit this question"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      </div>

      {/* Question text */}
      <div className="prose prose-sm max-w-none text-slate-800">
        <QMarkdown content={question.text} />
      </div>

      {/* Diagram */}
      {question.hasDiagram && question.diagram && (
        <div className="my-2">
          <DiagramRenderer spec={question.diagram} />
        </div>
      )}

      {/* Answer input */}
      {question.type === 'mcq' ? (
        <fieldset className="flex flex-col gap-2" disabled={isChecked}>
          {(question.options ?? []).map((opt, i) => {
            const isSelected = draftAnswer === opt
            const isCorrectOpt = isChecked && opt === question.answer
            const isWrongOpt = isChecked && isSelected && !checkedResult?.isCorrect

            return (
              <label
                key={i}
                className={[
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  isChecked
                    ? isCorrectOpt
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : isWrongOpt
                        ? 'bg-red-50 border-red-400 text-red-800'
                        : 'bg-white border-slate-200 text-slate-400 opacity-60'
                    : isSelected
                      ? 'bg-violet-50 border-violet-400 text-violet-800'
                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value={opt}
                  checked={isSelected}
                  onChange={() => onAnswerChange(opt)}
                  className="mt-0.5 accent-violet-600 shrink-0"
                />
                <span className="text-sm leading-relaxed flex items-baseline gap-1">
                  <span className="font-semibold shrink-0">{['A', 'B', 'C', 'D'][i]}.</span>
                  <QMarkdown content={opt} />
                </span>
                {isChecked && isCorrectOpt && (
                  <span className="ml-auto text-emerald-600 text-xs font-medium shrink-0">✓ Correct</span>
                )}
                {isChecked && isWrongOpt && (
                  <span className="ml-auto text-red-600 text-xs font-medium shrink-0">✗ Wrong</span>
                )}
              </label>
            )
          })}
        </fieldset>
      ) : (
        <textarea
          value={draftAnswer}
          onChange={e => onAnswerChange(e.target.value)}
          disabled={isChecked}
          rows={5}
          placeholder="Type your answer here…"
          className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 placeholder-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 disabled:resize-none"
        />
      )}

      {/* Check answer button */}
      {!isChecked && (
        <button
          onClick={onCheck}
          disabled={!canCheck}
          className="self-start px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isChecking ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Checking…
            </span>
          ) : 'Check Answer'}
        </button>
      )}

      {/* Check error */}
      {checkError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {checkError}
        </p>
      )}

      {/* Result feedback */}
      {isChecked && (
        <div className={[
          'rounded-xl border p-4 flex flex-col gap-3',
          checkedResult.isCorrect
            ? 'bg-emerald-50 border-emerald-300'
            : checkedResult.marksAwarded > 0
              ? 'bg-amber-50 border-amber-300'
              : 'bg-red-50 border-red-300',
        ].join(' ')}>
          <div className="flex items-center justify-between">
            <span className={[
              'flex items-center gap-2 font-semibold text-sm',
              checkedResult.isCorrect ? 'text-emerald-700' : checkedResult.marksAwarded > 0 ? 'text-amber-700' : 'text-red-700',
            ].join(' ')}>
              {checkedResult.isCorrect ? '✓ Correct!' : checkedResult.marksAwarded > 0 ? '~ Partial credit' : '✗ Incorrect'}
            </span>
            <span className="text-sm font-medium text-slate-600">
              {checkedResult.marksAwarded} / {question.marks} mark{question.marks !== 1 ? 's' : ''}
            </span>
          </div>

          {checkedResult.aiFeedback && (
            <p className="text-sm text-slate-700 leading-relaxed">{checkedResult.aiFeedback}</p>
          )}

          {/* Mark scheme */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1">
              <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              View mark scheme
            </summary>
            <div className="mt-2 pl-4 border-l-2 border-slate-200 prose prose-sm max-w-none text-slate-700">
              <QMarkdown content={question.markScheme} />
            </div>
          </details>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <button
          onClick={onPrev}
          disabled={!canGoPrev}
          className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>

        {isLastQuestion && allChecked ? (
          <button
            onClick={onFinish}
            className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Finish & See Results →
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={!canGoNext}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
