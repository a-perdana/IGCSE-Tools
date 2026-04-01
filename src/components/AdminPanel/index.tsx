import { useState, useCallback, useEffect } from 'react'
import { Shield, RefreshCw, GraduationCap, UserCog, Crown, Key, Eye, EyeOff, Save } from 'lucide-react'
import type { UserProfile, IgcseRole } from '../../lib/types'
import { getAllUserProfiles, setUserRoleById, getWorkspaceConfig, saveWorkspaceConfig } from '../../lib/firebase'

const ROLE_CONFIG: Record<IgcseRole, { label: string; badge: string; icon: React.ReactNode }> = {
  student: { label: 'Student', badge: 'bg-emerald-100 text-emerald-700', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  teacher: { label: 'Teacher', badge: 'bg-indigo-100 text-indigo-700', icon: <UserCog className="w-3.5 h-3.5" /> },
  admin:   { label: 'Admin',   badge: 'bg-amber-100 text-amber-700',   icon: <Crown className="w-3.5 h-3.5" /> },
}

export function AdminPanel({
  currentUserId,
  notify,
}: {
  currentUserId: string
  notify: (msg: string, type: 'success' | 'error' | 'info') => void
}) {
  const [profiles, setProfiles] = useState<UserProfile[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [wsKey, setWsKey] = useState('')
  const [wsKeyVisible, setWsKeyVisible] = useState(false)
  const [savingKey, setSavingKey] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getAllUserProfiles()
      // Sort: admins first, then teachers, then students; within role sort by updatedAt desc
      const order: IgcseRole[] = ['admin', 'teacher', 'student']
      list.sort((a, b) => {
        const ri = order.indexOf(a.role_igcsetools) - order.indexOf(b.role_igcsetools)
        if (ri !== 0) return ri
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
      })
      setProfiles(list)
    } catch {
      notify('Failed to load users. Make sure you have admin privileges.', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    load()
    getWorkspaceConfig().then(cfg => { if (cfg.geminiKey) setWsKey(cfg.geminiKey) }).catch(console.error)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveKey = useCallback(async () => {
    setSavingKey(true)
    try {
      await saveWorkspaceConfig({ geminiKey: wsKey.trim() })
      notify('Workspace Gemini key saved. Users without their own key will use this.', 'success')
    } catch {
      notify('Failed to save key.', 'error')
    } finally {
      setSavingKey(false)
    }
  }, [wsKey, notify])

  const handleRoleChange = useCallback(async (uid: string, newRole: IgcseRole) => {
    setUpdating(uid)
    try {
      await setUserRoleById(uid, newRole)
      setProfiles(prev => prev?.map(p => p.uid === uid ? { ...p, role_igcsetools: newRole } : p) ?? null)
      notify(`Role updated to ${newRole}.`, 'success')
    } catch {
      notify('Failed to update role.', 'error')
    } finally {
      setUpdating(null)
    }
  }, [notify])

  const counts = profiles ? {
    total: profiles.length,
    students: profiles.filter(p => p.role_igcsetools === 'student').length,
    teachers: profiles.filter(p => p.role_igcsetools === 'teacher').length,
    admins: profiles.filter(p => p.role_igcsetools === 'admin').length,
  } : null

  return (
    <div className="flex-1 overflow-y-auto min-h-0 w-full bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="px-4 sm:px-6 lg:px-10 py-8 space-y-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" /> Admin Panel
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage user roles across IGCSE Tools.</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Workspace API Key */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-amber-500" /> Workspace Gemini API Key
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Users who haven't set their own Gemini key will automatically use this key.
            Leave blank to require everyone to provide their own key.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={wsKeyVisible ? 'text' : 'password'}
                value={wsKey}
                onChange={e => setWsKey(e.target.value)}
                placeholder="AIza…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 pr-9"
              />
              <button
                onClick={() => setWsKeyVisible(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {wsKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleSaveKey}
              disabled={savingKey}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-60"
            >
              {savingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </section>

        {/* Stats */}
        {counts && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Users', value: counts.total, color: 'bg-slate-100 text-slate-700' },
              { label: 'Students',    value: counts.students, color: 'bg-emerald-100 text-emerald-700' },
              { label: 'Teachers',    value: counts.teachers, color: 'bg-indigo-100 text-indigo-700' },
              { label: 'Admins',      value: counts.admins,   color: 'bg-amber-100 text-amber-700' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-4 ${s.color} flex flex-col gap-1`}>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-xs font-semibold opacity-70">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* User list */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading users…
            </div>
          ) : profiles && profiles.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">XP / Level</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Change Role</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => {
                  const cfg = ROLE_CONFIG[p.role_igcsetools]
                  const isSelf = p.uid === currentUserId
                  const isUpdating = updating === p.uid
                  return (
                    <tr key={p.uid} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-700 truncate max-w-[160px]">
                          {(p as any).displayName || p.uid.slice(0, 8) + '…'}
                          {isSelf && <span className="ml-1 text-[10px] text-slate-400">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-400 truncate max-w-[160px]">{(p as any).email || p.uid}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${cfg.badge}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <p className="text-xs text-slate-600">{(p.xp ?? 0).toLocaleString()} XP · Lv {p.level ?? 1}</p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isUpdating ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                        ) : (
                          <select
                            value={p.role_igcsetools}
                            onChange={e => handleRoleChange(p.uid, e.target.value as IgcseRole)}
                            disabled={isSelf}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isSelf ? 'Cannot change your own role here' : 'Change role'}
                          >
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-16">
              <Shield className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No users found.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
