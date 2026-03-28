import React, { useMemo } from 'react'
import {
  BookOpen, Brain, FileQuestion, ImageIcon, Wand2, Trophy,
  TrendingUp, Layers, ChevronRight, Star, Zap, Upload,
} from 'lucide-react'
import type { Assessment, Question, ImportedQuestion, DiagramPoolEntry, Resource } from '../../lib/types'

// ─── Subject colour palette ───────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  Mathematics:        { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  Biology:            { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500' },
  Chemistry:          { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  Physics:            { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  'Computer Science': { bg: 'bg-cyan-50',    border: 'border-cyan-200',   text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-700',     dot: 'bg-cyan-500' },
  Economics:          { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  History:            { bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700',     dot: 'bg-rose-500' },
  Geography:          { bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-700',    badge: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500' },
}

const DEFAULT_COLOR = { bg: 'bg-stone-50', border: 'border-stone-200', text: 'text-stone-700', badge: 'bg-stone-100 text-stone-700', dot: 'bg-stone-400' }

function subjectColor(subject: string) {
  return SUBJECT_COLORS[subject] ?? DEFAULT_COLOR
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, gradient,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  gradient: string
}) {
  return (
    <div className={`rounded-2xl p-4 text-white ${gradient} shadow-sm flex flex-col gap-2 min-w-0`}>
      <div className="p-1.5 rounded-xl bg-white/20 w-fit">{icon}</div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        {sub && <p className="text-xs text-white/70 mt-0.5">{sub}</p>}
        <p className="text-xs font-medium text-white/80 mt-1">{label}</p>
      </div>
    </div>
  )
}

// ─── Source pill ──────────────────────────────────────────────────────────────

function SourcePill({ count, icon, label, color }: {
  count: number; icon: React.ReactNode; label: string; color: string
}) {
  if (count === 0) return null
  return (
    <span className={`text-[10px] flex items-center gap-1 ${color}`}>
      {icon} {count} {label}
    </span>
  )
}

// ─── Subject card ─────────────────────────────────────────────────────────────

function SubjectCard({
  subject, aiCount, examviewCount, pastPaperCount, topicCount, onNavigate,
}: {
  subject: string
  aiCount: number
  examviewCount: number
  pastPaperCount: number
  topicCount: number
  onNavigate: () => void
}) {
  const c = subjectColor(subject)
  const total = aiCount + examviewCount + pastPaperCount

  return (
    <button
      onClick={onNavigate}
      className={`rounded-2xl border ${c.border} ${c.bg} p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 w-full group`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-sm font-semibold ${c.text}`}>{subject}</p>
          <p className="text-xs text-stone-400 mt-0.5">{topicCount} topic{topicCount !== 1 ? 's' : ''}</p>
        </div>
        <ChevronRight className={`w-4 h-4 ${c.text} opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0`} />
      </div>

      <p className={`text-3xl font-bold ${c.text} leading-none mb-2`}>{total}</p>

      <div className="flex flex-col gap-0.5">
        <SourcePill count={aiCount}       icon={<Wand2 className="w-3 h-3" />}        label="AI-generated"  color="text-emerald-500" />
        <SourcePill count={examviewCount} icon={<Upload className="w-3 h-3" />}       label="ExamView"      color="text-blue-500" />
        <SourcePill count={pastPaperCount}icon={<FileQuestion className="w-3 h-3" />} label="Past paper"    color="text-stone-400" />
      </div>
    </button>
  )
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({ rank, name, score, correct, total }: {
  rank: number; name: string; score: number; correct: number; total: number
}) {
  const isTop3 = rank <= 3
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${isTop3 ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100' : 'bg-stone-50'}`}>
      <div className={`w-7 h-7 flex items-center justify-center text-sm font-bold rounded-full shrink-0 ${isTop3 ? 'text-amber-700' : 'bg-stone-100 text-stone-400'}`}>
        {isTop3 ? medals[rank - 1] : rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-stone-700 truncate">{name}</p>
        <p className="text-[10px] text-stone-400">{correct}/{total} correct</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${isTop3 ? 'text-amber-700' : 'text-stone-600'}`}>{score}</p>
        <p className="text-[10px] text-stone-400">pts</p>
      </div>
    </div>
  )
}

// ─── Bar row ──────────────────────────────────────────────────────────────────

function BarRow({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-stone-500 w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-stone-400 w-8 text-right tabular-nums">{count}</span>
    </div>
  )
}

// ─── Source legend pill ───────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-stone-500">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard({
  assessments,
  questions,
  importedQuestions,
  diagramPool,
  currentUserName,
  onNavigate,
}: {
  assessments: Assessment[]
  questions: Question[]
  importedQuestions: ImportedQuestion[]
  diagramPool: DiagramPoolEntry[]
  resources: Resource[]
  currentUserName: string
  onNavigate: (view: 'main' | 'library' | 'diagrams') => void
}) {
  // ── Split questions by source ────────────────────────────────────────────
  // AI-generated: source field absent
  // ExamView imported: source === 'examview'  (saved to `questions` collection)
  // Admin past paper: `importedQuestions` collection (source: 'imported')

  const { aiQuestions, examviewQuestions } = useMemo(() => {
    const ai: Question[] = []
    const ev: Question[] = []
    questions.forEach(q => {
      if ((q as any).source === 'examview') ev.push(q)
      else ai.push(q)
    })
    return { aiQuestions: ai, examviewQuestions: ev }
  }, [questions])

  const aiCount       = aiQuestions.length
  const examviewCount = examviewQuestions.length
  const pastPaperCount = importedQuestions.length
  const totalQuestions = aiCount + examviewCount + pastPaperCount
  const diagramCount   = diagramPool.length
  const assessmentCount = assessments.length

  // ── Unique topics (all sources) ──────────────────────────────────────────
  const allTopics = useMemo(() => {
    const s = new Set<string>()
    questions.forEach(q => q.topic && s.add(q.topic))
    assessments.forEach(a => a.topic && s.add(a.topic))
    importedQuestions.forEach(q => q.topic && s.add(q.topic))
    return s.size
  }, [questions, assessments, importedQuestions])

  // ── Per-subject breakdown (3 sources) ───────────────────────────────────
  const subjectStats = useMemo(() => {
    const map: Record<string, { ai: number; examview: number; pastPaper: number; topics: Set<string> }> = {}

    const ensure = (s: string) => {
      if (!map[s]) map[s] = { ai: 0, examview: 0, pastPaper: 0, topics: new Set() }
    }

    aiQuestions.forEach(q => {
      if (!q.subject) return
      ensure(q.subject)
      map[q.subject].ai++
      if (q.topic) map[q.subject].topics.add(q.topic)
    })

    examviewQuestions.forEach(q => {
      if (!q.subject) return
      ensure(q.subject)
      map[q.subject].examview++
      if (q.topic) map[q.subject].topics.add(q.topic)
    })

    importedQuestions.forEach(q => {
      if (!q.subject) return
      ensure(q.subject)
      map[q.subject].pastPaper++
      if (q.topic) map[q.subject].topics.add(q.topic)
    })

    // Also register topics from assessments
    assessments.forEach(a => {
      if (!a.subject) return
      ensure(a.subject)
      if (a.topic) map[a.subject].topics.add(a.topic)
    })

    return Object.entries(map)
      .filter(([, v]) => v.ai + v.examview + v.pastPaper > 0)
      .sort((a, b) => (b[1].ai + b[1].examview + b[1].pastPaper) - (a[1].ai + a[1].examview + a[1].pastPaper))
  }, [aiQuestions, examviewQuestions, importedQuestions, assessments])

  // ── Diagram by subject ───────────────────────────────────────────────────
  const diagramBySubject = useMemo(() => {
    const map: Record<string, number> = {}
    diagramPool.forEach(d => { map[d.subject] = (map[d.subject] ?? 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [diagramPool])

  // ── AI question type breakdown ───────────────────────────────────────────
  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = { mcq: 0, short_answer: 0, structured: 0 }
    aiQuestions.forEach(q => { if (q.type) map[q.type] = (map[q.type] ?? 0) + 1 })
    return map
  }, [aiQuestions])

  // ── AI difficulty breakdown ──────────────────────────────────────────────
  const diffBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    aiQuestions.forEach(q => {
      const d = q.difficulty || 'Unknown'
      map[d] = (map[d] ?? 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [aiQuestions])

  // ── Source distribution for the overview bar ─────────────────────────────
  const sourceDistribution = [
    { label: 'AI-generated', count: aiCount,       color: 'bg-emerald-400', legend: 'bg-emerald-400' },
    { label: 'ExamView',     count: examviewCount,  color: 'bg-blue-400',    legend: 'bg-blue-400' },
    { label: 'Past Paper',   count: pastPaperCount, color: 'bg-violet-400',  legend: 'bg-violet-400' },
  ].filter(s => s.count > 0)

  const leaderboard = [
    { rank: 1, name: currentUserName || 'You', score: 0, correct: 0, total: 0 },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-stone-50 to-slate-50 min-h-0 w-full">
      <div className="w-full px-6 py-8 space-y-8">

        {/* ── Welcome header ── */}
        <div>
          <h2 className="text-xl font-bold text-stone-800">
            Welcome back{currentUserName ? `, ${currentUserName.split(' ')[0]}` : ''}! 👋
          </h2>
          <p className="text-sm text-stone-400 mt-0.5">Here's everything in your IGCSE Tools workspace.</p>
        </div>

        {/* ── Top stat cards — 5 columns ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            icon={<Wand2 className="w-4 h-4 text-white" />}
            label="AI-Generated"
            value={aiCount}
            sub={`${assessmentCount} assessment${assessmentCount !== 1 ? 's' : ''}`}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <StatCard
            icon={<Upload className="w-4 h-4 text-white" />}
            label="ExamView Import"
            value={examviewCount}
            sub={examviewCount > 0 ? `from ${[...new Set(examviewQuestions.map(q => q.subject))].length} subject${[...new Set(examviewQuestions.map(q => q.subject))].length !== 1 ? 's' : ''}` : 'import via Library'}
            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          />
          <StatCard
            icon={<FileQuestion className="w-4 h-4 text-white" />}
            label="Past Paper (Admin)"
            value={pastPaperCount}
            sub={pastPaperCount > 0 ? `${[...new Set(importedQuestions.map(q => q.subject))].length} subject${[...new Set(importedQuestions.map(q => q.subject))].length !== 1 ? 's' : ''}` : 'import via Library'}
            gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          />
          <StatCard
            icon={<ImageIcon className="w-4 h-4 text-white" />}
            label="Diagram Gallery"
            value={diagramCount}
            sub={diagramBySubject[0] ? `most: ${diagramBySubject[0][0]}` : 'add diagrams'}
            gradient="bg-gradient-to-br from-orange-500 to-rose-500"
          />
          <StatCard
            icon={<Brain className="w-4 h-4 text-white" />}
            label="Unique Topics"
            value={allTopics}
            sub={`across ${subjectStats.length} subject${subjectStats.length !== 1 ? 's' : ''}`}
            gradient="bg-gradient-to-br from-pink-500 to-rose-600"
          />
        </div>

        {/* ── Total questions source bar ── */}
        {totalQuestions > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-stone-700">
                Total Questions: <span className="text-stone-900">{totalQuestions}</span>
              </p>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {sourceDistribution.map(s => (
                  <LegendDot key={s.label} color={s.legend} label={`${s.label} (${s.count})`} />
                ))}
              </div>
            </div>
            {/* Stacked progress bar */}
            <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
              {sourceDistribution.map(s => (
                <div
                  key={s.label}
                  className={`${s.color} h-full transition-all`}
                  style={{ width: `${Math.round((s.count / totalQuestions) * 100)}%` }}
                  title={`${s.label}: ${s.count}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Subject cards ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-stone-400" />
              Questions by Subject
            </h3>
            <button
              onClick={() => onNavigate('library')}
              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1"
            >
              Open Library <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {subjectStats.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {subjectStats.map(([subject, stats]) => (
                <SubjectCard
                  key={subject}
                  subject={subject}
                  aiCount={stats.ai}
                  examviewCount={stats.examview}
                  pastPaperCount={stats.pastPaper}
                  topicCount={stats.topics.size}
                  onNavigate={() => onNavigate('library')}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center">
              <BookOpen className="w-8 h-8 text-stone-200 mx-auto mb-2" />
              <p className="text-sm text-stone-400">No questions yet.</p>
              <button
                onClick={() => onNavigate('main')}
                className="mt-3 text-xs text-emerald-600 font-medium hover:text-emerald-800 flex items-center gap-1 mx-auto"
              >
                <Wand2 className="w-3.5 h-3.5" /> Generate your first assessment
              </button>
            </div>
          )}
        </section>

        {/* ── Middle row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* AI question breakdown */}
          <section className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-stone-400" />
              AI Question Breakdown
            </h3>

            {aiCount > 0 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">By Type</p>
                  <div className="space-y-1.5">
                    {[
                      { key: 'mcq',          label: 'MCQ',          color: 'bg-blue-400' },
                      { key: 'short_answer', label: 'Short Answer', color: 'bg-emerald-400' },
                      { key: 'structured',   label: 'Structured',   color: 'bg-violet-400' },
                    ].map(({ key, label, color }) => (
                      <BarRow key={key} label={label} count={typeBreakdown[key] ?? 0} total={aiCount} color={color} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">By Difficulty</p>
                  <div className="space-y-1.5">
                    {diffBreakdown.map(([diff, count]) => {
                      const color =
                        diff === 'Easy'                           ? 'bg-emerald-400' :
                        diff === 'Medium' || diff === 'Balanced'  ? 'bg-amber-400' :
                        diff === 'Hard'   || diff === 'Challenging'? 'bg-red-400' :
                        'bg-stone-300'
                      return <BarRow key={diff} label={diff} count={count} total={aiCount} color={color} />
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Zap className="w-6 h-6 text-stone-200 mx-auto mb-1.5" />
                <p className="text-xs text-stone-400">Generate questions to see breakdown.</p>
              </div>
            )}
          </section>

          {/* ExamView & Past Paper summary */}
          <section className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2 mb-4">
              <FileQuestion className="w-4 h-4 text-stone-400" />
              Imported Questions
            </h3>

            <div className="space-y-4">
              {/* ExamView */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <p className="text-xs font-semibold text-stone-600">ExamView</p>
                  <span className="ml-auto text-sm font-bold text-blue-600">{examviewCount}</span>
                </div>
                {examviewCount > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(
                      examviewQuestions.reduce<Record<string, number>>((acc, q) => {
                        if (q.subject) acc[q.subject] = (acc[q.subject] ?? 0) + 1
                        return acc
                      }, {})
                    ).sort((a, b) => b[1] - a[1]).map(([subj, cnt]) => {
                      const c = subjectColor(subj)
                      return (
                        <div key={subj} className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${c.badge}`}>{subj}</span>
                          <span className="text-xs text-stone-400 ml-auto">{cnt}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-stone-300 italic">None imported yet — use Library → Import</p>
                )}
              </div>

              <div className="border-t border-stone-50" />

              {/* Admin past paper */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                  <p className="text-xs font-semibold text-stone-600">Past Paper (Admin)</p>
                  <span className="ml-auto text-sm font-bold text-violet-600">{pastPaperCount}</span>
                </div>
                {pastPaperCount > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(
                      importedQuestions.reduce<Record<string, number>>((acc, q) => {
                        if (q.subject) acc[q.subject] = (acc[q.subject] ?? 0) + 1
                        return acc
                      }, {})
                    ).sort((a, b) => b[1] - a[1]).map(([subj, cnt]) => {
                      const c = subjectColor(subj)
                      return (
                        <div key={subj} className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${c.badge}`}>{subj}</span>
                          <span className="text-xs text-stone-400 ml-auto">{cnt}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-stone-300 italic">No admin-imported questions yet</p>
                )}
              </div>
            </div>
          </section>

          {/* Diagram gallery summary */}
          <section className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-stone-400" />
                Diagram Gallery
              </h3>
              <button
                onClick={() => onNavigate('diagrams')}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1"
              >
                Open <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {diagramCount > 0 ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  {diagramBySubject.map(([subject, count]) => {
                    const c = subjectColor(subject)
                    return (
                      <div key={subject} className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
                        <span className="text-xs text-stone-600 flex-1 truncate">{subject}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.badge}`}>{count}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="pt-2 border-t border-stone-50 flex gap-1.5 flex-wrap">
                  {diagramPool.slice(0, 9).map(d => (
                    <img
                      key={d.id}
                      src={d.imageURL}
                      alt={d.description || d.imageName}
                      className="w-10 h-10 object-cover rounded-lg border border-stone-100"
                    />
                  ))}
                  {diagramPool.length > 9 && (
                    <div className="w-10 h-10 rounded-lg border border-stone-100 bg-stone-50 flex items-center justify-center text-[10px] text-stone-400 font-medium">
                      +{diagramPool.length - 9}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <ImageIcon className="w-6 h-6 text-stone-200 mx-auto mb-1.5" />
                <p className="text-xs text-stone-400 mb-2">No diagrams yet.</p>
                <button onClick={() => onNavigate('diagrams')} className="text-xs text-emerald-600 font-medium hover:text-emerald-800">
                  Open Diagram Gallery →
                </button>
              </div>
            )}
          </section>
        </div>

        {/* ── Leaderboard ── */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Student Leaderboard
            </h3>
            <span className="text-[10px] text-stone-300 italic">Coming soon</span>
          </div>
          <p className="text-xs text-stone-400 mb-4">
            Students will earn points by solving practice questions. Top scorers appear here.
          </p>
          <div className="space-y-1.5">
            {leaderboard.map(row => <LeaderboardRow key={row.rank} {...row} />)}
            {[2, 3, 4, 5].map(rank => (
              <div key={rank} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-stone-50 opacity-30 select-none">
                <div className="w-7 h-7 bg-stone-200 rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 bg-stone-200 rounded w-1/3" />
                  <div className="h-2 bg-stone-100 rounded w-1/4" />
                </div>
                <div className="h-4 bg-stone-200 rounded w-8" />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 p-3 flex items-center gap-3">
            <Star className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">
              <span className="font-semibold">Student mode is coming.</span>{' '}
              Students will be able to solve questions, track progress, and earn points on this leaderboard.
            </p>
          </div>
        </section>

        {/* ── Quick actions ── */}
        <section>
          <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-stone-400" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => onNavigate('main')}
              className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
            >
              <Wand2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Generate Questions</p>
                <p className="text-xs text-white/70">AI-powered IGCSE assessment</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate('library')}
              className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
            >
              <BookOpen className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Browse Library</p>
                <p className="text-xs text-white/70">Past papers & saved assessments</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate('diagrams')}
              className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
            >
              <ImageIcon className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Diagram Gallery</p>
                <p className="text-xs text-white/70">Manage reusable diagrams</p>
              </div>
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
