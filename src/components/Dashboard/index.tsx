import React, { useMemo } from 'react'
import {
  BookOpen, Brain, FileQuestion, ImageIcon, Wand2, Trophy,
  TrendingUp, Users, Layers, ChevronRight, Star, Zap,
} from 'lucide-react'
import type { Assessment, Question, ImportedQuestion, DiagramPoolEntry, Resource } from '../../lib/types'
import { IGCSE_SUBJECTS } from '../../lib/gemini'

// ─── Subject colour palette ───────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  Mathematics:       { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  Biology:           { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500' },
  Chemistry:         { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  Physics:           { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  'Computer Science':{ bg: 'bg-cyan-50',    border: 'border-cyan-200',   text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-700',     dot: 'bg-cyan-500' },
  Economics:         { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  History:           { bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700',     dot: 'bg-rose-500' },
  Geography:         { bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-700',    badge: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500' },
}

const DEFAULT_COLOR = { bg: 'bg-stone-50', border: 'border-stone-200', text: 'text-stone-700', badge: 'bg-stone-100 text-stone-700', dot: 'bg-stone-400' }

function subjectColor(subject: string) {
  return SUBJECT_COLORS[subject] ?? DEFAULT_COLOR
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  gradient,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  gradient: string
}) {
  return (
    <div className={`rounded-2xl p-4 text-white ${gradient} shadow-sm flex flex-col gap-2 min-w-0`}>
      <div className="flex items-center justify-between">
        <div className="p-1.5 rounded-xl bg-white/20">{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        {sub && <p className="text-xs text-white/70 mt-0.5">{sub}</p>}
        <p className="text-xs font-medium text-white/80 mt-1">{label}</p>
      </div>
    </div>
  )
}

// ─── Subject topic card ───────────────────────────────────────────────────────

function SubjectCard({
  subject,
  aiCount,
  pastPaperCount,
  topicCount,
  onNavigate,
}: {
  subject: string
  aiCount: number
  pastPaperCount: number
  topicCount: number
  onNavigate: () => void
}) {
  const c = subjectColor(subject)
  const total = aiCount + pastPaperCount

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
        <ChevronRight className={`w-4 h-4 ${c.text} opacity-0 group-hover:opacity-100 transition-opacity mt-0.5`} />
      </div>

      <div className="flex items-end justify-between">
        <p className={`text-3xl font-bold ${c.text}`}>{total}</p>
        <div className="flex flex-col gap-1 text-right">
          {aiCount > 0 && (
            <span className="text-[10px] text-stone-400 flex items-center gap-1 justify-end">
              <Wand2 className="w-3 h-3" /> {aiCount} AI-generated
            </span>
          )}
          {pastPaperCount > 0 && (
            <span className="text-[10px] text-stone-400 flex items-center gap-1 justify-end">
              <FileQuestion className="w-3 h-3" /> {pastPaperCount} past paper
            </span>
          )}
        </div>
      </div>

      <p className="text-[10px] text-stone-400 mt-2">questions total</p>
    </button>
  )
}

// ─── Leaderboard placeholder row ─────────────────────────────────────────────

function LeaderboardRow({ rank, name, score, correct, total }: {
  rank: number
  name: string
  score: number
  correct: number
  total: number
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard({
  assessments,
  questions,
  importedQuestions,
  diagramPool,
  resources,
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
  // ── Aggregate stats ──────────────────────────────────────────────────────

  const aiQuestionCount = questions.length
  const pastPaperCount = importedQuestions.length
  const diagramCount = diagramPool.length
  const assessmentCount = assessments.length

  // Unique topics across all AI questions
  const allTopics = useMemo(() => {
    const s = new Set<string>()
    questions.forEach(q => q.topic && s.add(q.topic))
    assessments.forEach(a => a.topic && s.add(a.topic))
    return s.size
  }, [questions, assessments])

  // ── Per-subject breakdown ────────────────────────────────────────────────

  const subjectStats = useMemo(() => {
    const map: Record<string, { aiCount: number; pastPaperCount: number; topics: Set<string> }> = {}

    const ensure = (s: string) => {
      if (!map[s]) map[s] = { aiCount: 0, pastPaperCount: 0, topics: new Set() }
    }

    questions.forEach(q => {
      if (!q.subject) return
      ensure(q.subject)
      map[q.subject].aiCount++
      if (q.topic) map[q.subject].topics.add(q.topic)
    })

    assessments.forEach(a => {
      if (!a.subject) return
      ensure(a.subject)
      a.questions.forEach(() => {}) // already counted via questions
      if (a.topic) map[a.subject].topics.add(a.topic)
    })

    importedQuestions.forEach(q => {
      if (!q.subject) return
      ensure(q.subject)
      map[q.subject].pastPaperCount++
      if (q.topic) map[q.subject].topics.add(q.topic)
    })

    // Only return subjects that have any content
    return Object.entries(map)
      .filter(([, v]) => v.aiCount + v.pastPaperCount > 0)
      .sort((a, b) => (b[1].aiCount + b[1].pastPaperCount) - (a[1].aiCount + a[1].pastPaperCount))
  }, [questions, assessments, importedQuestions])

  // ── Diagram subject breakdown ────────────────────────────────────────────

  const diagramBySubject = useMemo(() => {
    const map: Record<string, number> = {}
    diagramPool.forEach(d => {
      map[d.subject] = (map[d.subject] ?? 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [diagramPool])

  // ── Question type breakdown (AI questions) ────────────────────────────────

  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = { mcq: 0, short_answer: 0, structured: 0 }
    questions.forEach(q => { if (q.type) map[q.type] = (map[q.type] ?? 0) + 1 })
    return map
  }, [questions])

  // ── Difficulty breakdown ─────────────────────────────────────────────────

  const diffBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    questions.forEach(q => {
      const d = q.difficulty || 'Unknown'
      map[d] = (map[d] ?? 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [questions])

  // ── Placeholder leaderboard ──────────────────────────────────────────────

  const leaderboard = [
    { rank: 1, name: currentUserName || 'You', score: 0, correct: 0, total: 0 },
  ]

  const isEmpty = aiQuestionCount === 0 && pastPaperCount === 0 && diagramCount === 0

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-stone-50 to-slate-50 min-h-0">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Welcome header ── */}
        <div>
          <h2 className="text-xl font-bold text-stone-800">
            Welcome back{currentUserName ? `, ${currentUserName.split(' ')[0]}` : ''}! 👋
          </h2>
          <p className="text-sm text-stone-400 mt-0.5">Here's everything in your IGCSE Tools workspace.</p>
        </div>

        {/* ── Top stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<Wand2 className="w-4 h-4 text-white" />}
            label="AI-Generated Questions"
            value={aiQuestionCount}
            sub={`${assessmentCount} assessment${assessmentCount !== 1 ? 's' : ''}`}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <StatCard
            icon={<FileQuestion className="w-4 h-4 text-white" />}
            label="Past Paper Questions"
            value={pastPaperCount}
            sub={pastPaperCount > 0 ? `${[...new Set(importedQuestions.map(q => q.subject))].length} subjects` : 'import via Library'}
            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          />
          <StatCard
            icon={<ImageIcon className="w-4 h-4 text-white" />}
            label="Diagrams in Gallery"
            value={diagramCount}
            sub={diagramBySubject[0] ? `most: ${diagramBySubject[0][0]}` : 'add diagrams'}
            gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          />
          <StatCard
            icon={<Brain className="w-4 h-4 text-white" />}
            label="Unique Topics Covered"
            value={allTopics}
            sub={`across ${subjectStats.length} subject${subjectStats.length !== 1 ? 's' : ''}`}
            gradient="bg-gradient-to-br from-orange-500 to-rose-500"
          />
        </div>

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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {subjectStats.map(([subject, stats]) => (
                <SubjectCard
                  key={subject}
                  subject={subject}
                  aiCount={stats.aiCount}
                  pastPaperCount={stats.pastPaperCount}
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

        {/* ── Middle row: breakdown + diagrams ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Question type & difficulty breakdown */}
          <section className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-stone-400" />
              AI Question Breakdown
            </h3>

            {aiQuestionCount > 0 ? (
              <div className="space-y-4">
                {/* Type */}
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">By Type</p>
                  <div className="space-y-1.5">
                    {[
                      { key: 'mcq', label: 'MCQ', color: 'bg-blue-400' },
                      { key: 'short_answer', label: 'Short Answer', color: 'bg-emerald-400' },
                      { key: 'structured', label: 'Structured', color: 'bg-violet-400' },
                    ].map(({ key, label, color }) => {
                      const count = typeBreakdown[key] ?? 0
                      const pct = aiQuestionCount > 0 ? Math.round((count / aiQuestionCount) * 100) : 0
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-stone-500 w-24 shrink-0">{label}</span>
                          <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-stone-400 w-8 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">By Difficulty</p>
                  <div className="space-y-1.5">
                    {diffBreakdown.map(([diff, count]) => {
                      const pct = aiQuestionCount > 0 ? Math.round((count / aiQuestionCount) * 100) : 0
                      const color =
                        diff === 'Easy' ? 'bg-emerald-400' :
                        diff === 'Medium' || diff === 'Balanced' ? 'bg-amber-400' :
                        diff === 'Hard' || diff === 'Challenging' ? 'bg-red-400' :
                        'bg-stone-300'
                      return (
                        <div key={diff} className="flex items-center gap-2">
                          <span className="text-xs text-stone-500 w-24 shrink-0 truncate">{diff}</span>
                          <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-stone-400 w-8 text-right">{count}</span>
                        </div>
                      )
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
              <div className="space-y-2">
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
                <div className="mt-3 pt-3 border-t border-stone-50">
                  {/* Thumbnail strip */}
                  <div className="flex gap-1.5 flex-wrap">
                    {diagramPool.slice(0, 8).map(d => (
                      <img
                        key={d.id}
                        src={d.imageURL}
                        alt={d.description || d.imageName}
                        className="w-10 h-10 object-cover rounded-lg border border-stone-100"
                      />
                    ))}
                    {diagramPool.length > 8 && (
                      <div className="w-10 h-10 rounded-lg border border-stone-100 bg-stone-50 flex items-center justify-center text-[10px] text-stone-400 font-medium">
                        +{diagramPool.length - 8}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <ImageIcon className="w-6 h-6 text-stone-200 mx-auto mb-1.5" />
                <p className="text-xs text-stone-400 mb-2">No diagrams yet.</p>
                <button
                  onClick={() => onNavigate('diagrams')}
                  className="text-xs text-emerald-600 font-medium hover:text-emerald-800"
                >
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

          {/* Placeholder rows */}
          <div className="space-y-1.5">
            {leaderboard.map(row => (
              <LeaderboardRow key={row.rank} {...row} />
            ))}
            {/* Ghost rows */}
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
