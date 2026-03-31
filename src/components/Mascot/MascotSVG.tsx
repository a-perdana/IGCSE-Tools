/**
 * Edu — the IGCSE Tools mascot.
 *
 * 4 evolution forms driven by level:
 *   Sprout   (1–4)   — tiny, round, curious
 *   Scholar  (5–9)   — grown, book in hand
 *   Explorer (10–19) — full astronaut suit
 *   Legend   (20+)   — golden armour + halo
 *
 * Mood variants: idle | happy | thinking | excited | ready
 *
 * Accessories are rendered as SVG overlay layers keyed to badge IDs.
 */

import type { BadgeId } from '../../lib/types'

export type MascotForm = 'sprout' | 'scholar' | 'explorer' | 'legend'
export type MascotMood = 'idle' | 'happy' | 'thinking' | 'excited' | 'ready'

export function formFromLevel(level: number): MascotForm {
  if (level >= 20) return 'legend'
  if (level >= 10) return 'explorer'
  if (level >= 5)  return 'scholar'
  return 'sprout'
}

// ── Palette per form ──────────────────────────────────────────────────────────

type PaletteEntry = {
  body: string; bodyShade: string; suit: string; suitShade: string
  visor: string; visorSheen: string; skin: string; skinShade: string
  glow: string
}

const PALETTE: Record<MascotForm, PaletteEntry> = {
  sprout: {
    body: '#a5f3fc', bodyShade: '#67e8f9',
    suit: '#e0f2fe', suitShade: '#bae6fd',
    visor: '#f0fdff', visorSheen: '#ffffff',
    skin: '#fde68a', skinShade: '#fbbf24',
    glow: '#67e8f9',
  },
  scholar: {
    body: '#c4b5fd', bodyShade: '#a78bfa',
    suit: '#ede9fe', suitShade: '#ddd6fe',
    visor: '#f5f3ff', visorSheen: '#ffffff',
    skin: '#fde68a', skinShade: '#fbbf24',
    glow: '#a78bfa',
  },
  explorer: {
    body: '#6366f1', bodyShade: '#4f46e5',
    suit: '#c7d2fe', suitShade: '#a5b4fc',
    visor: '#e0f2fe', visorSheen: '#ffffff',
    skin: '#fde68a', skinShade: '#fbbf24',
    glow: '#818cf8',
  },
  legend: {
    body: '#f59e0b', bodyShade: '#d97706',
    suit: '#fef3c7', suitShade: '#fde68a',
    visor: '#fffbeb', visorSheen: '#ffffff',
    skin: '#fde68a', skinShade: '#fbbf24',
    glow: '#fbbf24',
  },
}

// ── Eye shapes per mood ───────────────────────────────────────────────────────

function Eyes({ mood, cx, cy, scale = 1 }: { mood: MascotMood; cx: number; cy: number; scale?: number }) {
  const s = scale
  const lx = cx - 10 * s
  const rx = cx + 10 * s

  if (mood === 'happy') return (
    <g>
      {/* Arc eyes (happy) */}
      <path d={`M${lx - 5 * s},${cy} Q${lx},${cy - 7 * s} ${lx + 5 * s},${cy}`} stroke="#1e293b" strokeWidth={2 * s} fill="none" strokeLinecap="round" />
      <path d={`M${rx - 5 * s},${cy} Q${rx},${cy - 7 * s} ${rx + 5 * s},${cy}`} stroke="#1e293b" strokeWidth={2 * s} fill="none" strokeLinecap="round" />
    </g>
  )

  if (mood === 'thinking') return (
    <g>
      {/* Squinting eyes */}
      <ellipse cx={lx} cy={cy} rx={5 * s} ry={3 * s} fill="#1e293b" />
      <ellipse cx={rx} cy={cy} rx={5 * s} ry={3 * s} fill="#1e293b" />
      {/* Furrowed brow */}
      <path d={`M${lx - 6 * s},${cy - 8 * s} L${lx + 4 * s},${cy - 5 * s}`} stroke="#1e293b" strokeWidth={2 * s} strokeLinecap="round" />
      <path d={`M${rx - 4 * s},${cy - 5 * s} L${rx + 6 * s},${cy - 8 * s}`} stroke="#1e293b" strokeWidth={2 * s} strokeLinecap="round" />
    </g>
  )

  if (mood === 'excited') return (
    <g>
      {/* Star eyes */}
      {[lx, rx].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={cy} r={6 * s} fill="#f59e0b" />
          <path d={`M${x},${cy - 6 * s} L${x + 1.5 * s},${cy - 2 * s} L${x + 5.7 * s},${cy - 1.9 * s} L${x + 2.5 * s},${cy + 1.8 * s} L${x + 3.5 * s},${cy + 6 * s} L${x},${cy + 3.5 * s} L${x - 3.5 * s},${cy + 6 * s} L${x - 2.5 * s},${cy + 1.8 * s} L${x - 5.7 * s},${cy - 1.9 * s} L${x - 1.5 * s},${cy - 2 * s} Z`} fill="#ffffff" opacity={0.9} />
        </g>
      ))}
    </g>
  )

  if (mood === 'ready') return (
    <g>
      {/* Determined eyes — half-closed */}
      <ellipse cx={lx} cy={cy} rx={6 * s} ry={4 * s} fill="#1e293b" />
      <ellipse cx={rx} cy={cy} rx={6 * s} ry={4 * s} fill="#1e293b" />
      <ellipse cx={lx} cy={cy - 1 * s} rx={6 * s} ry={2.5 * s} fill="#1e293b" />
      <ellipse cx={rx} cy={cy - 1 * s} rx={6 * s} ry={2.5 * s} fill="#1e293b" />
      {/* Gleam */}
      <circle cx={lx + 2 * s} cy={cy - 1.5 * s} r={1.5 * s} fill="white" />
      <circle cx={rx + 2 * s} cy={cy - 1.5 * s} r={1.5 * s} fill="white" />
    </g>
  )

  // idle — default round eyes
  return (
    <g>
      <circle cx={lx} cy={cy} r={6 * s} fill="#1e293b" />
      <circle cx={rx} cy={cy} r={6 * s} fill="#1e293b" />
      <circle cx={lx + 2 * s} cy={cy - 2 * s} r={2 * s} fill="white" />
      <circle cx={rx + 2 * s} cy={cy - 2 * s} r={2 * s} fill="white" />
    </g>
  )
}

// ── Mouth per mood ────────────────────────────────────────────────────────────

function Mouth({ mood, cx, cy, scale = 1 }: { mood: MascotMood; cx: number; cy: number; scale?: number }) {
  const s = scale
  if (mood === 'happy' || mood === 'excited') return (
    <path d={`M${cx - 8 * s},${cy} Q${cx},${cy + 8 * s} ${cx + 8 * s},${cy}`} stroke="#1e293b" strokeWidth={2.5 * s} fill="none" strokeLinecap="round" />
  )
  if (mood === 'thinking') return (
    <path d={`M${cx - 5 * s},${cy + 2 * s} Q${cx},${cy - 2 * s} ${cx + 5 * s},${cy + 2 * s}`} stroke="#1e293b" strokeWidth={2 * s} fill="none" strokeLinecap="round" />
  )
  if (mood === 'ready') return (
    <path d={`M${cx - 7 * s},${cy} L${cx + 7 * s},${cy}`} stroke="#1e293b" strokeWidth={2.5 * s} strokeLinecap="round" />
  )
  // idle — small smile
  return (
    <path d={`M${cx - 6 * s},${cy} Q${cx},${cy + 5 * s} ${cx + 6 * s},${cy}`} stroke="#1e293b" strokeWidth={2 * s} fill="none" strokeLinecap="round" />
  )
}

// ── Accessory overlays ────────────────────────────────────────────────────────

function AccessoryLayer({ badges, form }: { badges: BadgeId[]; form: MascotForm }) {
  const has = (id: BadgeId) => badges.includes(id)
  return (
    <g>
      {/* streak_3 → flame on left shoulder */}
      {has('streak_3') && (
        <g transform="translate(16, 68)">
          <ellipse cx={0} cy={8} rx={5} ry={8} fill="#f97316" opacity={0.85} />
          <ellipse cx={0} cy={5} rx={3} ry={5} fill="#fbbf24" opacity={0.9} />
          <ellipse cx={0} cy={3} rx={1.5} ry={3} fill="#fef9c3" />
        </g>
      )}
      {/* first_perfect → diamond badge on chest */}
      {has('first_perfect') && (
        <g transform="translate(56, 82)">
          <polygon points="0,-7 5,0 0,7 -5,0" fill="#67e8f9" stroke="#0891b2" strokeWidth={1} />
          <polygon points="0,-4 3,0 0,4 -3,0" fill="white" opacity={0.7} />
        </g>
      )}
      {/* level_5 → star clip on visor */}
      {has('level_5') && (
        <g transform="translate(72, 36)">
          <polygon points="0,-6 1.8,-1.8 6.3,-1.8 2.7,1.4 3.8,6 0,3.6 -3.8,6 -2.7,1.4 -6.3,-1.8 -1.8,-1.8" fill="#fbbf24" stroke="#d97706" strokeWidth={0.8} />
        </g>
      )}
      {/* streak_7 → lightning halo around head */}
      {has('streak_7') && (
        <g transform="translate(50, 20)" opacity={0.75}>
          {[0,45,90,135,180,225,270,315].map((deg, i) => {
            const r = 34
            const rad = (deg * Math.PI) / 180
            const x = Math.cos(rad) * r
            const y = Math.sin(rad) * r
            return <circle key={i} cx={x} cy={y} r={2.5} fill="#a78bfa" />
          })}
        </g>
      )}
      {/* subject_master → graduation cap */}
      {has('subject_master') && (
        <g transform="translate(50, 14)">
          <rect x={-14} y={-4} width={28} height={5} rx={1} fill="#1e293b" />
          <rect x={-10} y={-12} width={20} height={10} rx={2} fill="#1e293b" />
          <line x1={14} y1={-2} x2={20} y2={6} stroke="#f59e0b" strokeWidth={2} />
          <circle cx={20} cy={7} r={3} fill="#f59e0b" />
        </g>
      )}
      {/* questions_100 → mini book stack behind */}
      {has('questions_100') && (
        <g transform="translate(76, 78)">
          <rect x={0} y={4} width={14} height={10} rx={1} fill="#6366f1" />
          <rect x={1} y={1} width={12} height={10} rx={1} fill="#818cf8" />
          <rect x={2} y={-2} width={10} height={10} rx={1} fill="#a5b4fc" />
        </g>
      )}
      {/* level_10 → jetpack (explorer+ only) */}
      {has('level_10') && form !== 'sprout' && (
        <g transform="translate(78, 60)">
          <rect x={0} y={0} width={10} height={22} rx={3} fill="#475569" />
          <rect x={1} y={1} width={8} height={20} rx={2} fill="#64748b" />
          <ellipse cx={5} cy={24} rx={4} ry={3} fill="#f97316" opacity={0.9} />
          <ellipse cx={5} cy={25} rx={2} ry={2} fill="#fef9c3" opacity={0.8} />
        </g>
      )}
      {/* daily_3 → calendar badge on arm */}
      {has('daily_3') && (
        <g transform="translate(18, 82)">
          <rect x={0} y={0} width={12} height={12} rx={2} fill="#10b981" />
          <rect x={1} y={3} width={10} height={8} rx={1} fill="white" />
          <line x1={3} y1={0} x2={3} y2={3} stroke="#10b981" strokeWidth={1.5} />
          <line x1={9} y1={0} x2={9} y2={3} stroke="#10b981" strokeWidth={1.5} />
          <rect x={3} y={5} width={2} height={2} rx={0.5} fill="#10b981" />
          <rect x={6} y={5} width={2} height={2} rx={0.5} fill="#10b981" />
        </g>
      )}
      {/* Legend form → golden halo */}
      {form === 'legend' && (
        <ellipse cx={50} cy={14} rx={22} ry={5} fill="none" stroke="#fbbf24" strokeWidth={3} opacity={0.8} />
      )}
    </g>
  )
}

// ── Form bodies ───────────────────────────────────────────────────────────────

function SproutBody({ p, mood }: { p: PaletteEntry; mood: MascotMood }) {
  return (
    <g>
      {/* Body — round blob */}
      <ellipse cx={50} cy={80} rx={28} ry={24} fill={p.suit} />
      <ellipse cx={50} cy={80} rx={28} ry={24} fill={p.suitShade} opacity={0.3} />
      {/* Arms */}
      <ellipse cx={22} cy={82} rx={8} ry={5} fill={p.suit} transform="rotate(-20,22,82)" />
      <ellipse cx={78} cy={82} rx={8} ry={5} fill={p.suit} transform="rotate(20,78,82)" />
      {/* Hands */}
      <circle cx={15} cy={86} r={5} fill={p.skin} />
      <circle cx={85} cy={86} r={5} fill={p.skin} />
      {/* Feet */}
      <ellipse cx={38} cy={102} rx={9} ry={5} fill={p.bodyShade} />
      <ellipse cx={62} cy={102} rx={9} ry={5} fill={p.bodyShade} />
      {/* Helmet */}
      <circle cx={50} cy={46} r={26} fill={p.body} />
      <circle cx={50} cy={46} r={26} fill={p.bodyShade} opacity={0.2} />
      {/* Visor */}
      <ellipse cx={50} cy={48} rx={18} ry={16} fill={p.visor} opacity={0.9} />
      <ellipse cx={44} cy={42} rx={5} ry={3} fill={p.visorSheen} opacity={0.6} />
      {/* Face */}
      <Eyes mood={mood} cx={50} cy={48} />
      <Mouth mood={mood} cx={50} cy={58} />
      {/* Antenna */}
      <line x1={50} y1={20} x2={50} y2={10} stroke={p.bodyShade} strokeWidth={2.5} />
      <circle cx={50} cy={8} r={4} fill={p.glow} />
    </g>
  )
}

function ScholarBody({ p, mood }: { p: PaletteEntry; mood: MascotMood }) {
  return (
    <g>
      {/* Body — slightly taller */}
      <rect x={24} y={65} width={52} height={38} rx={10} fill={p.suit} />
      <rect x={24} y={65} width={52} height={38} rx={10} fill={p.suitShade} opacity={0.25} />
      {/* Collar detail */}
      <path d="M38,65 L50,75 L62,65" fill={p.suitShade} opacity={0.5} />
      {/* Left arm + book */}
      <rect x={10} y={66} width={14} height={28} rx={5} fill={p.suit} />
      <rect x={4} y={78} width={16} height={20} rx={2} fill="#6366f1" />
      <rect x={5} y={79} width={14} height={18} rx={1} fill="#818cf8" />
      <line x1={12} y1={79} x2={12} y2={97} stroke="white" strokeWidth={0.8} opacity={0.5} />
      {/* Right arm */}
      <rect x={76} y={66} width={14} height={28} rx={5} fill={p.suit} />
      <circle cx={16} cy={99} r={5} fill={p.skin} />
      <circle cx={84} cy={95} r={5} fill={p.skin} />
      {/* Feet */}
      <ellipse cx={38} cy={103} rx={10} ry={5} fill={p.bodyShade} />
      <ellipse cx={62} cy={103} rx={10} ry={5} fill={p.bodyShade} />
      {/* Helmet */}
      <circle cx={50} cy={44} r={26} fill={p.body} />
      <circle cx={50} cy={44} r={26} fill={p.bodyShade} opacity={0.2} />
      {/* Visor */}
      <ellipse cx={50} cy={46} rx={18} ry={16} fill={p.visor} opacity={0.9} />
      <ellipse cx={44} cy={40} rx={5} ry={3} fill={p.visorSheen} opacity={0.6} />
      {/* Face */}
      <Eyes mood={mood} cx={50} cy={46} />
      <Mouth mood={mood} cx={50} cy={56} />
      {/* Helmet ridge */}
      <path d="M24,44 Q50,18 76,44" fill="none" stroke={p.bodyShade} strokeWidth={2} />
    </g>
  )
}

function ExplorerBody({ p, mood }: { p: PaletteEntry; mood: MascotMood }) {
  return (
    <g>
      {/* Suit torso */}
      <rect x={22} y={62} width={56} height={42} rx={12} fill={p.body} />
      <rect x={22} y={62} width={56} height={42} rx={12} fill={p.bodyShade} opacity={0.3} />
      {/* Chest panel */}
      <rect x={34} y={70} width={32} height={20} rx={4} fill={p.suit} />
      <circle cx={42} cy={78} r={3} fill="#10b981" />
      <circle cx={50} cy={78} r={3} fill="#f59e0b" />
      <circle cx={58} cy={78} r={3} fill="#ef4444" />
      <rect x={36} y={84} width={28} height={3} rx={1} fill={p.suitShade} />
      {/* Arms */}
      <rect x={8} y={63} width={14} height={32} rx={6} fill={p.body} />
      <rect x={78} y={63} width={14} height={32} rx={6} fill={p.body} />
      {/* Gloves */}
      <circle cx={15} cy={97} r={7} fill={p.bodyShade} />
      <circle cx={85} cy={97} r={7} fill={p.bodyShade} />
      {/* Boots */}
      <rect x={27} y={102} width={18} height={10} rx={4} fill={p.bodyShade} />
      <rect x={55} y={102} width={18} height={10} rx={4} fill={p.bodyShade} />
      {/* Helmet — bigger + rounder */}
      <circle cx={50} cy={40} r={30} fill={p.body} />
      <circle cx={50} cy={40} r={30} fill="white" opacity={0.08} />
      {/* Visor — larger */}
      <ellipse cx={50} cy={42} rx={21} ry={19} fill={p.visor} opacity={0.92} />
      <ellipse cx={44} cy={36} rx={6} ry={4} fill={p.visorSheen} opacity={0.7} />
      {/* Face */}
      <Eyes mood={mood} cx={50} cy={42} />
      <Mouth mood={mood} cx={50} cy={54} />
      {/* Helmet ring */}
      <circle cx={50} cy={40} r={30} fill="none" stroke={p.bodyShade} strokeWidth={3} />
    </g>
  )
}

function LegendBody({ p, mood }: { p: PaletteEntry; mood: MascotMood }) {
  return (
    <g>
      {/* Glow aura */}
      <circle cx={50} cy={55} r={55} fill={p.glow} opacity={0.12} />
      {/* Cape */}
      <path d="M28,62 Q10,90 22,108 L50,96 L78,108 Q90,90 72,62 Z" fill={p.bodyShade} opacity={0.7} />
      {/* Armour torso */}
      <rect x={24} y={62} width={52} height={40} rx={10} fill={p.body} />
      {/* Armour plates */}
      <path d="M24,72 Q50,62 76,72 L76,84 Q50,74 24,84 Z" fill={p.bodyShade} opacity={0.6} />
      <path d="M24,84 Q50,74 76,84 L76,96 Q50,86 24,96 Z" fill={p.bodyShade} opacity={0.35} />
      {/* Gem in centre */}
      <polygon points="50,72 55,78 50,84 45,78" fill="#67e8f9" />
      <polygon points="50,74 53,78 50,82 47,78" fill="white" opacity={0.6} />
      {/* Arms */}
      <rect x={8} y={63} width={16} height={32} rx={7} fill={p.body} />
      <rect x={76} y={63} width={16} height={32} rx={7} fill={p.body} />
      {/* Shoulder pads */}
      <ellipse cx={22} cy={65} rx={10} ry={7} fill={p.bodyShade} />
      <ellipse cx={78} cy={65} rx={10} ry={7} fill={p.bodyShade} />
      {/* Gauntlets */}
      <rect x={8} y={91} width={16} height={8} rx={3} fill={p.bodyShade} />
      <rect x={76} y={91} width={16} height={8} rx={3} fill={p.bodyShade} />
      {/* Hands */}
      <circle cx={16} cy={101} r={6} fill={p.skin} />
      <circle cx={84} cy={101} r={6} fill={p.skin} />
      {/* Boots */}
      <rect x={28} y={100} width={16} height={12} rx={4} fill={p.bodyShade} />
      <rect x={56} y={100} width={16} height={12} rx={4} fill={p.bodyShade} />
      {/* Helmet — majestic */}
      <circle cx={50} cy={38} r={30} fill={p.body} />
      <circle cx={50} cy={38} r={30} fill="white" opacity={0.1} />
      {/* Crown ridges */}
      {[-20,-10,0,10,20].map((off, i) => (
        <rect key={i} x={50 + off - 2} y={10 - (i % 2 === 0 ? 6 : 0)} width={4} height={12} rx={2} fill={p.bodyShade} />
      ))}
      {/* Visor */}
      <ellipse cx={50} cy={40} rx={20} ry={18} fill={p.visor} opacity={0.93} />
      <ellipse cx={44} cy={34} rx={6} ry={4} fill={p.visorSheen} opacity={0.8} />
      {/* Face */}
      <Eyes mood={mood} cx={50} cy={40} />
      <Mouth mood={mood} cx={50} cy={52} />
      {/* Star particles for legend */}
      {[0,60,120,180,240,300].map((deg, i) => {
        const r = 36
        const rad = (deg * Math.PI) / 180
        const x = 50 + Math.cos(rad) * r
        const y = 38 + Math.sin(rad) * r
        return (
          <circle key={i} cx={x} cy={y} r={2.5} fill="#fbbf24" opacity={0.7}>
            <animate attributeName="opacity" values="0.7;0.2;0.7" dur={`${1.2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        )
      })}
    </g>
  )
}

// ── Bounce / idle animation wrapper ──────────────────────────────────────────

const ANIM_CSS: Record<MascotMood, string> = {
  idle:     'animate-none',
  happy:    '',   // handled with inline animation
  thinking: '',
  excited:  '',
  ready:    '',
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  level: number
  mood?: MascotMood
  badges?: BadgeId[]
  size?: number          // px — viewBox is always 100×114
  className?: string
  animate?: boolean      // floating idle animation
}

export function MascotSVG({
  level,
  mood = 'idle',
  badges = [],
  size = 120,
  className = '',
  animate = true,
}: Props) {
  const form = formFromLevel(level)
  const p = PALETTE[form]

  const animStyle = animate ? {
    animation: mood === 'excited'
      ? 'mascotBounce 0.5s ease-in-out infinite alternate'
      : 'mascotFloat 3s ease-in-out infinite',
  } : {}

  return (
    <>
      <style>{`
        @keyframes mascotFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes mascotBounce {
          0%   { transform: translateY(0px) rotate(-3deg); }
          100% { transform: translateY(-10px) rotate(3deg); }
        }
      `}</style>

      <svg
        width={size}
        height={size * 1.14}
        viewBox="0 0 100 114"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={animStyle}
      >
        {/* Drop shadow */}
        <ellipse cx={50} cy={110} rx={22} ry={4} fill="black" opacity={0.08} />

        {/* Form body */}
        {form === 'sprout'   && <SproutBody   p={p} mood={mood} />}
        {form === 'scholar'  && <ScholarBody  p={p} mood={mood} />}
        {form === 'explorer' && <ExplorerBody p={p} mood={mood} />}
        {form === 'legend'   && <LegendBody   p={p} mood={mood} />}

        {/* Accessories on top */}
        <AccessoryLayer badges={badges} form={form} />
      </svg>
    </>
  )
}
