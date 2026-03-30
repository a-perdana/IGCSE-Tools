interface Props {
  timeRemainingSeconds: number
  timeLimitSeconds: number
}

export function ExamTimer({ timeRemainingSeconds, timeLimitSeconds }: Props) {
  const m = Math.floor(timeRemainingSeconds / 60)
  const s = timeRemainingSeconds % 60
  const pct = timeLimitSeconds > 0 ? timeRemainingSeconds / timeLimitSeconds : 0
  const isWarning  = pct <= 0.25
  const isCritical = pct <= 0.1

  // SVG ring
  const radius = 20
  const circ   = 2 * Math.PI * radius
  const offset = circ - pct * circ

  const ringColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#6366f1'

  return (
    <div className={[
      'flex items-center gap-2.5 px-3.5 py-2 rounded-2xl font-mono font-black tabular-nums text-sm transition-all',
      isCritical ? 'bg-red-100 text-red-700 animate-pulse shadow-lg shadow-red-200' :
      isWarning  ? 'bg-amber-100 text-amber-700 shadow-md shadow-amber-100' :
                   'bg-indigo-100 text-indigo-700',
    ].join(' ')}>
      {/* Mini ring */}
      <svg width="28" height="28" className="-rotate-90 shrink-0">
        <circle cx="14" cy="14" r={radius} stroke={isCritical ? '#fecaca' : isWarning ? '#fef3c7' : '#e0e7ff'} strokeWidth="4" fill="none" />
        <circle
          cx="14" cy="14" r={radius}
          stroke={ringColor} strokeWidth="4" fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  )
}
