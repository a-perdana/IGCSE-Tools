import { useEffect, useState } from 'react'
import type { Assessment, PracticeAnswerRecord } from '../../lib/types'
import { Trophy, RefreshCw, ArrowLeft } from 'lucide-react'

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

// Animated score ring
function ScoreRing({ pct }: { pct: number }) {
  const [displayed, setDisplayed] = useState(0)
  const radius = 54
  const circ = 2 * Math.PI * radius
  const offset = circ - (displayed / 100) * circ

  const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const bg    = pct >= 70 ? '#d1fae5' : pct >= 50 ? '#fef3c7' : '#fee2e2'

  useEffect(() => {
    const t = setTimeout(() => setDisplayed(pct), 120)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} stroke={bg} strokeWidth="12" fill="none" />
        <circle
          cx="70" cy="70" r={radius}
          stroke={color} strokeWidth="12" fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="score-ring-progress"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black tabular-nums" style={{ color }}>{pct}%</span>
      </div>
    </div>
  )
}

// Confetti dots (pure CSS animation)
function ConfettiDot({ x, color, delay, size }: { x: number; color: string; delay: number; size: number }) {
  return (
    <div
      className="absolute top-0 rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        width: size,
        height: size,
        backgroundColor: color,
        animation: `confettiFall 1.4s ${delay}s ease-out forwards`,
        opacity: 0,
      }}
    />
  )
}

const CONFETTI_COLORS = ['#6366f1','#a855f7','#ec4899','#f59e0b','#10b981','#3b82f6','#f97316']

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
  const isWin = pct >= 70

  const grade =
    pct >= 90 ? { label: 'Outstanding! 🏆', sub: 'You absolutely nailed it!' } :
    pct >= 70 ? { label: 'Well done! 🎉',   sub: 'Great work — keep it up!' } :
    pct >= 50 ? { label: 'Good effort! ⭐',  sub: 'A bit more practice and you\'ll get there.' } :
                { label: 'Keep going! 💪',   sub: 'Review the mark scheme and try again.' }

  // XP gained
  const xpGained = marksAwarded * 10

  // confetti dots
  const dots = isWin
    ? Array.from({ length: 18 }, (_, i) => ({
        x: (i / 18) * 100 + (Math.random() * 5 - 2.5),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: i * 0.06,
        size: 6 + (i % 3) * 3,
      }))
    : []

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto py-4 anim-slide-up">

      {/* ── Score hero card ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl shadow-xl text-center px-6 py-8"
        style={{ background: isWin
          ? 'linear-gradient(135deg,#6366f1 0%,#a855f7 50%,#ec4899 100%)'
          : 'linear-gradient(135deg,#64748b 0%,#475569 100%)' }}>

        {/* Confetti */}
        {dots.map((d, i) => <ConfettiDot key={i} {...d} />)}

        <div className="flex flex-col items-center gap-4">
          <ScoreRing pct={pct} />

          <div>
            <p className="text-white text-xl font-black">{grade.label}</p>
            <p className="text-white/70 text-sm mt-1">{grade.sub}</p>
          </div>

          <div className="flex items-center gap-6 mt-1">
            <div className="text-center">
              <p className="text-white font-black text-lg tabular-nums">{marksAwarded}/{totalMarks}</p>
              <p className="text-white/60 text-xs">marks</p>
            </div>
            {durationSeconds > 0 && (
              <div className="text-center">
                <p className="text-white font-black text-lg">{formatDuration(durationSeconds)}</p>
                <p className="text-white/60 text-xs">time</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-amber-300 font-black text-lg">+{xpGained} XP</p>
              <p className="text-white/60 text-xs">earned</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Topic + subject ─────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur rounded-2xl border border-indigo-100 px-5 py-3 flex items-center gap-3 shadow-sm">
        <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-xs text-slate-400 font-semibold">{assessment.subject}</p>
          <p className="text-sm font-black text-slate-700">{assessment.topic || assessment.subject}</p>
        </div>
      </div>

      {/* ── Question breakdown ──────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Question Breakdown</h3>
        {assessment.questions.map((q, i) => {
          const a = answers[q.id]
          const awarded = a?.marksAwarded ?? 0
          const correct = a?.isCorrect ?? false
          const attempted = a !== undefined
          const notChecked = attempted && a.aiFeedback === 'Not checked — submitted without AI evaluation.'

          const statusIcon = !attempted ? '○' : notChecked ? '?' : correct ? '✓' : awarded > 0 ? '◑' : '✗'
          const cardCls = !attempted
            ? 'bg-slate-50 border-slate-200 text-slate-400'
            : notChecked
              ? 'bg-slate-50 border-slate-300 text-slate-500'
              : correct
                ? 'bg-emerald-50 border-emerald-200'
                : awarded > 0
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-red-50 border-red-200'

          const circleCls = !attempted
            ? 'bg-slate-200 text-slate-500'
            : notChecked
              ? 'bg-slate-300 text-slate-600'
              : correct
                ? 'bg-emerald-500 text-white'
                : awarded > 0
                  ? 'bg-amber-500 text-white'
                  : 'bg-red-500 text-white'

          return (
            <div key={q.id} className={`flex flex-col gap-1.5 px-4 py-3 rounded-2xl border-2 text-sm ${cardCls}`}>
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-7 h-7 rounded-xl text-xs font-black shrink-0 ${circleCls}`}>
                  {statusIcon}
                </div>
                <span className="flex-1 truncate text-slate-700 font-medium">
                  {q.text.slice(0, 60)}{q.text.length > 60 ? '…' : ''}
                </span>
                <span className="shrink-0 font-black tabular-nums text-slate-600">
                  {!attempted ? `–/${q.marks}` : notChecked ? `?/${q.marks}` : `${awarded}/${q.marks}`}
                </span>
              </div>
              {notChecked && a.userAnswer && (
                <p className="text-xs text-slate-400 pl-10 italic">
                  Your answer: "{a.userAnswer.slice(0, 80)}{a.userAnswer.length > 80 ? '…' : ''}" — not AI-evaluated
                </p>
              )}
              {attempted && !correct && !notChecked && q.type === 'mcq' && q.answer && (
                <div className="pl-10 flex items-center gap-3 text-xs">
                  <span className="text-red-600">Your: <span className="font-bold">{a.userAnswer.slice(0, 60)}</span></span>
                  <span className="text-emerald-700">Correct: <span className="font-bold">{q.answer}</span></span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-2xl border-2 border-indigo-300 text-indigo-700 text-sm font-black hover:bg-indigo-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
        <button
          onClick={onExit}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 flex-1 px-4 py-3 rounded-2xl text-white text-sm font-black hover:opacity-90 disabled:opacity-50 transition-all shadow-md"
          style={{ background: 'linear-gradient(135deg,#1e293b,#334155)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          {isSaving ? 'Saving…' : 'Back to Library'}
        </button>
      </div>
    </div>
  )
}
