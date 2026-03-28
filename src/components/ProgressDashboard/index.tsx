import { useMemo } from 'react'
import { TrendingUp, AlertTriangle, CheckCircle, BarChart2, Clock, Target } from 'lucide-react'
import type { PracticeAttempt, ExamAttempt } from '../../lib/types'

// ─── Topic accuracy computation ──────────────────────────────────────────────

interface TopicStat {
  topic: string
  subject: string
  marksAwarded: number
  totalMarks: number
  attempts: number
  accuracy: number    // 0–100
}

function computeTopicStats(
  practiceAttempts: PracticeAttempt[],
  examAttempts: ExamAttempt[],
): TopicStat[] {
  const map: Record<string, { subject: string; marksAwarded: number; totalMarks: number; attempts: number }> = {}

  // Combine both types
  const all: Array<{ topic: string; subject: string; answers: Record<string, { marksAwarded: number }> }> = [
    ...practiceAttempts.map(a => ({ topic: a.topic, subject: a.subject, answers: a.answers })),
    ...examAttempts.map(a => ({ topic: a.topic, subject: a.subject, answers: a.answers })),
  ]

  for (const attempt of all) {
    const key = `${attempt.subject}::${attempt.topic}`
    if (!map[key]) map[key] = { subject: attempt.subject, marksAwarded: 0, totalMarks: 0, attempts: 0 }
    map[key].attempts++
    for (const rec of Object.values(attempt.answers)) {
      map[key].marksAwarded += rec.marksAwarded ?? 0
      // totalMarks per question not stored in answers; estimate from the attempt-level sum
    }
  }

  // Re-compute per-topic totalMarks using attempt-level data
  const totalMap: Record<string, number> = {}
  for (const attempt of practiceAttempts) {
    const key = `${attempt.subject}::${attempt.topic}`
    totalMap[key] = (totalMap[key] ?? 0) + attempt.totalMarks
  }
  for (const attempt of examAttempts) {
    const key = `${attempt.subject}::${attempt.topic}`
    totalMap[key] = (totalMap[key] ?? 0) + attempt.totalMarks
  }

  // Re-compute marksAwarded per topic
  const awardsMap: Record<string, number> = {}
  for (const attempt of practiceAttempts) {
    const key = `${attempt.subject}::${attempt.topic}`
    awardsMap[key] = (awardsMap[key] ?? 0) + attempt.marksAwarded
  }
  for (const attempt of examAttempts) {
    const key = `${attempt.subject}::${attempt.topic}`
    awardsMap[key] = (awardsMap[key] ?? 0) + attempt.marksAwarded
  }

  return Object.entries(map)
    .map(([key, v]) => {
      const total = totalMap[key] ?? 0
      const awarded = awardsMap[key] ?? 0
      return {
        topic: key.split('::')[1],
        subject: v.subject,
        marksAwarded: awarded,
        totalMarks: total,
        attempts: v.attempts,
        accuracy: total > 0 ? Math.round((awarded / total) * 100) : 0,
      }
    })
    .filter(t => t.totalMarks > 0)
    .sort((a, b) => a.accuracy - b.accuracy)  // weakest first
}

// ─── Mini bar ─────────────────────────────────────────────────────────────────

function AccuracyBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function topicColor(accuracy: number): string {
  if (accuracy < 40) return 'bg-red-400'
  if (accuracy < 60) return 'bg-amber-400'
  if (accuracy < 80) return 'bg-yellow-400'
  return 'bg-emerald-500'
}

function topicBadgeColor(accuracy: number): string {
  if (accuracy < 40) return 'text-red-600 bg-red-50'
  if (accuracy < 60) return 'text-amber-600 bg-amber-50'
  if (accuracy < 80) return 'text-yellow-700 bg-yellow-50'
  return 'text-emerald-700 bg-emerald-50'
}

// ─── Attempt row ──────────────────────────────────────────────────────────────

function AttemptRow({ attempt, type }: {
  attempt: PracticeAttempt | ExamAttempt
  type: 'practice' | 'exam'
}) {
  const pct = attempt.totalMarks > 0 ? Math.round((attempt.marksAwarded / attempt.totalMarks) * 100) : 0
  const mins = Math.floor(attempt.durationSeconds / 60)
  const secs = attempt.durationSeconds % 60
  const completedAt = (attempt.completedAt as any)?.toDate?.() ?? new Date()
  const dateStr = completedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${type === 'exam' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
        {type === 'exam' ? 'EXAM' : 'PRACTICE'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">{attempt.subject} · {attempt.topic}</p>
        <p className="text-[10px] text-slate-400">{dateStr}</p>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <p className={`text-xs font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</p>
        <p className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-end">
          <Clock className="w-2.5 h-2.5" /> {mins}:{secs.toString().padStart(2, '0')}
        </p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  practiceAttempts: PracticeAttempt[]
  examAttempts: ExamAttempt[]
}

export function ProgressDashboard({ practiceAttempts, examAttempts }: Props) {
  const topicStats = useMemo(
    () => computeTopicStats(practiceAttempts, examAttempts),
    [practiceAttempts, examAttempts],
  )

  const weakTopics  = topicStats.filter(t => t.accuracy < 60)
  const strongTopics = topicStats.filter(t => t.accuracy >= 80)

  const overallPct = useMemo(() => {
    const totals = [...practiceAttempts, ...examAttempts]
    const totalMarks = totals.reduce((s, a) => s + a.totalMarks, 0)
    const awarded = totals.reduce((s, a) => s + a.marksAwarded, 0)
    return totalMarks > 0 ? Math.round((awarded / totalMarks) * 100) : null
  }, [practiceAttempts, examAttempts])

  const totalAttempts = practiceAttempts.length + examAttempts.length

  // Recent history (last 10 combined, sorted newest first)
  const recentHistory = useMemo(() => {
    const all: Array<{ attempt: PracticeAttempt | ExamAttempt; type: 'practice' | 'exam'; ts: number }> = [
      ...practiceAttempts.map(a => ({ attempt: a, type: 'practice' as const, ts: (a.completedAt as any)?.toMillis?.() ?? 0 })),
      ...examAttempts.map(a => ({ attempt: a, type: 'exam' as const, ts: (a.completedAt as any)?.toMillis?.() ?? 0 })),
    ]
    return all.sort((a, b) => b.ts - a.ts).slice(0, 10)
  }, [practiceAttempts, examAttempts])

  if (totalAttempts === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <BarChart2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">No attempts yet</p>
          <p className="text-xs text-slate-400 mt-1">Complete a practice or exam session to see your progress here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-indigo-50 min-h-0 w-full">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Summary */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" /> My Progress
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Performance across practice and exam sessions.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Sessions', value: totalAttempts, sub: `${practiceAttempts.length}P + ${examAttempts.length}E`, color: 'from-indigo-500 to-blue-600' },
            { label: 'Overall Score', value: overallPct !== null ? `${overallPct}%` : '—', sub: 'all sessions', color: 'from-emerald-500 to-teal-600' },
            { label: 'Topics Practiced', value: topicStats.length, sub: 'unique topics', color: 'from-violet-500 to-purple-600' },
            { label: 'Weak Topics', value: weakTopics.length, sub: 'below 60%', color: weakTopics.length > 0 ? 'from-red-400 to-rose-600' : 'from-slate-400 to-slate-500' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className={`rounded-2xl p-4 text-white bg-gradient-to-br ${color} shadow-sm`}>
              <p className="text-xl font-bold leading-none">{value}</p>
              <p className="text-[10px] text-white/70 mt-0.5">{sub}</p>
              <p className="text-xs font-medium text-white/80 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Topic accuracy */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-slate-400" />
            Topic Accuracy
          </h3>

          {topicStats.length > 0 ? (
            <div className="space-y-2">
              {topicStats.map(t => (
                <div key={`${t.subject}-${t.topic}`} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-medium text-slate-700 truncate">{t.topic}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{t.subject}</span>
                    </div>
                    <AccuracyBar pct={t.accuracy} color={topicColor(t.accuracy)} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${topicBadgeColor(t.accuracy)}`}>
                      {t.accuracy}%
                    </span>
                    <span className="text-[10px] text-slate-300">{t.attempts}×</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">No data yet.</p>
          )}
        </section>

        {/* Weak & strong topics */}
        {(weakTopics.length > 0 || strongTopics.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {weakTopics.length > 0 && (
              <section className="bg-red-50 rounded-2xl border border-red-100 p-4">
                <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  Needs Practice
                </h3>
                <div className="space-y-1.5">
                  {weakTopics.slice(0, 5).map(t => (
                    <div key={t.topic} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <span className="text-xs text-red-700 flex-1 truncate">{t.topic}</span>
                      <span className="text-xs font-bold text-red-600">{t.accuracy}%</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {strongTopics.length > 0 && (
              <section className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4">
                <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4" />
                  Strong Topics
                </h3>
                <div className="space-y-1.5">
                  {strongTopics.slice(-5).reverse().map(t => (
                    <div key={t.topic} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-xs text-emerald-700 flex-1 truncate">{t.topic}</span>
                      <span className="text-xs font-bold text-emerald-600">{t.accuracy}%</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Recent history */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-slate-400" />
            Recent Sessions
          </h3>
          <div>
            {recentHistory.map(({ attempt, type }) => (
              <AttemptRow key={attempt.id} attempt={attempt} type={type} />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
