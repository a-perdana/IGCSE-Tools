import type { QuestionItem, PracticeAnswerRecord } from '../../lib/types'
import { QMarkdown, OptionContent } from '../Library/modals'
import { DiagramRenderer } from '../DiagramRenderer'
import { Pencil, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react'

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
    <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-700">
      <span className="shrink-0 font-black">{word}:</span>
      <span className="leading-relaxed">{hint}</span>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

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
  onGoTo: (index: number) => void
  onFinish: () => void
  isLastQuestion: boolean
  allChecked: boolean
  allAnswered: boolean
  allDraftAnswers: Record<string, string>
  checkedQuestions: Set<string>
  questions: QuestionItem[]
  hint?: string
  isHinting: boolean
  onHint: () => void
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
  allAnswered,
  allDraftAnswers,
  checkedQuestions,
  questions,
  onGoTo,
  hint,
  isHinting,
  onHint,
  onEdit,
}: Props) {
  const isChecked = checkedResult !== undefined
  const canCheck = draftAnswer.trim() !== '' && !isChecking && !isChecked

  return (
    <div className="flex flex-col gap-5 anim-slide-up">

      {/* ── Question card ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-lg border border-indigo-100 overflow-hidden">

        {/* Card header strip */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Q number badge */}
            <div className="flex items-center justify-center w-8 h-8 rounded-xl font-black text-sm text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
              {questionNumber}
            </div>
            <span className="text-xs font-semibold text-slate-400">of {totalQuestions}</span>

            {question.commandWord && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-black">
                {question.commandWord}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              {question.marks} mark{question.marks !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-semibold">
              ⏱ ~{Math.max(1, Math.round(question.marks * 1.5))} min
            </span>
          </div>

          {question.syllabusObjective && (
            <span className="hidden sm:inline text-xs text-slate-300 truncate max-w-[140px]">{question.syllabusObjective}</span>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 text-slate-300 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-colors"
              title="Quick edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Card body */}
        <div className="px-5 py-4 flex flex-col gap-4">

          {/* Command word guidance */}
          {question.commandWord && <CommandWordGuide word={question.commandWord} />}

          {/* Question text */}
          <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed">
            <QMarkdown content={question.text} />
          </div>

          {/* Diagram */}
          {question.hasDiagram && question.diagram && (
            <div className="my-1">
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
                      'flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all',
                      isChecked
                        ? isCorrectOpt
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : isWrongOpt
                            ? 'bg-red-50 border-red-400 text-red-800'
                            : 'bg-white border-slate-100 text-slate-400 opacity-60'
                        : isSelected
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-800 shadow-md'
                          : 'bg-white border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700',
                    ].join(' ')}
                  >
                    {/* Option letter circle */}
                    <div className={[
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5',
                      isChecked
                        ? isCorrectOpt ? 'bg-emerald-500 text-white' : isWrongOpt ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'
                        : isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500',
                    ].join(' ')}>
                      {['A', 'B', 'C', 'D'][i]}
                    </div>
                    <input type="radio" name={`q-${question.id}`} value={opt} checked={isSelected} onChange={() => onAnswerChange(opt)} className="sr-only" />
                    <span className="text-sm leading-relaxed flex-1">
                      <OptionContent opt={opt} />
                    </span>
                    {isChecked && isCorrectOpt && <span className="ml-auto text-emerald-600 text-xs font-bold shrink-0">✓</span>}
                    {isChecked && isWrongOpt && <span className="ml-auto text-red-600 text-xs font-bold shrink-0">✗</span>}
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
              placeholder="Write your answer here…"
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 placeholder-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500 disabled:resize-none transition-colors"
            />
          )}

          {/* Check + Hint buttons */}
          {!isChecked && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={onCheck}
                disabled={!canCheck}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 shadow-md"
                style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}
              >
                {isChecking ? <><Spinner /> Checking…</> : '✓ Check Answer'}
              </button>
              {!hint && (
                <button
                  onClick={onHint}
                  disabled={isHinting}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-amber-300 text-amber-700 text-sm font-bold hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isHinting ? <><Spinner /> Getting hint…</> : <><Lightbulb className="w-4 h-4" /> Hint</>}
                </button>
              )}
            </div>
          )}

          {/* Hint */}
          {hint && !isChecked && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-amber-50 border-2 border-amber-200 text-sm text-amber-800">
              <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>{hint}</span>
            </div>
          )}

          {/* Check error */}
          {checkError && (
            <p className="text-sm text-red-600 bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-3">
              {checkError}
            </p>
          )}

          {/* Result feedback */}
          {isChecked && (
            <div className={[
              'rounded-2xl border-2 p-4 flex flex-col gap-3 anim-pop',
              checkedResult.isCorrect
                ? 'bg-emerald-50 border-emerald-300'
                : checkedResult.marksAwarded > 0
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-red-50 border-red-300',
            ].join(' ')}>
              <div className="flex items-center justify-between">
                <span className={[
                  'flex items-center gap-2 font-black text-base',
                  checkedResult.isCorrect ? 'text-emerald-700' : checkedResult.marksAwarded > 0 ? 'text-amber-700' : 'text-red-700',
                ].join(' ')}>
                  {checkedResult.isCorrect ? '🎉 Correct!' : checkedResult.marksAwarded > 0 ? '⭐ Partial Credit' : '❌ Incorrect'}
                </span>
                <span className="text-sm font-black text-slate-600 tabular-nums">
                  {checkedResult.marksAwarded} / {question.marks} mark{question.marks !== 1 ? 's' : ''}
                </span>
              </div>

              {checkedResult.aiFeedback && (
                <p className="text-sm text-slate-700 leading-relaxed">{checkedResult.aiFeedback}</p>
              )}

              {checkedResult.criteriaBreakdown && checkedResult.criteriaBreakdown.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wide">Mark Breakdown</p>
                  {checkedResult.criteriaBreakdown.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={['shrink-0 font-black mt-0.5', c.awarded ? 'text-emerald-600' : 'text-red-500'].join(' ')}>
                        {c.awarded ? '✓' : '✗'}
                      </span>
                      <span className={c.awarded ? 'text-slate-700' : 'text-slate-400'}>{c.criterion}</span>
                    </div>
                  ))}
                </div>
              )}

              <details className="group">
                <summary className="cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-700 select-none list-none flex items-center gap-1">
                  <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  View Mark Scheme
                </summary>
                <div className="mt-2 pl-4 border-l-2 border-slate-200 prose prose-sm max-w-none text-slate-700">
                  <QMarkdown content={question.markScheme} />
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur rounded-3xl border border-indigo-100 p-4 flex flex-col gap-3 shadow-sm">
        {/* Question grid */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {questions.map((q, i) => {
            const checked = checkedQuestions.has(q.id)
            const hasAnswer = !!(allDraftAnswers[q.id]?.trim())
            const isCurrent = i === questionNumber - 1
            return (
              <button
                key={q.id}
                onClick={() => onGoTo(i)}
                title={`Q${i + 1}${checked ? ' (checked)' : hasAnswer ? ' (answered)' : ''}`}
                className={[
                  'w-8 h-8 rounded-xl text-xs font-black transition-all',
                  isCurrent
                    ? 'text-white shadow-md scale-110'
                    : checked
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : hasAnswer
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                ].join(' ')}
                style={isCurrent ? { background: 'linear-gradient(135deg,#6366f1,#a855f7)' } : {}}
              >
                {i + 1}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onPrev}
            disabled={!canGoPrev}
            className="flex items-center gap-1 px-4 py-2 text-sm rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>

          {allChecked || allAnswered ? (
            <button
              onClick={onFinish}
              className="flex-1 px-5 py-2.5 rounded-xl text-white text-sm font-black hover:opacity-90 transition-all shadow-md"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
            >
              {allChecked ? '🏁 Finish & See Results' : '📋 Submit All & Finish'}
            </button>
          ) : (
            <button
              onClick={onNext}
              disabled={!canGoNext}
              className="flex items-center gap-1 px-4 py-2 text-sm rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
