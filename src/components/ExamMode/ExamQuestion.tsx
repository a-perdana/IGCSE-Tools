import type { QuestionItem } from '../../lib/types'
import { QMarkdown, OptionContent } from '../Library/modals'
import { DiagramRenderer } from '../DiagramRenderer'
import { Pencil } from 'lucide-react'

const COMMAND_WORD_HINTS: Record<string, string> = {
  'State': 'Give a specific name, value or other brief answer — no explanation needed.',
  'Define': 'Give the precise meaning of a term.',
  'Describe': 'State the key features or steps — what happens, not why.',
  'Explain': 'Give a reason or mechanism — state what happens AND why.',
  'Suggest': 'Apply your knowledge to an unfamiliar situation — more than one answer may be acceptable.',
  'Calculate': 'Work out a numerical answer and show your working; include units.',
  'Determine': 'Use given data or information to reach an answer, showing working.',
  'Identify': 'Name or point out a specific feature, property or item.',
  'Compare': 'State similarities AND differences between two or more things.',
  'Contrast': 'State the differences between two or more things.',
  'Evaluate': 'Weigh up the evidence; come to a conclusion with justification.',
  'Discuss': 'Present arguments for and against; come to a reasoned conclusion.',
  'Predict': 'State the likely outcome based on given information.',
  'Sketch': 'Draw a simple, labelled diagram — accuracy less important than key features.',
  'Draw': 'Produce a diagram with accurate, labelled lines using a ruler where appropriate.',
  'Plot': 'Mark data points accurately on a graph and join them.',
  'Show': 'Present evidence or working that proves the statement given.',
  'Choose': 'Select one option from those given.',
  'Deduce': 'Reach a conclusion from given information — show your reasoning.',
  'Justify': 'Give evidence or reasons to support your answer.',
  'Outline': 'State the main points briefly — less detail than Describe.',
}

function CommandWordGuide({ word }: { word: string }) {
  const hint = COMMAND_WORD_HINTS[word]
  if (!hint) return null
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
      <span className="shrink-0 font-bold">{word}:</span>
      <span>{hint}</span>
    </div>
  )
}

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
  onEdit?: () => void
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
  onEdit,
}: Props) {
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
          {question.commandWord && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold" title="Cambridge command word — defines the type of response required">
              {question.commandWord}
            </span>
          )}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs" title="Suggested time — approx. 1.5 min per mark (Cambridge guideline)">
            ~{Math.max(1, Math.round(question.marks * 1.5))} min
          </span>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 text-slate-300 hover:text-blue-500 transition-colors rounded"
              title="Quick edit this question"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      </div>

      {/* Command word guidance */}
      {question.commandWord && (
        <CommandWordGuide word={question.commandWord} />
      )}

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
                <span className="text-sm leading-relaxed flex items-baseline gap-1">
                  <span className="font-semibold shrink-0">{['A', 'B', 'C', 'D'][i]}.</span>
                  <OptionContent opt={opt} />
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
