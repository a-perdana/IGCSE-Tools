import { useEffect, useState } from 'react'
import { MascotSVG, formFromLevel } from '../Mascot/MascotSVG'
import type { MascotForm } from '../Mascot/MascotSVG'

const FORM_LABELS: Record<MascotForm, { name: string; tagline: string; color: string }> = {
  sprout:   { name: 'Scholar',   tagline: 'Knowledge is growing fast!',                    color: '#a78bfa' },
  scholar:  { name: 'Explorer',  tagline: 'Boldly going where no student has gone!',        color: '#6366f1' },
  explorer: { name: 'Legend',    tagline: 'A true master of Cambridge IGCSE.',              color: '#f59e0b' },
  legend:   { name: 'Legend',    tagline: 'The ultimate form. You are unstoppable.',         color: '#f59e0b' },
}

interface Props {
  previousForm: MascotForm
  newLevel: number
  onDismiss: () => void
}

export function LevelUpModal({ previousForm, newLevel, onDismiss }: Props) {
  const [phase, setPhase] = useState<'old' | 'flash' | 'new'>('old')
  const newForm = formFromLevel(newLevel)
  const newInfo = FORM_LABELS[previousForm]

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('flash'), 1200)
    const t2 = setTimeout(() => setPhase('new'), 1800)
    const t3 = setTimeout(() => onDismiss(), 6000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDismiss])

  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360
    const dist = 80 + Math.random() * 60
    const delay = Math.random() * 0.5
    const size = 4 + Math.floor(Math.random() * 6)
    const colors = ['#6366f1', '#a855f7', '#f59e0b', '#34d399', '#fb7185', '#38bdf8']
    const color = colors[i % colors.length]
    return { angle, dist, delay, size, color }
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={phase === 'new' ? onDismiss : undefined}
    >
      <div className="relative flex flex-col items-center gap-6 px-8 py-10 max-w-xs w-full">

        {/* Particle burst */}
        {phase === 'new' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {particles.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  animation: `particleBurst 1.2s ease-out ${p.delay}s both`,
                  // Use CSS custom properties for the translate target
                  '--tx': `${Math.cos((p.angle * Math.PI) / 180) * p.dist}px`,
                  '--ty': `${Math.sin((p.angle * Math.PI) / 180) * p.dist}px`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        {/* Flash overlay */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none transition-opacity duration-300"
          style={{
            background: 'white',
            opacity: phase === 'flash' ? 1 : 0,
          }}
        />

        {/* Mascot display */}
        <div
          className="relative transition-all duration-500"
          style={{
            transform: phase === 'new' ? 'scale(1)' : phase === 'flash' ? 'scale(1.3)' : 'scale(1)',
            opacity: phase === 'flash' ? 0 : 1,
          }}
        >
          {phase === 'old' && (
            <div style={{ animation: 'evolveShake 1s ease-in-out' }}>
              <MascotSVG level={newLevel - 1} mood="excited" size={160} animate />
            </div>
          )}
          {phase === 'new' && (
            <div style={{ animation: 'evolveReveal 0.6s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              <MascotSVG level={newLevel} mood="excited" size={160} animate />
            </div>
          )}
        </div>

        {/* Text */}
        {phase === 'new' && (
          <div
            className="text-center"
            style={{ animation: 'evolveReveal 0.5s ease-out 0.2s both' }}
          >
            <p
              className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: newInfo.color }}
            >
              EVOLVED!
            </p>
            <p className="text-white text-3xl font-black mb-1">
              Edu · {newInfo.name}
            </p>
            <p className="text-white/60 text-sm leading-relaxed">
              {newInfo.tagline}
            </p>
            <p className="text-white/40 text-xs mt-4">Tap anywhere to continue</p>
          </div>
        )}

        {phase === 'old' && (
          <div className="text-center">
            <p
              className="text-white/80 text-lg font-black"
              style={{ animation: 'evolveShake 1s ease-in-out' }}
            >
              Edu is evolving...
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes evolveShake {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-4deg) scale(1.05); }
          30% { transform: rotate(4deg) scale(1.08); }
          45% { transform: rotate(-3deg) scale(1.06); }
          60% { transform: rotate(3deg) scale(1.09); }
          75% { transform: rotate(-2deg) scale(1.07); }
          90% { transform: rotate(2deg) scale(1.05); }
        }
        @keyframes evolveReveal {
          from { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          to   { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes particleBurst {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
