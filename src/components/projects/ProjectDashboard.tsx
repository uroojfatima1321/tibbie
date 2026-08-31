import { useMemo, useState, useRef } from 'react'
import { ArrowLeft, Plus, Trash2, Save, X, Flag, AlertTriangle, Clock, Users as UsersIcon, CheckCircle2, Activity, Sparkles, Check } from 'lucide-react'
import { parseISO, format, differenceInCalendarDays } from 'date-fns'
import type { Task, UpdateSignal } from '../../types'
import { useApp } from '../../store/context'
import { Avatar, AvatarStack } from '../members/Avatar'
import { StatusBadge, PercentBar } from '../ui/Badge'
import { ConfirmDialog } from '../ui/Confirm'
import { fmtLong, isOverdue, isDueSoon, today } from '../../lib/dates'
import { ProjectPhasesSection } from './ProjectPhasesSection'

interface Props {
  projectId: string
  onClose: () => void
  onTaskClick: (taskId: string) => void
  onEditProject: (projectId: string) => void
  onOpenPhaseLibrary: () => void
}

const SIGNAL_LABELS: Record<UpdateSignal, string> = {
  green: 'On track',
  yellow: 'Attention',
  red: 'At risk',
  neutral: 'Note',
}

const SIGNAL_TONES: Record<UpdateSignal, { dot: string; bg: string; text: string }> = {
  green:   { dot: '#2F5743', bg: 'bg-forest-50',   text: 'text-forest-600' },
  yellow:  { dot: '#C8932F', bg: 'bg-amber-500/10', text: 'text-amber-600' },
  red:     { dot: '#A83D2F', bg: 'bg-brick-500/10', text: 'text-brick-500' },
  neutral: { dot: '#8B8680', bg: 'bg-surface-100',    text: 'text-ink-600'  },
}

export function ProjectDashboard({ projectId, onClose, onTaskClick, onEditProject, onOpenPhaseLibrary }: Props) {
  const { data, editMode, addUpdate, deleteUpdate, updateProject } = useApp()
  const [newUpdateOpen, setNewUpdateOpen] = useState(false)
  const [confirmDeleteUpdate, setConfirmDeleteUpdate] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const project = data?.projects.find(p => p.id === projectId)
  const projectTasks = useMemo(
    () => data?.tasks.filter(t => t.projectId === projectId) || [],
    [data, projectId],
  )
  const projectUpdates = useMemo(
    () => (data?.updates || [])
      .filter(u => u.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data, projectId],
  )

  const stats = useMemo(() => {
    if (projectTasks.length === 0) {
      return { total: 0, done: 0, inProgress: 0, atRisk: 0, notStarted: 0, milestones: 0, overdue: 0, avgPercent: 0 }
    }
    let done = 0, inProgress = 0, atRisk = 0, notStarted = 0, milestones = 0, overdue = 0, percentSum = 0
    for (const t of projectTasks) {
      if (t.status === 'done') done++
      else if (t.status === 'in_progress') inProgress++
      else if (t.status === 'at_risk') atRisk++
      else notStarted++
      if (t.isMilestone) milestones++
      if (isOverdue(t.endDate, t.status)) overdue++
      percentSum += t.percentComplete
    }
    return {
      total: projectTasks.length, done, inProgress, atRisk, notStarted, milestones, overdue,
      avgPercent: Math.round(percentSum / projectTasks.length),
    }
  }, [projectTasks])

  const daysRemaining = useMemo(() => {
    if (!project) return 0
    return differenceInCalendarDays(parseISO(project.endDate), parseISO(today()))
  }, [project])

  const teamMembers = useMemo(() => {
    if (!data || !project) return []
    const ids = new Set<string>()
    for (const t of projectTasks) for (const a of t.assigneeIds) ids.add(a)
    return data.members.filter(m => ids.has(m.id))
  }, [data, project, projectTasks])

  const upcomingMilestones = useMemo(() => {
    return projectTasks
      .filter(t => t.isMilestone && t.status !== 'done')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 5)
  }, [projectTasks])

  const overdueTasks = useMemo(() => {
    return projectTasks.filter(t => isOverdue(t.endDate, t.status)).sort((a, b) => a.endDate.localeCompare(b.endDate))
  }, [projectTasks])

  const dueSoonTasks = useMemo(() => {
    return projectTasks
      .filter(t => isDueSoon(t.endDate, t.status) && !isOverdue(t.endDate, t.status))
      .sort((a, b) => a.endDate.localeCompare(b.endDate))
  }, [projectTasks])

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center">
        <p className="text-sm text-ink-500">Project not found.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="border-b border-surface-200 bg-white">
        <div className="px-4 sm:px-6 py-4 flex items-start gap-3">
          <button onClick={onClose} className="btn-ghost !p-2 mt-1 shrink-0" aria-label="Back">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="w-2 h-6 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
              {editMode && editingName ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    ref={nameInputRef}
                    className="font-display text-2xl font-semibold text-ink-900 bg-transparent border-b-2 border-rust-400 outline-none flex-1 min-w-0"
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (nameValue.trim()) updateProject(project.id, { name: nameValue.trim() })
                        setEditingName(false)
                      }
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                    onBlur={() => {
                      if (nameValue.trim()) updateProject(project.id, { name: nameValue.trim() })
                      setEditingName(false)
                    }}
                    autoFocus
                  />
                  <button onClick={() => { if (nameValue.trim()) updateProject(project.id, { name: nameValue.trim() }); setEditingName(false) }} className="btn-ghost !p-1">
                    <Check size={14} className="text-forest-500" />
                  </button>
                </div>
              ) : (
                <h1
                  className={`font-display text-2xl font-semibold text-ink-900 truncate ${editMode ? 'cursor-text hover:text-rust-600 transition-colors' : ''}`}
                  onClick={() => { if (editMode) { setNameValue(project.name); setEditingName(true) } }}
                  title={editMode ? 'Click to rename' : undefined}
                >
                  {project.name}
                </h1>
              )}
            </div>
            {project.description && <p className="text-sm text-ink-600 max-w-2xl">{project.description}</p>}
            <p className="text-xs text-ink-400 mt-2 font-mono">
              {fmtLong(project.startDate)} → {fmtLong(project.endDate)}
            </p>
          </div>
          {editMode && (
            <button onClick={() => onEditProject(project.id)} className="btn-outline shrink-0">
              Edit project
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto tibbie-scroll">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
          {/* PHASES — first, since this is the PM's primary question */}
          <ProjectPhasesSection projectId={projectId} onOpenLibrary={onOpenPhaseLibrary} />

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Activity size={16} />}
              label="Completion"
              value={`${stats.avgPercent}%`}
              tone="forest"
              extra={<PercentBar percent={stats.avgPercent} />}
            />
            <StatCard
              icon={<Clock size={16} />}
              label={daysRemaining < 0 ? 'Days overdue' : 'Days remaining'}
              value={Math.abs(daysRemaining).toString()}
              tone={daysRemaining < 0 ? 'brick' : daysRemaining < 14 ? 'amber' : 'steel'}
            />
            <StatCard
              icon={<CheckCircle2 size={16} />}
              label="Tasks done"
              value={`${stats.done} / ${stats.total}`}
              tone="forest"
            />
            <StatCard
              icon={<UsersIcon size={16} />}
              label="On this project"
              value={teamMembers.length.toString()}
              tone="steel"
              extra={teamMembers.length > 0 ? <AvatarStack members={teamMembers} size="xs" max={4} /> : null}
            />
          </div>

          {/* Risks row */}
          {(stats.overdue > 0 || dueSoonTasks.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stats.overdue > 0 && (
                <div className="p-4 rounded-xl bg-brick-500/10 border border-brick-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-brick-500" />
                    <h3 className="font-semibold text-sm text-brick-500">
                      {stats.overdue} overdue {stats.overdue === 1 ? 'task' : 'tasks'}
                    </h3>
                  </div>
                  <ul className="space-y-1">
                    {overdueTasks.slice(0, 4).map(t => (
                      <li key={t.id}>
                        <button onClick={() => onTaskClick(t.id)} className="text-xs text-ink-700 hover:text-ink-900 hover:underline text-left">
                          {t.name} <span className="text-ink-400">· due {fmtLong(t.endDate)}</span>
                        </button>
                      </li>
                    ))}
                    {overdueTasks.length > 4 && (
                      <li className="text-xs text-ink-400 pt-1">+{overdueTasks.length - 4} more</li>
                    )}
                  </ul>
                </div>
              )}
              {dueSoonTasks.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
                  <div className="flex items-center gap-2 mb-2">
                    <Flag size={16} className="text-amber-600" />
                    <h3 className="font-semibold text-sm text-amber-600">
                      {dueSoonTasks.length} due this week
                    </h3>
                  </div>
                  <ul className="space-y-1">
                    {dueSoonTasks.slice(0, 4).map(t => (
                      <li key={t.id}>
                        <button onClick={() => onTaskClick(t.id)} className="text-xs text-ink-700 hover:text-ink-900 hover:underline text-left">
                          {t.name} <span className="text-ink-400">· {fmtLong(t.endDate)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Two-column area: Updates feed + Milestones */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink-900">Status updates</h2>
                {editMode && !newUpdateOpen && (
                  <button onClick={() => setNewUpdateOpen(true)} className="btn-ghost text-xs">
                    <Plus size={14} /> Post update
                  </button>
                )}
              </div>

              {newUpdateOpen && (
                <UpdateEditor
                  onSave={async input => {
                    await addUpdate({ projectId, ...input })
                    setNewUpdateOpen(false)
                  }}
                  onCancel={() => setNewUpdateOpen(false)}
                />
              )}

              {projectUpdates.length === 0 && !newUpdateOpen && (
                <div className="p-6 rounded-xl border border-dashed border-surface-200 text-center">
                  <p className="text-sm text-ink-500">No status updates yet.</p>
                  <p className="text-xs text-ink-400 mt-1">Post weekly to keep stakeholders looped in. Phase changes also auto-post here.</p>
                </div>
              )}

              {projectUpdates.map(u => (
                <article key={u.id} className={`p-4 rounded-xl ${SIGNAL_TONES[u.signal].bg} group ${u.autoGenerated ? 'opacity-80' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: SIGNAL_TONES[u.signal].dot }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className={`text-xs font-semibold ${SIGNAL_TONES[u.signal].text} flex items-center gap-1.5`}>
                          {SIGNAL_LABELS[u.signal]}
                          {u.autoGenerated && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-ink-400 font-normal uppercase tracking-wider">
                              <Sparkles size={9} /> auto
                            </span>
                          )}
                        </span>
                        <time className="text-[11px] text-ink-400 shrink-0 font-mono">
                          {format(parseISO(u.createdAt), 'd MMM yyyy · HH:mm')}
                        </time>
                      </div>
                      <p className="text-sm text-ink-900 whitespace-pre-wrap">{u.text}</p>
                    </div>
                    {editMode && !u.autoGenerated && (
                      <button
                        onClick={() => setConfirmDeleteUpdate(u.id)}
                        className="btn-ghost !p-1 !text-brick-500 opacity-0 group-hover:opacity-100 shrink-0"
                        aria-label="Delete update"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>

            <aside className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-ink-900">Upcoming milestones</h2>
              {upcomingMilestones.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-surface-200 text-center">
                  <p className="text-xs text-ink-400">No upcoming milestones.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {upcomingMilestones.map(t => {
                    const overdue = isOverdue(t.endDate, t.status)
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => onTaskClick(t.id)}
                          className="w-full text-left p-3 rounded-lg bg-white border border-surface-200 hover:border-rust-400 transition-colors flex items-start gap-2"
                        >
                          <Flag size={14} className={overdue ? 'text-brick-500' : 'text-ink-400'} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-ink-900 truncate">{t.name}</div>
                            <div className="text-xs text-ink-500 mt-0.5">{fmtLong(t.startDate)}</div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              <h3 className="font-display text-sm font-semibold text-ink-900 pt-4">Task breakdown</h3>
              <div className="space-y-1.5 text-xs">
                <BreakdownRow label="Done" count={stats.done} total={stats.total} color="#2F5743" />
                <BreakdownRow label="In progress" count={stats.inProgress} total={stats.total} color="#3A6B8A" />
                <BreakdownRow label="At risk" count={stats.atRisk} total={stats.total} color="#C8932F" />
                <BreakdownRow label="Not started" count={stats.notStarted} total={stats.total} color="#A8A29A" />
              </div>
            </aside>
          </div>

          <section className="space-y-2">
            <h2 className="font-display text-lg font-semibold text-ink-900">All tasks</h2>
            <div className="rounded-xl border border-surface-200 overflow-hidden bg-white">
              {projectTasks.length === 0 ? (
                <p className="text-sm text-ink-500 text-center py-6">No tasks in this project.</p>
              ) : (
                <ul>
                  {projectTasks
                    .sort((a, b) => a.startDate.localeCompare(b.startDate))
                    .map(t => <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t.id)} />)}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteUpdate}
        onClose={() => setConfirmDeleteUpdate(null)}
        onConfirm={async () => { if (confirmDeleteUpdate) await deleteUpdate(confirmDeleteUpdate) }}
        title="Delete update?"
        message="This status update will be removed permanently."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}

function StatCard({ icon, label, value, tone, extra }: {
  icon: React.ReactNode; label: string; value: string
  tone: 'forest' | 'brick' | 'amber' | 'steel'
  extra?: React.ReactNode
}) {
  const toneClasses = {
    forest: 'text-forest-600',
    brick:  'text-brick-500',
    amber:  'text-amber-600',
    steel:  'text-steel-600',
  }[tone]
  return (
    <div className="p-4 rounded-xl bg-white border border-surface-200">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${toneClasses} mb-2`}>
        {icon}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-display text-2xl font-semibold text-ink-900">{value}</div>
      {extra && <div className="mt-2">{extra}</div>}
    </div>
  )
}

function BreakdownRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : (count / total) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-ink-700 flex-1">{label}</span>
      <span className="text-ink-400 font-mono tabular-nums">{count}</span>
      <span className="w-16 h-1 rounded-full bg-surface-200 overflow-hidden">
        <span className="block h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </span>
    </div>
  )
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task.endDate, task.status)
  return (
    <li>
      <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-surface-100 hover:bg-surface-50 text-left">
        {task.isMilestone && <Flag size={12} className="text-ink-400 shrink-0" />}
        <span className="text-sm text-ink-900 truncate flex-1">{task.name}</span>
        <span className="text-[11px] text-ink-400 font-mono shrink-0 hidden sm:inline">
          {format(parseISO(task.startDate), 'd MMM')}
        </span>
        <StatusBadge status={task.status} size="sm" />
        {overdue && <AlertTriangle size={12} className="text-brick-500 shrink-0" />}
      </button>
    </li>
  )
}

function UpdateEditor({ onSave, onCancel }: {
  onSave: (input: { text: string; signal: UpdateSignal; authorMemberId?: string }) => Promise<void>
  onCancel: () => void
}) {
  const { data } = useApp()
  const [text, setText] = useState('')
  const [signal, setSignal] = useState<UpdateSignal>('green')
  const [authorId, setAuthorId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  return (
    <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(SIGNAL_LABELS) as UpdateSignal[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setSignal(s)}
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors
              ${signal === s
                ? `${SIGNAL_TONES[s].bg} ${SIGNAL_TONES[s].text} border-current`
                : 'border-surface-200 text-ink-500 hover:bg-white'}
            `}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SIGNAL_TONES[s].dot }} />
            {SIGNAL_LABELS[s]}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        className="input min-h-[96px] resize-y"
        placeholder="What changed? What's blocked? What's next?"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <div className="flex items-center gap-2 flex-wrap">
        {(data?.members.length || 0) > 0 && (
          <select className="input !py-1.5 text-sm flex-1 max-w-[200px]" value={authorId} onChange={e => setAuthorId(e.target.value)}>
            <option value="">Posted by… (optional)</option>
            {data?.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <div className="flex-1" />
        <button onClick={onCancel} className="btn-ghost"><X size={14} /> Cancel</button>
        <button
          onClick={async () => {
            if (!text.trim()) return
            setSaving(true)
            try { await onSave({ text: text.trim(), signal, authorMemberId: authorId || undefined }) }
            finally { setSaving(false) }
          }}
          disabled={!text.trim() || saving}
          className="btn-primary"
        >
          <Save size={14} /> Post
        </button>
      </div>
    </div>
  )
}
