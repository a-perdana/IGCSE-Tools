import { MascotSVG, formFromLevel } from './MascotSVG'
import type { MascotMood } from './MascotSVG'
import type { UserProfile, BadgeId } from '../../lib/types'
import { BADGE_DEFINITIONS } from '../../lib/types'
import { levelFromXP } from '../../hooks/useGamification'

const FORM_LABELS: Record<ReturnType<typeof formFromLevel>, { name: string; tagline: string }> = {
  sprout:   { name: 'Sprout',   tagline: 'Just getting started — keep it up!' },
  scholar:  { name: 'Scholar',  tagline: 'Knowledge is growing fast!' },
  explorer: { name: 'Explorer', tagline: 'Boldly going where no student has gone!' },
  legend:   { name: 'Legend',   tagline: 'A true master of Cambridge IGCSE.' },
}

const NEXT_FORM_LEVEL: Record<ReturnType<typeof formFromLevel>, number | null> = {
  sprout:   5,
  scholar:  10,
  explorer: 20,
  legend:   null,
}

interface Props {
  profile: UserProfile | null
  mood: MascotMood
  userName?: string
}

export function MascotCard({ profile, mood, userName }: Props) {
  const level   = profile?.level ?? 1
  const xp      = profile?.xp ?? 0
  const badges  = (profile?.badges ?? []) as BadgeId[]
  const form    = formFromLevel(level)
  const formInfo = FORM_LABELS[form]
  const nextLevel = NEXT_FORM_LEVEL[form]
  const { currentXP, nextXP } = levelFromXP(xp)
  const xpPct = Math.round((currentXP / nextXP) * 100)

  const FORM_GRADIENT: Record<ReturnType<typeof formFromLevel>, string> = {
    sprout:   'linear-gradient(135deg,#a5f3fc 0%,#67e8f9 100%)',
    scholar:  'linear-gradient(135deg,#c4b5fd 0%,#a78bfa 100%)',
    explorer: 'linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)',
    legend:   'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
  }

  return (
    <div
      className="rounded-3xl overflow-hidden shadow-xl relative"
      style={{ background: FORM_GRADIENT[form] }}
    >
      {/* Background sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: 4 + (i % 3) * 4,
              height: 4 + (i % 3) * 4,
              top: `${10 + i * 14}%`,
              left: `${5 + i * 15}%`,
              opacity: 0.15 + (i % 3) * 0.07,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center px-5 pt-6 pb-5 gap-3">

        {/* Mascot */}
        <MascotSVG
          level={level}
          mood={mood}
          badges={badges}
          size={130}
          animate
        />

        {/* Name + form */}
        <div className="text-center">
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Edu · {formInfo.name}</p>
          {userName && <p className="text-white text-lg font-black mt-0.5">{userName.split(' ')[0]}'s Companion</p>}
          <p className="text-white/60 text-xs mt-1 leading-relaxed px-2">{formInfo.tagline}</p>
        </div>

        {/* Level + XP bar */}
        <div className="w-full bg-white/10 rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-white font-black">Level {level}</span>
            <span className="text-white/60 tabular-nums">{currentXP} / {nextXP} XP</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full quest-bar-fill"
              style={{ width: `${xpPct}%`, background: 'rgba(255,255,255,0.7)' }}
            />
          </div>
          {nextLevel && (
            <p className="text-white/50 text-[10px] mt-1.5 text-center">
              Evolves to {FORM_LABELS[nextLevel <= 5 ? 'scholar' : nextLevel <= 10 ? 'explorer' : 'legend'].name} at Level {nextLevel}
            </p>
          )}
        </div>

        {/* Recent badges strip */}
        {badges.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {badges.slice(-6).map((id: BadgeId) => (
              <span key={id} title={BADGE_DEFINITIONS[id]?.name} className="text-xl">
                {BADGE_DEFINITIONS[id]?.emoji ?? '🏅'}
              </span>
            ))}
            {badges.length > 6 && (
              <span className="text-white/60 text-xs font-bold">+{badges.length - 6}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
