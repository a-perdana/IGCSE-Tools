import type { QuestionItem } from '../../lib/types'
import { QMarkdown } from '../Library/modals'
import { DiagramRenderer } from '../DiagramRenderer'

interface Props {
  question: QuestionItem
  questionNumber: number
  totalQuestions: number
  draftAnswer: string
  onAnswerChange: (value: string) => void
  onNext: () => void
  onPrev: () => void
  canGoNext: boolean
  canGoPrev: boolean
  onGoTo: (index: number) => void
  answeredCount: number
  allDraftAnswers: Record<string, string>
  questions: QuestionItem[]
}

export function ExamQuestion({
  question,
  questionNumber,
  totalQuestions,
  draftAnswer,
  onAnswerChange,
  onNext,
  onPrev,
  canGoNext,
  canGoPrev,
  onGoTo,
  allDraftAnswers,
  questions,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Question header */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span className="font-medium text-slate-700">
          Question {questionNumber} <span className="text-slate-400">/ {totalQuestions}</span>
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
          {question.marks} mark{question.marks !== 1 ? 's' : ''}
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
        <fieldset className="flex flex-col gap-2">
          {(question.options ?? []).map((opt, i) => {
            const isSelected = draftAnswer === opt
            return (
              <label
                key={i}
                className={[
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-blue-50 border-blue-400 text-blue-800'
                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name={`exam-q-${question.id}`}
                  value={opt}
                  checked={isSelected}
                  onChange={() => onAnswerChange(opt)}
                  className="mt-0.5 accent-blue-600 shrink-0"
                />
                <span className="text-sm leading-relaxed">
                  <span className="font-semibold mr-1">{['A', 'B', 'C', 'D'][i]}.</span>
                  {opt}
                </span>
              </label>
            )
          })}
        </fieldset>
      ) : (
        <textarea
          value={draftAnswer}
          onChange={e => onAnswerChange(e.target.value)}
          rows={5}
          placeholder="Type your answer here…"
          className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 placeholder-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <button
          onClick={onPrev}
          disabled={!canGoPrev}
          className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>

        {/* Question grid navigator */}
        <div className="flex flex-wrap gap-1 justify-center max-w-xs">
          {questions.map((q, i) => {
            const isAnswered = !!(allDraftAnswers[q.id]?.trim())
            const isCurrent = i === questionNumber - 1
            return (
              <button
                key={q.id}
                onClick={() => onGoTo(i)}
                className={[
                  'w-7 h-7 rounded text-xs font-medium transition-colors',
                  isCurrent
                    ? 'bg-blue-600 text-white'
                    : isAnswered
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                ].join(' ')}
                title={`Q${i + 1}${isAnswered ? ' (answered)' : ''}`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>

        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
