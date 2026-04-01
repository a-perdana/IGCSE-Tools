import { useState, useCallback } from 'react'
import { Users, Copy, Check, Trash2, ChevronRight, BarChart2, Clock, Award, X, RefreshCw } from 'lucide-react'
import type { Assessment, SharedAssignment, AssignmentAttempt, IgcseRole } from '../../lib/types'
import {
  createSharedAssignment,
  getSharedAssignmentByCode,
  joinSharedAssignment,
  saveAssignmentAttempt,
  getAssignmentAttempts,
  getTeacherAssignments,
  deleteSharedAssignment,
} from '../../lib/firebase'
import { ExamMode } from '../ExamMode'
import type { ExamAttempt, GenerationConfig } from '../../lib/types'

// ─── Share Panel (Teacher) ────────────────────────────────────────────────────

export function ShareAssessmentPanel({
  assessment,
  notify,
  onClose,
}: {
  assessment: Assessment
  notify: (msg: string, type: 'success' | 'error' | 'info') => void
  onClose: () => void
}) {
  const [isCreating, setIsCreating] = useState(false)
  const [result, setResult] = useState<{ id: string; code: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30)
  const [useTimeLimit, setUseTimeLimit] = useState(false)

  const handleCreate = useCallback(async () => {
    setIsCreating(true)
    try {
      const r = await createSharedAssignment(
        assessment.id,
        assessment,
        useTimeLimit ? timeLimitMinutes * 60 : undefined,
      )
      setResult(r)
      notify('Assignment shared! Students can join with the code below.', 'success')
    } catch (e: any) {
      notify(e?.message ?? 'Failed to create shared assignment.', 'error')
    } finally {
      setIsCreating(false)
    }
  }, [assessment, useTimeLimit, timeLimitMinutes, notify])

  const handleCopy = useCallback(async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            Share with Class
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-slate-500 space-y-0.5">
          <p><strong>{assessment.subject}</strong> · {assessment.topic}</p>
          <p>{assessment.questions.length} question{assessment.questions.length !== 1 ? 's' : ''}</p>
        </div>

        {!result ? (
          <>
            {/* Optional time limit */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useTimeLimit}
                onChange={e => setUseTimeLimit(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs font-medium text-slate-700">Set time limit</span>
            </label>
            {useTimeLimit && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={5} max={120} step={5}
                  value={timeLimitMinutes}
                  onChange={e => setTimeLimitMinutes(Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                />
                <span className="text-sm font-mono text-slate-700 w-10 text-right">{timeLimitMinutes}m</span>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              {isCreating ? 'Creating…' : 'Create Join Code'}
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Share this code with your students:</p>
            <div
              className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={handleCopy}
            >
              <span className="text-2xl font-bold font-mono tracking-widest text-blue-700">{result.code}</span>
              {copied
                ? <Check className="w-5 h-5 text-emerald-500" />
                : <Copy className="w-5 h-5 text-slate-400" />}
            </div>
            <p className="text-[11px] text-slate-400 text-center">Students go to Dashboard → Class → Join with code</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Join Panel (Student) ─────────────────────────────────────────────────────

export function JoinAssignmentPanel({
  notify,
  onJoined,
  onClose,
}: {
  notify: (msg: string, type: 'success' | 'error' | 'info') => void
  onJoined: (assignment: SharedAssignment) => void
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const [isLooking, setIsLooking] = useState(false)

  const handleJoin = useCallback(async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setIsLooking(true)
    try {
      const assignment = await getSharedAssignmentByCode(trimmed)
      if (!assignment) {
        notify('No assignment found with that code. Check the code and try again.', 'error')
        return
      }
      await joinSharedAssignment(assignment.id)
      notify(`Joined: ${assignment.assessmentSnapshot.subject} · ${assignment.assessmentSnapshot.topic}`, 'success')
      onJoined(assignment)
    } catch (e: any) {
      notify(e?.message ?? 'Failed to join assignment.', 'error')
    } finally {
      setIsLooking(false)
    }
  }, [code, notify, onJoined])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-blue-500" />
            Join Class Assignment
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">Enter the join code your teacher gave you:</p>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="e.g. BIO-5Q-X7K"
          maxLength={12}
          className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus
        />
        <button
          onClick={handleJoin}
          disabled={isLooking || !code.trim()}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isLooking ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
          {isLooking ? 'Looking up…' : 'Join Assignment'}
        </button>
      </div>
    </div>
  )
}

// ─── Assignment Exam Wrapper ──────────────────────────────────────────────────

export function AssignmentExam({
  assignment,
  currentUser,
  provider,
  apiKey,
  model,
  onComplete,
  onExit,
  notify,
}: {
  assignment: SharedAssignment
  currentUser: { uid: string; displayName: string | null; email: string | null }
  provider: GenerationConfig['provider']
  apiKey: string
  model: string
  onComplete: () => void
  onExit: () => void
  notify: (msg: string, type: 'success' | 'error' | 'info') => void
}) {
  const fakeAssessment = {
    id: assignment.assessmentId,
    subject: assignment.assessmentSnapshot.subject,
    topic: assignment.assessmentSnapshot.topic,
    difficulty: assignment.assessmentSnapshot.difficulty,
    questions: assignment.assessmentSnapshot.questions,
    userId: assignment.teacherId,
    createdAt: assignment.createdAt,
  } as any

  const handleExamComplete = useCallback(async (attempt: ExamAttempt) => {
    try {
      await saveAssignmentAttempt({
        assignmentId: assignment.id,
        assignmentCode: assignment.code,
        userId: currentUser.uid,
        displayName: currentUser.displayName ?? currentUser.email ?? 'Student',
        subject: assignment.assessmentSnapshot.subject,
        topic: assignment.assessmentSnapshot.topic,
        answers: attempt.answers,
        totalMarks: attempt.totalMarks,
        marksAwarded: attempt.marksAwarded,
        durationSeconds: attempt.durationSeconds,
      })
      notify(`Assignment submitted! ${attempt.marksAwarded}/${attempt.totalMarks} marks`, 'success')
      onComplete()
    } catch (e: any) {
      notify(e?.message ?? 'Could not save assignment attempt.', 'error')
    }
  }, [assignment, currentUser, notify, onComplete])

  return (
    <ExamMode
      assessment={fakeAssessment}
      provider={provider}
      apiKey={apiKey}
      model={model}
      onExit={onExit}
      onComplete={handleExamComplete}
      notify={notify}
      forcedTimeLimitSeconds={assignment.timeLimitSeconds}
    />
  )
}

// ─── Teacher Results View ─────────────────────────────────────────────────────

function ResultRow({ attempt, rank }: { attempt: AssignmentAttempt; rank: number }) {
  const pct = attempt.totalMarks > 0 ? Math.round((attempt.marksAwarded / attempt.totalMarks) * 100) : 0
  const mins = Math.floor(attempt.durationSeconds / 60)
  const secs = attempt.durationSeconds % 60
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 shrink-0">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{attempt.displayName}</p>
        <p className="text-xs text-slate-400">{attempt.marksAwarded}/{attempt.totalMarks} marks</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
          {pct}%
        </p>
        <p className="text-[10px] text-slate-400">{mins}:{secs.toString().padStart(2, '0')}</p>
      </div>
    </div>
  )
}

export function AssignmentResultsModal({
  assignment,
  onClose,
}: {
  assignment: SharedAssignment
  onClose: () => void
}) {
  const [attempts, setAttempts] = useState<AssignmentAttempt[] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAssignmentAttempts(assignment.id)
      // Sort by score desc, then speed asc
      const sorted = [...data].sort((a, b) => {
        const aPct = a.totalMarks > 0 ? a.marksAwarded / a.totalMarks : 0
        const bPct = b.totalMarks > 0 ? b.marksAwarded / b.totalMarks : 0
        if (bPct !== aPct) return bPct - aPct
        return a.durationSeconds - b.durationSeconds
      })
      setAttempts(sorted)
    } finally {
      setLoading(false)
    }
  }, [assignment.id])

  useState(() => { load() })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-500" />
              Results: {assignment.assessmentSnapshot.subject}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{assignment.assessmentSnapshot.topic} · Code: <strong>{assignment.code}</strong></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading results…
            </div>
          ) : attempts && attempts.length > 0 ? (
            <>
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Submissions', value: attempts.length, icon: <Users className="w-3.5 h-3.5" /> },
                  { label: 'Avg Score', value: `${Math.round(attempts.reduce((s, a) => s + (a.totalMarks > 0 ? a.marksAwarded / a.totalMarks : 0), 0) / attempts.length * 100)}%`, icon: <Award className="w-3.5 h-3.5" /> },
                  { label: 'Avg Time', value: (() => { const avg = Math.round(attempts.reduce((s, a) => s + a.durationSeconds, 0) / attempts.length); return `${Math.floor(avg / 60)}m ${avg % 60}s` })(), icon: <Clock className="w-3.5 h-3.5" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                    <div className="flex justify-center text-slate-400 mb-1">{icon}</div>
                    <p className="text-sm font-bold text-slate-800">{value}</p>
                    <p className="text-[10px] text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              {/* Per-student rows */}
              <div>
                {attempts.map((a, i) => <ResultRow key={a.id} attempt={a} rank={i + 1} />)}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No submissions yet.</p>
              <p className="text-xs text-slate-300 mt-1">Share code <strong>{assignment.code}</strong> with your class.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Class Dashboard Tab ──────────────────────────────────────────────────────

export function ClassDashboard({
  assessments,
  currentUser,
  userRole = 'student',
  provider,
  apiKey,
  model,
  notify,
}: {
  assessments: Assessment[]
  currentUser: { uid: string; displayName: string | null; email: string | null }
  userRole?: IgcseRole
  provider: GenerationConfig['provider']
  apiKey: string
  model: string
  notify: (msg: string, type: 'success' | 'error' | 'info') => void
}) {
  const [myAssignments, setMyAssignments] = useState<SharedAssignment[] | null>(null)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [activeAssignment, setActiveAssignment] = useState<SharedAssignment | null>(null)
  const [viewResultsFor, setViewResultsFor] = useState<SharedAssignment | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<SharedAssignment | null>(null)

  const loadAssignments = useCallback(async () => {
    setLoadingAssignments(true)
    try {
      const list = await getTeacherAssignments()
      setMyAssignments(list)
    } finally {
      setLoadingAssignments(false)
    }
  }, [])

  // Load on mount
  useState(() => { loadAssignments() })

  const handleDelete = useCallback(async (id: string) => {
    await deleteSharedAssignment(id)
    setMyAssignments(prev => prev?.filter(a => a.id !== id) ?? null)
    setDeleteConfirm(null)
    notify('Assignment deleted.', 'success')
  }, [notify])

  if (activeAssignment) {
    return (
      <AssignmentExam
        assignment={activeAssignment}
        currentUser={currentUser}
        provider={provider}
        apiKey={apiKey}
        model={model}
        onComplete={() => { setActiveAssignment(null); notify('Assignment submitted!', 'success') }}
        onExit={() => setActiveAssignment(null)}
        notify={notify}
      />
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 min-h-0 w-full">
      <div className="px-4 sm:px-6 lg:px-10 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" /> Class
              {userRole === 'teacher' || userRole === 'admin' ? ' — Teacher View' : ' — Student View'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {userRole === 'teacher' || userRole === 'admin'
                ? 'Manage and share assessments with your students.'
                : "Join your teacher's assignments and track your submissions."}
            </p>
          </div>
          <button
            onClick={() => setShowJoin(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            {userRole === 'teacher' || userRole === 'admin' ? 'Take Assignment' : 'Join Assignment'}
          </button>
        </div>

        {/* Teacher/Admin: My created assignments */}
        {(userRole === 'teacher' || userRole === 'admin') && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">My Shared Assignments</h3>
              <button
                onClick={loadAssignments}
                disabled={loadingAssignments}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingAssignments ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingAssignments ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-4 justify-center">
                <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
              </div>
            ) : myAssignments && myAssignments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {myAssignments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{a.assessmentSnapshot.subject} · {a.assessmentSnapshot.topic}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{a.code}</span>
                        <span className="text-[10px] text-slate-400">{a.studentIds.length} joined</span>
                        {a.timeLimitSeconds && <span className="text-[10px] text-slate-400">{Math.floor(a.timeLimitSeconds / 60)}m limit</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setViewResultsFor(a)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        title="View results"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(a)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete assignment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No shared assignments yet.</p>
                <p className="text-xs text-slate-300 mt-1">Go to Library, open an assessment, and click Share.</p>
              </div>
            )}
          </section>
        )}

        {/* Student: How to join + tip */}
        {userRole === 'student' && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <ChevronRight className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Join a Class Assignment</h3>
                <p className="text-xs text-slate-400">Ask your teacher for the join code, then click "Join Assignment" above.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">1. Get join code from teacher</span>
              <span className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">2. Click "Join Assignment"</span>
              <span className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">3. Complete the timed exam</span>
            </div>
          </section>
        )}
      </div>

      {/* Modals */}
      {showJoin && (
        <JoinAssignmentPanel
          notify={notify}
          onJoined={assignment => { setShowJoin(false); setActiveAssignment(assignment) }}
          onClose={() => setShowJoin(false)}
        />
      )}

      {viewResultsFor && (
        <AssignmentResultsModal
          assignment={viewResultsFor}
          onClose={() => setViewResultsFor(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full mx-4 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-slate-800">Delete assignment?</h3>
            <p className="text-xs text-slate-500">Code <strong>{deleteConfirm.code}</strong> will no longer work for students.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
