import { useEffect, useState } from 'react'
import type { BadgeId } from '../../lib/types'
import { BADGE_DEFINITIONS } from '../../lib/types'
import { X } from 'lucide-react'

// Confetti dot
function Dot({ x, color, delay, size }: { x: number; color: string; delay: number; size: number }) {
  return (
    <div
      className="absolute top-0 rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        width: size,
        height: size,
        backgroundColor: color,
        animation: `confettiFall 1.6s ${delay}s ease-out forwards`,
        opacity: 0,
      }}
    />
  )
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316']

interface Props {
  badgeId: BadgeId
  onDismiss: () => void
}

export function BadgeUnlockModal({ badgeId, onDismiss }: Props) {
  const def = BADGE_DEFINITIONS[badgeId]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Small delay for the pop-in to feel deliberate
    const t = setTimeout(() => setVisible(true), 50)
    // Auto-dismiss after 5s
    const auto = setTimeout(() => onDismiss(), 5000)
    return () => { clearTimeout(t); clearTimeout(auto) }
  }, [onDismiss])

  const dots = Array.from({ length: 20 }, (_, i) => ({
    x: (i / 20) * 100 + (Math.random() * 4 - 2),
    color: COLORS[i % COLORS.length],
    delay: i * 0.05,
    size: 6 + (i % 3) * 3,
  }))

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
      <div
        className={[
          'relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl pointer-events-auto transition-all duration-500',
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
        ].join(' ')}
        style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#a855f7 100%)' }}
      >
        {/* Confetti */}
        {dots.map((d, i) => <Dot key={i} {...d} />)}

        {/* Close */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center px-8 py-8 gap-4">
          {/* Badge icon */}
          <div
            className="text-6xl anim-pop"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
          >
            {def.emoji}
          </div>

          <div>
            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">
              Badge Unlocked!
            </p>
            <p className="text-white text-2xl font-black">{def.name}</p>
            <p className="text-white/70 text-sm mt-1 leading-relaxed">{def.description}</p>
          </div>

          {/* XP reward */}
          <div className="bg-white/15 rounded-2xl px-5 py-2.5 flex items-center gap-2">
            <span className="text-amber-300 font-black text-lg">+{def.xpReward} XP</span>
            <span className="text-white/60 text-sm">bonus earned</span>
          </div>

          <button
            onClick={onDismiss}
            className="w-full py-3 rounded-2xl bg-white text-indigo-700 font-black text-sm hover:bg-indigo-50 transition-colors shadow-md"
          >
            Awesome! 🎉
          </button>
        </div>
      </div>
    </div>
  )
}
