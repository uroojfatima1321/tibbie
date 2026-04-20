import { useEffect, useState } from 'react'
import { Trash2, Save, AlertTriangle, Flag, Calendar, Users, Link2, Repeat } from 'lucide-react'
import type { Task, TaskStatus } from '../../types'
import { useApp } from '../../store/context'
import { Sheet } from '../ui/Sheet'
import { ConfirmDialog } from '../ui/Confirm'
import { Avatar } from '../members/Avatar'
import { StatusBadge, PercentBar } from '../ui/Badge'
import { fmtLong, isOverdue, isDueSoon } from '../../lib/dates'

interface Props {
  taskId: string | null
  creating: boolean
  defaultProjectId?: string
  onClose: () => void
}

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'done', label: 'Done' },
]

export function TaskDetailPanel({ taskId, creating, defaultProjectId, onClose }: Props) {
  const { data, editMode, addTask, updateTask, deleteTask, addDependency, removeDependency } = useApp()
  const existing = !creating && taskId ? data?.tasks.find(t => t.id === taskId) || null : null

  const [form, setForm] = useState(() => buildInitial(existing, defaultProjectId, data?.projects[0]?.id))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(buildInitial(existing, defaultProjectId, data?.projects[0]?.id))
  }, [taskId, creating, defaultProjectId, existing, data?.projects])

  if (!data) return null

  const open = creating || !!existing
  const readOnly = !editMode && !creating

  const deps = existing
    ? data.dependencies.filter(d => d.successorId === existing.id || d.predecessorId === existing.id)
    : []

  async function save() {
    if (!form.projectId || !form.name || !form.startDate || !form.endDate) return
    setSaving(true)
    try {
      if (existing) {
        await updateTask(existing.id, {
          name: form.name, notes: form.notes, projectId: form.projectId,
          startDate: form.startDate, endDate: form.endDate,
          status: form.status, percentComplete: form.percentComplete,
          isMilestone: form.isMilestone,
          assigneeIds: form.assigneeIds,
          recurring: form.recurring,
        })
      } else {
        await addTask({
          projectId: form.projectId, name: form.name, notes: form.notes,
          startDate: form.startDate, endDate: form.endDate,
          status: form.status, percentComplete: form.percentComplete,
          isMilestone: form.isMilestone,
          assigneeIds: form.assigneeIds,
          recurring: form.recurring,
        })
      }
      onClose()
    } finally { setSaving(false) }
  }

  const title = creating ? 'New task' : existing?.name || 'Task'

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {existing && !creating && (
        <div className="px-5 py-4 border-b border-cream-300 bg-cream-100/50 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={existing.status} />
            {isOverdue(existing.endDate, existing.status) && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-brick-500">
                <AlertTriangle size={12} /> Overdue
              </span>
            )}
            {isDueSoon(existing.endDate, existing.status) && !isOverdue(existing.endDate, existing.status) && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                <Flag size={12} /> Due soon
              </span>
            )}
            {existing.isMilestone && <span className="chip bg-ink-900 text-cream-50">Milestone</span>}
          </div>
          <PercentBar percent={existing.percentComplete} />
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <Calendar size={12} />
            {fmtLong(existing.startDate)} → {fmtLong(existing.endDate)}
          </div>
        </div>
      )}

      <div className="p-5 space-y-4">
        <Field label="Name">
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={readOnly} placeholder="Task name" autoFocus={creating} />
        </Field>

        <Field label="Project">
          <select className="input" value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} disabled={readOnly}>
            {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" className="input" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} disabled={readOnly} />
          </Field>
          <Field label="End date">
            <input type="date" className="input" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} disabled={readOnly} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))} disabled={readOnly}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="% complete">
            <input
              type="number" min={0} max={100} className="input"
              value={form.percentComplete}
              onChange={e => setForm(f => ({ ...f, percentComplete: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
              disabled={readOnly}
            />
          </Field>
        </div>

        <Field label="Assignees">
          <div className="flex flex-wrap gap-2">
            {data.members.map(m => {
              const on = form.assigneeIds.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setForm(f => ({
                    ...f,
                    assigneeIds: on ? f.assigneeIds.filter(a => a !== m.id) : [...f.assigneeIds, m.id],
                  }))}
                  className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs transition-colors ${
                    on ? 'border-rust-500 bg-rust-500/10 text-rust-700' : 'border-cream-300 text-ink-600 hover:bg-cream-100'
                  } disabled:opacity-60`}
                >
                  <Avatar member={m} size="xs" />
                  {m.name}
                </button>
              )
            })}
            {data.members.length === 0 && <p className="text-sm text-ink-400">No members yet — add some from the members panel</p>}
          </div>
        </Field>

        <Field label="Notes">
          <textarea
            className="input min-h-[80px] resize-y"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            disabled={readOnly}
            placeholder="Context, blockers, links…"
          />
        </Field>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled={readOnly} checked={form.isMilestone} onChange={e => setForm(f => ({ ...f, isMilestone: e.target.checked }))} className="rounded border-cream-300 text-rust-500 focus:ring-rust-400" />
            <Flag size={14} /> Milestone
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox" disabled={readOnly}
              checked={!!form.recurring}
              onChange={e => setForm(f => ({ ...f, recurring: e.target.checked ? { interval: 'weekly' } : null }))}
              className="rounded border-cream-300 text-rust-500 focus:ring-rust-400"
            />
            <Repeat size={14} /> Recurring
          </label>
        </div>

        {form.recurring && (
          <Field label="Repeat every">
            <select
              className="input"
              value={form.recurring.interval}
              onChange={e => setForm(f => ({ ...f, recurring: { ...f.recurring!, interval: e.target.value as any } }))}
              disabled={readOnly}
            >
              <option value="daily">Day</option>
              <option value="weekly">Week</option>
              <option value="monthly">Month</option>
            </select>
          </Field>
        )}

        {/* Dependencies */}
        {existing && (
          <Field label="Dependencies">
            <div className="space-y-2">
              {deps.length === 0 && <p className="text-xs text-ink-400">No dependencies</p>}
              {deps.map(d => {
                const other = d.successorId === existing.id ? d.predecessorId : d.successorId
                const otherTask = data.tasks.find(t => t.id === other)
                if (!otherTask) return null
                const isBlocking = d.predecessorId === existing.id
                return (
                  <div key={`${d.predecessorId}-${d.successorId}`} className="flex items-center justify-between p-2 rounded-lg bg-cream-100 text-sm">
                    <span className="flex items-center gap-2">
                      <Link2 size={12} className="text-ink-400" />
                      <span className="text-xs text-ink-500">{isBlocking ? 'blocks' : 'blocked by'}</span>
                      <span className="truncate">{otherTask.name}</span>
                    </span>
                    {editMode && (
                      <button
                        onClick={() => removeDependency(d.predecessorId, d.successorId)}
                        className="p-1 rounded hover:bg-cream-300"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
              {editMode && (
                <select
                  className="input text-xs"
                  value=""
                  onChange={e => { if (e.target.value) addDependency(e.target.value, existing.id) }}
                >
                  <option value="">+ Add task that must finish first…</option>
                  {data.tasks
                    .filter(t => t.id !== existing.id && !deps.some(d => d.predecessorId === t.id && d.successorId === existing.id))
                    .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
          </Field>
        )}
      </div>

      {editMode && (
        <div className="sticky bottom-0 border-t border-cream-300 bg-cream-50 px-5 py-3 flex items-center gap-2">
          {existing && (
            <button onClick={() => setConfirmDelete(true)} className="btn-ghost !text-brick-500">
              <Trash2 size={16} /> Delete
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving || !form.name || !form.projectId} className="btn-primary">
            <Save size={16} />
            {existing ? 'Save' : 'Create'}
          </button>
        </div>
      )}

      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => { await deleteTask(existing.id); onClose() }}
          title="Delete task?"
          message={`"${existing.name}" will be removed along with any dependencies. This cannot be undone.`}
          confirmLabel="Delete"
          danger
        />
      )}
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function buildInitial(existing: Task | null, defaultProjectId?: string, firstProjectId?: string) {
  if (existing) {
    return {
      name: existing.name, notes: existing.notes, projectId: existing.projectId,
      startDate: existing.startDate, endDate: existing.endDate,
      status: existing.status, percentComplete: existing.percentComplete,
      isMilestone: existing.isMilestone, assigneeIds: existing.assigneeIds,
      recurring: existing.recurring,
    }
  }
  const todayStr = new Date().toISOString().slice(0, 10)
  const end = new Date(); end.setDate(end.getDate() + 7)
  return {
    name: '', notes: '',
    projectId: defaultProjectId || firstProjectId || '',
    startDate: todayStr, endDate: end.toISOString().slice(0, 10),
    status: 'not_started' as TaskStatus, percentComplete: 0,
    isMilestone: false, assigneeIds: [] as string[],
    recurring: null as Task['recurring'],
  }
}
