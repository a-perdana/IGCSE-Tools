interface Props {
  timeRemainingSeconds: number
  timeLimitSeconds: number
}

export function ExamTimer({ timeRemainingSeconds, timeLimitSeconds }: Props) {
  const m = Math.floor(timeRemainingSeconds / 60)
  const s = timeRemainingSeconds % 60
  const pct = timeLimitSeconds > 0 ? timeRemainingSeconds / timeLimitSeconds : 0
  const isWarning = pct <= 0.25
  const isCritical = pct <= 0.1

  return (
    <div className={[
      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono font-bold tabular-nums',
      isCritical ? 'bg-red-100 text-red-700 animate-pulse' :
      isWarning  ? 'bg-amber-100 text-amber-700' :
                   'bg-slate-100 text-slate-700',
    ].join(' ')}>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M12 6v6l4 2" />
      </svg>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  )
}
