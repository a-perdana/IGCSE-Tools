import { useState, useCallback, useEffect } from 'react'
import { Users, Copy, Check, Trash2, ChevronRight, BarChart2, Clock, Award, X, RefreshCw, BookCheck, CheckCircle2, XCircle, ChevronDown, ChevronUp, School, Plus, LogOut } from 'lucide-react'
import type { Assessment, SharedAssignment, AssignmentAttempt, IgcseRole, QuestionItem, Classroom } from '../../lib/types'
import {
  createSharedAssignment,
  getSharedAssignmentByCode,
  joinSharedAssignment,
  saveAssignmentAttempt,
  getAssignmentAttempts,
  getTeacherAssignments,
  deleteSharedAssignment,
  getStudentAssignmentAttempts,
  getAssignmentById,
  createClassroom,
  getClassroomByCode,
  joinClassroom,
  leaveClassroom,
  getTeacherClassrooms,
  getStudentClassrooms,
  deleteClassroom,
  getStudentVisibleAssignments,
} from '../../lib/firebase'
import { ExamMode } from '../ExamMode'
import type { ExamAttempt, GenerationConfig } from '../../lib/types'
import { QMarkdown } from '../Library/modals'

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

// ─── Student Attempt Detail Modal ────────────────────────────────────────────

export function StudentAttemptDetailModal({
  attempt,
  onClose,
}: {
  attempt: AssignmentAttempt
  onClose: () => void
}) {
  const [questions, setQuestions] = useState<QuestionItem[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    getAssignmentById(attempt.assignmentId)
      .then(a => setQuestions(a?.assessmentSnapshot.questions ?? []))
      .catch(() => setQuestions([]))
  }, [attempt.assignmentId])

  const pct = attempt.totalMarks > 0 ? Math.round((attempt.marksAwarded / attempt.totalMarks) * 100) : 0
  const mins = Math.floor(attempt.durationSeconds / 60)
  const secs = attempt.durationSeconds % 60
  const completedAt = (attempt as any).completedAt
  const dateStr = completedAt
    ? new Date(typeof completedAt === 'number' ? completedAt : completedAt.toMillis?.() ?? Date.now()).toLocaleString()
    : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <BookCheck className="w-4 h-4 text-blue-500" />
              {attempt.subject} · {attempt.topic}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Code: <span className="font-mono">{attempt.assignmentCode}</span>
              {dateStr ? ` · ${dateStr}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b border-slate-50 shrink-0">
          {[
            { label: 'Score', value: `${pct}%`, icon: <Award className="w-3.5 h-3.5" /> },
            { label: 'Marks', value: `${attempt.marksAwarded}/${attempt.totalMarks}`, icon: <BarChart2 className="w-3.5 h-3.5" /> },
            { label: 'Time', value: `${mins}m ${secs}s`, icon: <Clock className="w-3.5 h-3.5" /> },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <div className="flex justify-center text-slate-400 mb-1">{s.icon}</div>
              <p className="text-sm font-bold text-slate-800">{s.value}</p>
              <p className="text-[10px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Question list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {questions === null ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading questions…
            </div>
          ) : Object.entries(attempt.answers).map(([qId, ans], idx) => {
            const q = questions.find(q => q.id === qId)
            const isOpen = expanded === qId
            return (
              <div key={qId} className={`rounded-xl border ${ans.isCorrect ? 'border-emerald-100 bg-emerald-50/40' : 'border-red-100 bg-red-50/40'}`}>
                <button
                  className="w-full flex items-start gap-3 px-4 py-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : qId)}
                >
                  <div className={`shrink-0 mt-0.5 ${ans.isCorrect ? 'text-emerald-500' : 'text-red-400'}`}>
                    {ans.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">Q{idx + 1}{q?.type === 'mcq' ? ' (MCQ)' : ''}</p>
                    {q && <p className="text-xs text-slate-700 line-clamp-2">{q.text?.replace(/\*\*/g, '').slice(0, 120)}{(q.text?.length ?? 0) > 120 ? '…' : ''}</p>}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`text-xs font-bold ${ans.isCorrect ? 'text-emerald-600' : 'text-red-500'}`}>
                      {ans.marksAwarded}/{q?.marks ?? '?'}
                    </span>
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                    {q && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Question</p>
                        <div className="text-xs text-slate-700"><QMarkdown content={q.text} /></div>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Your Answer</p>
                      <div className={`text-xs rounded-lg px-3 py-2 ${ans.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {ans.userAnswer || <span className="italic opacity-60">No answer</span>}
                      </div>
                    </div>
                    {q?.answer && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Correct Answer</p>
                        <div className="text-xs bg-slate-100 rounded-lg px-3 py-2 text-slate-700">
                          <QMarkdown content={q.answer} />
                        </div>
                      </div>
                    )}
                    {ans.aiFeedback && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">AI Feedback</p>
                        <div className="text-xs text-slate-600 bg-indigo-50 rounded-lg px-3 py-2">
                          <QMarkdown content={ans.aiFeedback} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs bg-slate-800 text-white rounded-xl hover:bg-slate-700">
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
  onStartPractice,
}: {
  assessments: Assessment[]
  currentUser: { uid: string; displayName: string | null; email: string | null }
  userRole?: IgcseRole
  provider: GenerationConfig['provider']
  apiKey: string
  model: string
  notify: (msg: string, type: 'success' | 'error' | 'info') => void
  onStartPractice?: (assessment: Assessment) => void
}) {
  const [myAssignments, setMyAssignments] = useState<SharedAssignment[] | null>(null)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [activeAssignment, setActiveAssignment] = useState<SharedAssignment | null>(null)
  const [viewResultsFor, setViewResultsFor] = useState<SharedAssignment | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<SharedAssignment | null>(null)
  const [myAttempts, setMyAttempts] = useState<AssignmentAttempt[] | null>(null)
  const [loadingAttempts, setLoadingAttempts] = useState(false)
  const [viewDetailFor, setViewDetailFor] = useState<AssignmentAttempt | null>(null)
  const [showPracticePickerRaw, setShowPracticePicker] = useState(false)
  const [practiceSearch, setPracticeSearch] = useState('')
  const [shareFromClass, setShareFromClass] = useState<Assessment | null>(null)
  const [showNewAssignmentPicker, setShowNewAssignmentPicker] = useState(false)
  const [assignmentSearch, setAssignmentSearch] = useState('')

  // ── Classroom state ──────────────────────────────────────────────────────────
  const [classrooms, setClassrooms] = useState<Classroom[] | null>(null)
  const [loadingClassrooms, setLoadingClassrooms] = useState(false)
  const [showCreateClassroom, setShowCreateClassroom] = useState(false)
  const [newClassroomName, setNewClassroomName] = useState('')
  const [creatingClassroom, setCreatingClassroom] = useState(false)
  const [showJoinClassroom, setShowJoinClassroom] = useState(false)
  const [joinClassroomCode, setJoinClassroomCode] = useState('')
  const [joiningClassroom, setJoiningClassroom] = useState(false)
  const [copiedClassCode, setCopiedClassCode] = useState<string | null>(null)

  const loadClassrooms = useCallback(async () => {
    setLoadingClassrooms(true)
    try {
      const isTeacher = userRole === 'teacher' || userRole === 'admin'
      const list = isTeacher ? await getTeacherClassrooms() : await getStudentClassrooms()
      setClassrooms(list)
    } finally {
      setLoadingClassrooms(false)
    }
  }, [userRole])

  const handleCreateClassroom = useCallback(async () => {
    const name = newClassroomName.trim()
    if (!name) return
    setCreatingClassroom(true)
    try {
      await createClassroom(name)
      setNewClassroomName('')
      setShowCreateClassroom(false)
      await loadClassrooms()
      notify(`Classroom "${name}" created!`, 'success')
    } catch (e: any) {
      notify(e?.message ?? 'Failed to create classroom.', 'error')
    } finally {
      setCreatingClassroom(false)
    }
  }, [newClassroomName, loadClassrooms, notify])

  const handleJoinClassroom = useCallback(async () => {
    const code = joinClassroomCode.trim().toUpperCase()
    if (!code) return
    setJoiningClassroom(true)
    try {
      const classroom = await getClassroomByCode(code)
      if (!classroom) { notify('No classroom found with that code.', 'error'); return }
      await joinClassroom(classroom.id)
      setJoinClassroomCode('')
      setShowJoinClassroom(false)
      await loadClassrooms()
      notify(`Joined classroom: ${classroom.name}`, 'success')
    } catch (e: any) {
      notify(e?.message ?? 'Failed to join classroom.', 'error')
    } finally {
      setJoiningClassroom(false)
    }
  }, [joinClassroomCode, loadClassrooms, notify])

  const handleLeaveClassroom = useCallback(async (id: string, name: string) => {
    try {
      await leaveClassroom(id)
      setClassrooms(prev => prev?.filter(c => c.id !== id) ?? null)
      notify(`Left classroom: ${name}`, 'info')
    } catch (e: any) {
      notify(e?.message ?? 'Failed to leave classroom.', 'error')
    }
  }, [notify])

  const handleDeleteClassroom = useCallback(async (id: string, name: string) => {
    try {
      await deleteClassroom(id)
      setClassrooms(prev => prev?.filter(c => c.id !== id) ?? null)
      notify(`Classroom "${name}" deleted.`, 'success')
    } catch (e: any) {
      notify(e?.message ?? 'Failed to delete classroom.', 'error')
    }
  }, [notify])

  const loadAssignments = useCallback(async () => {
    setLoadingAssignments(true)
    try {
      const list = await getTeacherAssignments()
      setMyAssignments(list)
    } finally {
      setLoadingAssignments(false)
    }
  }, [])

  const loadMyAttempts = useCallback(async () => {
    setLoadingAttempts(true)
    try {
      const list = await getStudentAssignmentAttempts()
      setMyAttempts(list)
    } finally {
      setLoadingAttempts(false)
    }
  }, [])

  // Load on mount
  useState(() => { loadAssignments(); loadClassrooms() })

  useEffect(() => {
    if (userRole === 'student') loadMyAttempts()
  }, [userRole]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <div className="flex items-center gap-2 flex-wrap">
            {(userRole === 'teacher' || userRole === 'admin') && (
              <>
                <button
                  onClick={() => { setShowCreateClassroom(v => !v); setShowNewAssignmentPicker(false) }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                >
                  <School className="w-3.5 h-3.5" /> New Classroom
                </button>
                <button
                  onClick={() => { setShowNewAssignmentPicker(v => !v); setShowCreateClassroom(false) }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  <Users className="w-3.5 h-3.5" /> New Assignment
                </button>
              </>
            )}
            {userRole === 'student' && (
              <button
                onClick={() => setShowJoinClassroom(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
              >
                <School className="w-3.5 h-3.5" /> Join Classroom
              </button>
            )}
            <button
              onClick={() => setShowJoin(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              {userRole === 'teacher' || userRole === 'admin' ? 'Take Assignment' : 'Join Assignment'}
            </button>
          </div>
        </div>

        {/* Teacher: Create classroom form */}
        {(userRole === 'teacher' || userRole === 'admin') && showCreateClassroom && (
          <section className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <School className="w-4 h-4 text-emerald-500" /> Create Classroom
              </h3>
              <button onClick={() => setShowCreateClassroom(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-400 mb-3">Students join by classroom code — all your assignments shared to this class will be visible to members automatically.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newClassroomName}
                onChange={e => setNewClassroomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateClassroom()}
                placeholder="e.g. Year 10 Biology"
                maxLength={80}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
                autoFocus
              />
              <button
                onClick={handleCreateClassroom}
                disabled={creatingClassroom || !newClassroomName.trim()}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5"
              >
                {creatingClassroom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Create
              </button>
            </div>
          </section>
        )}

        {/* Teacher/Admin: New Assignment picker */}
        {(userRole === 'teacher' || userRole === 'admin') && showNewAssignmentPicker && (
          <section className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" /> Share an Assessment
              </h3>
              <button onClick={() => setShowNewAssignmentPicker(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={assignmentSearch}
              onChange={e => setAssignmentSearch(e.target.value)}
              placeholder="Search by subject or topic…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-3"
              autoFocus
            />
            {assessments.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No assessments in your library yet. Generate some first.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {assessments
                  .filter(a => {
                    const q = assignmentSearch.toLowerCase()
                    return !q || a.subject?.toLowerCase().includes(q) || a.topic?.toLowerCase().includes(q)
                  })
                  .slice(0, 30)
                  .map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setShareFromClass(a); setShowNewAssignmentPicker(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{a.subject} · {a.topic}</p>
                        <p className="text-[10px] text-slate-400">{a.questions.length} question{a.questions.length !== 1 ? 's' : ''}{a.difficulty ? ` · ${a.difficulty}` : ''}</p>
                      </div>
                      <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    </button>
                  ))}
              </div>
            )}
          </section>
        )}

        {/* Teacher/Admin: My classrooms */}
        {(userRole === 'teacher' || userRole === 'admin') && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <School className="w-4 h-4 text-emerald-500" /> My Classrooms
              </h3>
              <button
                onClick={loadClassrooms}
                disabled={loadingClassrooms}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingClassrooms ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {loadingClassrooms ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-4 justify-center">
                <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
              </div>
            ) : classrooms && classrooms.length > 0 ? (
              <div className="space-y-2">
                {classrooms.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                    <School className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{c.code}</span>
                        <span className="text-[10px] text-slate-400">{c.studentIds.length} student{c.studentIds.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(c.code)
                          setCopiedClassCode(c.id)
                          setTimeout(() => setCopiedClassCode(null), 2000)
                        }}
                        title="Copy class code"
                        className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"
                      >
                        {copiedClassCode === c.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteClassroom(c.id, c.name)}
                        title="Delete classroom"
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <School className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No classrooms yet.</p>
                <p className="text-xs text-slate-300 mt-1">Create a classroom so students can join by code.</p>
              </div>
            )}
          </section>
        )}

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

        {/* Student: My Classrooms */}
        {userRole === 'student' && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <School className="w-4 h-4 text-emerald-500" /> My Classrooms
              </h3>
              <button onClick={loadClassrooms} disabled={loadingClassrooms} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${loadingClassrooms ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {loadingClassrooms ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-4 justify-center">
                <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
              </div>
            ) : classrooms && classrooms.length > 0 ? (
              <div className="space-y-2">
                {classrooms.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                    <School className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400">Teacher: {c.teacherName} · {c.studentIds.length} student{c.studentIds.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => handleLeaveClassroom(c.id, c.name)}
                      title="Leave classroom"
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <School className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No classrooms yet.</p>
                <p className="text-xs text-slate-300 mt-1">Click "Join Classroom" and enter the code your teacher gave you.</p>
              </div>
            )}
          </section>
        )}

        {/* Student: Solo Practice */}
        {userRole === 'student' && onStartPractice && assessments.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Award className="w-4 h-4 text-violet-500" /> Solo Practice
              </h3>
              <button
                onClick={() => setShowPracticePicker(v => !v)}
                className="text-xs text-violet-600 font-semibold hover:text-violet-800 flex items-center gap-1"
              >
                {showPracticePickerRaw ? 'Hide' : 'Browse'} <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPracticePickerRaw ? 'rotate-90' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">Practice on shared assessments from your teachers — no join code needed.</p>
            {showPracticePickerRaw && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={practiceSearch}
                  onChange={e => setPracticeSearch(e.target.value)}
                  placeholder="Search by subject or topic…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {assessments
                    .filter(a => {
                      const q = practiceSearch.toLowerCase()
                      return !q || a.subject?.toLowerCase().includes(q) || a.topic?.toLowerCase().includes(q)
                    })
                    .slice(0, 30)
                    .map(a => (
                      <button
                        key={a.id}
                        onClick={() => { onStartPractice(a); setShowPracticePicker(false) }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-violet-50 hover:border-violet-200 border border-transparent transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{a.subject} · {a.topic}</p>
                          <p className="text-[10px] text-slate-400">{a.questions.length} question{a.questions.length !== 1 ? 's' : ''}{a.difficulty ? ` · ${a.difficulty}` : ''}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      </button>
                    ))}
                  {assessments.filter(a => {
                    const q = practiceSearch.toLowerCase()
                    return !q || a.subject?.toLowerCase().includes(q) || a.topic?.toLowerCase().includes(q)
                  }).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No assessments found.</p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Student: Past submissions */}
        {userRole === 'student' && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <BookCheck className="w-4 h-4 text-blue-500" /> My Submissions
              </h3>
              <button
                onClick={loadMyAttempts}
                disabled={loadingAttempts}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingAttempts ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {loadingAttempts ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-4 justify-center">
                <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
              </div>
            ) : myAttempts && myAttempts.length > 0 ? (
              <div className="space-y-2">
                {myAttempts.map(a => {
                  const pct = a.totalMarks > 0 ? Math.round((a.marksAwarded / a.totalMarks) * 100) : 0
                  const completedAt = (a as any).completedAt
                  const date = completedAt
                    ? new Date(typeof completedAt === 'number' ? completedAt : completedAt.toMillis?.() ?? Date.now()).toLocaleDateString()
                    : ''
                  return (
                    <button
                      key={a.id}
                      onClick={() => setViewDetailFor(a)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{a.subject} · {a.topic}</p>
                        <p className="text-xs text-slate-400">Code: <span className="font-mono">{a.assignmentCode}</span>{date ? ` · ${date}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {pct}%
                        </p>
                        <p className="text-[10px] text-slate-400">{a.marksAwarded}/{a.totalMarks} marks</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No submissions yet.</p>
                <p className="text-xs text-slate-300 mt-1">Join an assignment to get started.</p>
              </div>
            )}
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

      {showJoinClassroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <School className="w-4 h-4 text-emerald-500" /> Join Classroom
              </h3>
              <button onClick={() => setShowJoinClassroom(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-500">Enter the classroom code your teacher gave you. You'll automatically see all assignments shared to this class.</p>
            <input
              type="text"
              value={joinClassroomCode}
              onChange={e => setJoinClassroomCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoinClassroom()}
              placeholder="e.g. CLS-A1B2"
              maxLength={8}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-400"
              autoFocus
            />
            <button
              onClick={handleJoinClassroom}
              disabled={joiningClassroom || !joinClassroomCode.trim()}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {joiningClassroom ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              {joiningClassroom ? 'Joining…' : 'Join Classroom'}
            </button>
          </div>
        </div>
      )}

      {viewDetailFor && (
        <StudentAttemptDetailModal
          attempt={viewDetailFor}
          onClose={() => setViewDetailFor(null)}
        />
      )}

      {shareFromClass && (
        <ShareAssessmentPanel
          assessment={shareFromClass}
          notify={notify}
          onClose={() => { setShareFromClass(null); loadAssignments() }}
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
