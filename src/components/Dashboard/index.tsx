import React, { useMemo } from 'react'
import {
  BookOpen, Brain, FileQuestion, ImageIcon, Wand2, Trophy,
  TrendingUp, Layers, ChevronRight, Zap, Upload, Flame,
  Star, Target, BarChart2,
} from 'lucide-react'
import type { Assessment, Question, ImportedQuestion, DiagramPoolEntry, Resource, PracticeAttempt } from '../../lib/types'

// ── Subject config ─────────────────────────────────────────────────────────────

const SUBJECT_CONFIG: Record<string, {
  emoji: string
  gradient: string       // CSS class
  light: string          // light bg for stats
  text: string
  badge: string
  dot: string
}> = {
  Mathematics:        { emoji: '🧮', gradient: 'subj-math',    light: 'bg-blue-50',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  Biology:            { emoji: '🔬', gradient: 'subj-biology', light: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500' },
  Chemistry:          { emoji: '⚗️', gradient: 'subj-chem',    light: 'bg-orange-50',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  Physics:            { emoji: '⚛️', gradient: 'subj-physics', light: 'bg-violet-50',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  'Computer Science': { emoji: '💻', gradient: 'subj-cs',      light: 'bg-cyan-50',    text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-700',     dot: 'bg-cyan-500' },
  Economics:          { emoji: '📊', gradient: 'subj-econ',    light: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  History:            { emoji: '🏛️', gradient: 'subj-history', light: 'bg-rose-50',    text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700',     dot: 'bg-rose-500' },
  Geography:          { emoji: '🌍', gradient: 'subj-geo',     light: 'bg-teal-50',    text: 'text-teal-700',    badge: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500' },
}
const DEFAULT_CFG = { emoji: '📚', gradient: 'subj-default', light: 'bg-indigo-50', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' }

function subjectCfg(subject: string) {
  return SUBJECT_CONFIG[subject] ?? DEFAULT_CFG
}

// ── XP helpers ────────────────────────────────────────────────────────────────

function xpForAttempts(attempts: PracticeAttempt[]): number {
  return attempts.reduce((sum, a) => sum + (a.marksAwarded ?? 0) * 10, 0)
}

function levelFromXP(xp: number): { level: number; currentXP: number; nextXP: number } {
  // Each level needs level*200 XP
  let level = 1
  let needed = 200
  let remaining = xp
  while (remaining >= needed) {
    remaining -= needed
    level++
    needed = level * 200
  }
  return { level, currentXP: remaining, nextXP: needed }
}

function streakFromAttempts(attempts: PracticeAttempt[]): number {
  if (attempts.length === 0) return 0
  const days = new Set<string>()
  attempts.forEach(a => {
    const ts = (a as any).createdAt
    if (!ts) return
    const d = new Date(typeof ts === 'number' ? ts : ts.toMillis?.() ?? Date.now())
    days.add(d.toDateString())
  })
  const sorted = [...days].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  let streak = 0
  const today = new Date()
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(today)
    expected.setDate(today.getDate() - i)
    if (sorted[i] === expected.toDateString()) streak++
    else break
  }
  return streak
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroStatBadge({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl ${color} shadow-sm`}>
      <span className="opacity-80">{icon}</span>
      <div>
        <p className="text-xs font-medium opacity-70 leading-none">{label}</p>
        <p className="text-sm font-bold leading-tight">{value}</p>
      </div>
    </div>
  )
}

function XPBar({ currentXP, nextXP, level }: { currentXP: number; nextXP: number; level: number }) {
  const pct = Math.round((currentXP / nextXP) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shrink-0">
        <span className="text-white font-black text-sm">{level}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold text-slate-600">Level {level}</span>
          <span className="text-slate-400 tabular-nums">{currentXP} / {nextXP} XP</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full quest-bar-fill"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

function QuickStatCard({ icon, label, value, sub, gradient }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; gradient: string
}) {
  return (
    <div className={`rounded-2xl p-4 text-white ${gradient} shadow-md flex flex-col gap-2 min-w-0 card-hover`}>
      <div className="p-1.5 rounded-xl bg-white/20 w-fit">{icon}</div>
      <div>
        <p className="text-2xl font-black leading-none">{value}</p>
        {sub && <p className="text-xs text-white/70 mt-0.5">{sub}</p>}
        <p className="text-xs font-semibold text-white/80 mt-1">{label}</p>
      </div>
    </div>
  )
}

function SubjectCard({
  subject, total, aiCount, examviewCount, pastPaperCount, topicCount,
  accuracy, onNavigate,
}: {
  subject: string; total: number; aiCount: number; examviewCount: number
  pastPaperCount: number; topicCount: number; accuracy: number | null; onNavigate: () => void
}) {
  const cfg = subjectCfg(subject)

  return (
    <button
      onClick={onNavigate}
      className="group rounded-3xl overflow-hidden shadow-md card-hover text-left w-full border-0 focus:outline-none focus:ring-2 focus:ring-violet-400"
    >
      {/* Gradient banner */}
      <div className={`${cfg.gradient} px-5 pt-5 pb-8 relative`}>
        <div className="text-4xl mb-1">{cfg.emoji}</div>
        <p className="text-white font-black text-base leading-tight">{subject}</p>
        <p className="text-white/70 text-xs mt-0.5">{topicCount} topic{topicCount !== 1 ? 's' : ''}</p>
        {/* Big question count */}
        <p className="absolute top-4 right-5 text-4xl font-black text-white/30 select-none">{total}</p>
      </div>
      {/* White lower portion */}
      <div className="bg-white px-5 py-3 -mt-4 rounded-t-2xl">
        {accuracy !== null ? (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${accuracy}%`,
                  background: accuracy >= 70 ? 'linear-gradient(90deg,#10b981,#34d399)' : accuracy >= 50 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#f87171)',
                }}
              />
            </div>
            <span className={`text-xs font-bold tabular-nums ${accuracy >= 70 ? 'text-emerald-600' : accuracy >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
              {accuracy}%
            </span>
          </div>
        ) : (
          <div className="h-2 bg-slate-100 rounded-full mb-2" />
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {aiCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-semibold">{aiCount} AI</span>}
          {examviewCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 font-semibold">{examviewCount} EV</span>}
          {pastPaperCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 font-semibold">{pastPaperCount} PP</span>}
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-auto group-hover:text-slate-500 transition-colors" />
        </div>
      </div>
    </button>
  )
}

function LeaderboardRow({ rank, name, score, correct, total, attempts }: {
  rank: number; name: string; score: number; correct: number; total: number; attempts?: number
}) {
  const isTop3 = rank <= 3
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${isTop3 ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100' : 'bg-slate-50'}`}>
      <div className={`w-8 h-8 flex items-center justify-center text-sm font-black rounded-full shrink-0 ${isTop3 ? '' : 'bg-slate-200 text-slate-500'}`}>
        {isTop3 ? medals[rank - 1] : rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-700 truncate">{name}</p>
        <p className="text-[10px] text-slate-400">
          {correct}/{total} marks {attempts !== undefined && attempts > 1 && `· ${attempts} attempts`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-black ${isTop3 ? 'text-amber-600' : 'text-slate-600'}`}>{score}%</p>
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-black text-slate-700 flex items-center gap-2 uppercase tracking-wide">
        {icon} {title}
      </h3>
      {action}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export function Dashboard({
  assessments,
  questions,
  importedQuestions,
  diagramPool,
  practiceAttempts,
  currentUserId,
  currentUserName,
  onNavigate,
}: {
  assessments: Assessment[]
  questions: Question[]
  importedQuestions: ImportedQuestion[]
  diagramPool: DiagramPoolEntry[]
  resources: Resource[]
  practiceAttempts: PracticeAttempt[]
  currentUserId: string
  currentUserName: string
  onNavigate: (view: 'main' | 'library' | 'diagrams') => void
}) {
  // ── Derived question data ────────────────────────────────────────────────────
  const { aiQuestions, examviewQuestions } = useMemo(() => {
    const ai: Question[] = [], ev: Question[] = []
    questions.forEach(q => ((q as any).source === 'examview' ? ev : ai).push(q))
    return { aiQuestions: ai, examviewQuestions: ev }
  }, [questions])

  const aiCount        = aiQuestions.length
  const examviewCount  = examviewQuestions.length
  const pastPaperCount = importedQuestions.length
  const totalQuestions = aiCount + examviewCount + pastPaperCount
  const diagramCount   = diagramPool.length
  const assessmentCount = assessments.length

  const allTopics = useMemo(() => {
    const s = new Set<string>()
    questions.forEach(q => q.topic && s.add(q.topic))
    assessments.forEach(a => a.topic && s.add(a.topic))
    importedQuestions.forEach(q => q.topic && s.add(q.topic))
    return s.size
  }, [questions, assessments, importedQuestions])

  // ── Per-subject accuracy from practice attempts ──────────────────────────────
  const subjectAccuracy = useMemo(() => {
    const map: Record<string, { marks: number; total: number }> = {}
    practiceAttempts.forEach(a => {
      const subj = (a as any).subject as string | undefined
      if (!subj) return
      if (!map[subj]) map[subj] = { marks: 0, total: 0 }
      map[subj].marks += a.marksAwarded
      map[subj].total += a.totalMarks
    })
    const out: Record<string, number> = {}
    Object.entries(map).forEach(([s, v]) => {
      out[s] = v.total > 0 ? Math.round((v.marks / v.total) * 100) : 0
    })
    return out
  }, [practiceAttempts])

  // ── Per-subject breakdown ────────────────────────────────────────────────────
  const subjectStats = useMemo(() => {
    const map: Record<string, { ai: number; examview: number; pastPaper: number; topics: Set<string> }> = {}
    const ensure = (s: string) => { if (!map[s]) map[s] = { ai: 0, examview: 0, pastPaper: 0, topics: new Set() } }
    aiQuestions.forEach(q => { if (!q.subject) return; ensure(q.subject); map[q.subject].ai++; if (q.topic) map[q.subject].topics.add(q.topic) })
    examviewQuestions.forEach(q => { if (!q.subject) return; ensure(q.subject); map[q.subject].examview++; if (q.topic) map[q.subject].topics.add(q.topic) })
    importedQuestions.forEach(q => { if (!q.subject) return; ensure(q.subject); map[q.subject].pastPaper++; if (q.topic) map[q.subject].topics.add(q.topic) })
    assessments.forEach(a => { if (!a.subject) return; ensure(a.subject); if (a.topic) map[a.subject].topics.add(a.topic) })
    return Object.entries(map)
      .filter(([, v]) => v.ai + v.examview + v.pastPaper > 0)
      .sort((a, b) => (b[1].ai + b[1].examview + b[1].pastPaper) - (a[1].ai + a[1].examview + a[1].pastPaper))
  }, [aiQuestions, examviewQuestions, importedQuestions, assessments])

  // ── Gamification ─────────────────────────────────────────────────────────────
  const totalXP = xpForAttempts(practiceAttempts)
  const { level, currentXP, nextXP } = levelFromXP(totalXP)
  const streak = streakFromAttempts(practiceAttempts)

  const totalMarksAwarded = practiceAttempts.reduce((s, a) => s + a.marksAwarded, 0)
  const totalMarksPossible = practiceAttempts.reduce((s, a) => s + a.totalMarks, 0)
  const overallAccuracy = totalMarksPossible > 0 ? Math.round((totalMarksAwarded / totalMarksPossible) * 100) : null

  // ── Leaderboard ───────────────────────────────────────────────────────────────
  const leaderboard = useMemo(() => {
    if (practiceAttempts.length === 0) return []
    const byUser: Record<string, { name: string; marksAwarded: number; totalMarks: number; attempts: number }> = {}
    practiceAttempts.forEach(a => {
      const uid = a.userId || currentUserId
      const name = uid === currentUserId ? (currentUserName || 'You') : uid
      if (!byUser[uid]) byUser[uid] = { name, marksAwarded: 0, totalMarks: 0, attempts: 0 }
      byUser[uid].marksAwarded += a.marksAwarded
      byUser[uid].totalMarks += a.totalMarks
      byUser[uid].attempts++
    })
    return Object.entries(byUser)
      .map(([, v]) => ({
        name: v.name,
        score: Math.round(v.totalMarks > 0 ? (v.marksAwarded / v.totalMarks) * 100 : 0),
        correct: v.marksAwarded,
        total: v.totalMarks,
        attempts: v.attempts,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((row, i) => ({ rank: i + 1, ...row }))
  }, [practiceAttempts, currentUserId, currentUserName])

  const firstName = currentUserName?.split(' ')[0] || 'there'

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto min-h-0 w-full"
      style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdf4 50%, #fdf4ff 100%)' }}>
      <div className="w-full px-4 sm:px-6 py-6 space-y-8 max-w-7xl mx-auto">

        {/* ── Hero ─────────────────────────────────────────────────────────────── */}
        <div className="rounded-3xl overflow-hidden shadow-xl anim-slide-up"
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)' }}>
          <div className="px-6 pt-7 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              {/* Welcome text */}
              <div className="flex-1">
                <p className="text-indigo-200 text-sm font-semibold mb-1">Welcome back 👋</p>
                <h2 className="text-white text-2xl sm:text-3xl font-black leading-tight">
                  {firstName}!
                </h2>
                {streak > 0 ? (
                  <p className="text-indigo-200 text-sm mt-1 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-300" />
                    <span><span className="font-bold text-white">{streak}-day streak</span> — keep it up!</span>
                  </p>
                ) : (
                  <p className="text-indigo-200 text-sm mt-1">Ready to study today?</p>
                )}

                {/* XP bar */}
                <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3">
                  <XPBar currentXP={currentXP} nextXP={nextXP} level={level} />
                </div>
              </div>

              {/* Quick stats row */}
              <div className="flex flex-wrap sm:flex-col gap-2 sm:min-w-[180px]">
                <HeroStatBadge
                  icon={<Star className="w-4 h-4" />}
                  label="Total XP"
                  value={totalXP.toLocaleString()}
                  color="bg-white/15 text-white"
                />
                {overallAccuracy !== null && (
                  <HeroStatBadge
                    icon={<Target className="w-4 h-4" />}
                    label="Accuracy"
                    value={`${overallAccuracy}%`}
                    color="bg-white/15 text-white"
                  />
                )}
                <HeroStatBadge
                  icon={<BookOpen className="w-4 h-4" />}
                  label="Sessions"
                  value={practiceAttempts.length}
                  color="bg-white/15 text-white"
                />
              </div>
            </div>
          </div>

          {/* Quick action strip */}
          <div className="bg-white/10 px-6 py-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => onNavigate('main')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-indigo-700 text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm"
            >
              <Wand2 className="w-4 h-4" /> Generate Questions
            </button>
            <button
              onClick={() => onNavigate('library')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 text-white text-sm font-semibold hover:bg-white/30 transition-colors"
            >
              <BookOpen className="w-4 h-4" /> My Library
            </button>
            <button
              onClick={() => onNavigate('diagrams')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 text-white text-sm font-semibold hover:bg-white/30 transition-colors"
            >
              <ImageIcon className="w-4 h-4" /> Diagrams
            </button>
          </div>
        </div>

        {/* ── Quick stat cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 anim-slide-up">
          <QuickStatCard
            icon={<Wand2 className="w-4 h-4 text-white" />}
            label="AI Questions"
            value={aiCount}
            sub={`${assessmentCount} assessment${assessmentCount !== 1 ? 's' : ''}`}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <QuickStatCard
            icon={<Upload className="w-4 h-4 text-white" />}
            label="ExamView"
            value={examviewCount}
            sub={examviewCount > 0 ? 'imported' : 'none yet'}
            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          />
          <QuickStatCard
            icon={<FileQuestion className="w-4 h-4 text-white" />}
            label="Past Paper"
            value={pastPaperCount}
            sub={pastPaperCount > 0 ? 'admin-imported' : 'none yet'}
            gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          />
          <QuickStatCard
            icon={<Brain className="w-4 h-4 text-white" />}
            label="Topics"
            value={allTopics}
            sub={`${subjectStats.length} subject${subjectStats.length !== 1 ? 's' : ''}`}
            gradient="bg-gradient-to-br from-pink-500 to-rose-600"
          />
        </div>

        {/* ── Subject cards ─────────────────────────────────────────────────────── */}
        <section className="anim-slide-up">
          <SectionHeader
            icon={<Layers className="w-4 h-4 text-indigo-400" />}
            title="Your Subjects"
            action={
              <button
                onClick={() => onNavigate('library')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
              >
                Open Library <ChevronRight className="w-3.5 h-3.5" />
              </button>
            }
          />

          {subjectStats.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {subjectStats.map(([subject, stats]) => (
                <SubjectCard
                  key={subject}
                  subject={subject}
                  total={stats.ai + stats.examview + stats.pastPaper}
                  aiCount={stats.ai}
                  examviewCount={stats.examview}
                  pastPaperCount={stats.pastPaper}
                  topicCount={stats.topics.size}
                  accuracy={subjectAccuracy[subject] ?? null}
                  onNavigate={() => onNavigate('library')}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-indigo-200 bg-white/60 p-10 text-center anim-pop">
              <div className="text-5xl mb-3">📚</div>
              <p className="text-slate-500 font-semibold">No questions yet.</p>
              <p className="text-slate-400 text-sm mt-1">Generate your first assessment to get started!</p>
              <button
                onClick={() => onNavigate('main')}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-md"
              >
                <Wand2 className="w-4 h-4" /> Generate Now
              </button>
            </div>
          )}
        </section>

        {/* ── Bottom row ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 anim-slide-up">

          {/* Leaderboard */}
          <section className="bg-white/80 backdrop-blur rounded-3xl border border-white shadow-md p-5">
            <SectionHeader
              icon={<Trophy className="w-4 h-4 text-amber-500" />}
              title="Leaderboard"
            />
            {leaderboard.length > 0 ? (
              <div className="flex flex-col gap-2">
                {leaderboard.map(row => <LeaderboardRow key={row.rank} {...row} />)}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🏆</div>
                <p className="text-sm text-slate-400">Complete practice sessions<br />to appear here!</p>
              </div>
            )}
          </section>

          {/* Question type breakdown */}
          <section className="bg-white/80 backdrop-blur rounded-3xl border border-white shadow-md p-5">
            <SectionHeader
              icon={<BarChart2 className="w-4 h-4 text-indigo-400" />}
              title="Question Types"
            />
            {aiCount > 0 ? (
              <div className="space-y-3">
                {[
                  { label: 'Multiple Choice', emoji: '🔘', key: 'mcq',          gradient: 'from-blue-400 to-cyan-400' },
                  { label: 'Short Answer',    emoji: '✏️', key: 'short_answer',  gradient: 'from-emerald-400 to-teal-400' },
                  { label: 'Structured',      emoji: '📋', key: 'structured',    gradient: 'from-violet-400 to-purple-400' },
                ].map(({ label, emoji, key, gradient }) => {
                  const count = aiQuestions.filter(q => q.type === key).length
                  const pct = aiCount > 0 ? Math.round((count / aiCount) * 100) : 0
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-600">{emoji} {label}</span>
                        <span className="text-slate-400 tabular-nums">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${gradient} quest-bar-fill`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Generate questions to see breakdown.</p>
              </div>
            )}
          </section>

          {/* Diagram gallery */}
          <section className="bg-white/80 backdrop-blur rounded-3xl border border-white shadow-md p-5">
            <SectionHeader
              icon={<ImageIcon className="w-4 h-4 text-orange-400" />}
              title="Diagram Gallery"
              action={
                <button
                  onClick={() => onNavigate('diagrams')}
                  className="text-xs text-orange-600 hover:text-orange-800 font-bold flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              }
            />
            {diagramCount > 0 ? (
              <div className="space-y-3">
                {/* Total */}
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-slate-800">{diagramCount}</span>
                  <span className="text-xs text-slate-400 font-medium">diagrams</span>
                </div>
                {/* By subject */}
                {Object.entries(
                  diagramPool.reduce<Record<string, number>>((acc, d) => {
                    acc[d.subject] = (acc[d.subject] ?? 0) + 1; return acc
                  }, {})
                ).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([subj, cnt]) => {
                  const cfg = subjectCfg(subj)
                  return (
                    <div key={subj} className="flex items-center gap-2">
                      <span className="text-lg">{cfg.emoji}</span>
                      <span className="text-xs font-semibold text-slate-600 flex-1 truncate">{subj}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cfg.badge}`}>{cnt}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🖼️</div>
                <p className="text-sm text-slate-400">Upload diagrams to build<br />your visual library.</p>
                <button
                  onClick={() => onNavigate('diagrams')}
                  className="mt-3 text-xs text-orange-600 font-bold hover:text-orange-800"
                >
                  Open Diagram Library →
                </button>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
