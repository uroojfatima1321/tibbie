import { useEffect, useState } from 'react'
import { Trash2, Save, AlertTriangle, Flag, Calendar, Link2, Repeat, X } from 'lucide-react'
import type { Task, TaskStatus } from '../../types'
import { useApp } from '../../store/context'
import { ModalDialog } from '../ui/ModalDialog'
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
  const { data, editMode, addTask, updateTask, deleteTask, addDependency, removeDependency, projectsV2 } = useApp()
  const existing = !creating && taskId ? data?.tasks.find(t => t.id === taskId) || null : null
  const activeProjects = (projectsV2 || []).filter(p => !p.archived)

  const [form, setForm] = useState(() => buildInitial(existing, defaultProjectId, activeProjects[0]?.id))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(buildInitial(existing, defaultProjectId, activeProjects[0]?.id))
  }, [taskId, creating])

  if (!data) return null

  const open = creating || !!existing
  const readOnly = !editMode && !creating

  const deps = existing
    ? data.dependencies.filter(d => d.successorId === existing.id || d.predecessorId === existing.id)
    : []

  // Detect dirty: form differs from existing
  const isDirty = existing ? (
    form.name !== existing.name || form.notes !== existing.notes ||
    form.status !== existing.status || form.percentComplete !== existing.percentComplete
  ) : form.name.trim().length > 0

  function handleClose() {
    if ((editMode || creating) && isDirty) { setDiscardConfirm(true); return }
    onClose()
  }

  async function save() {
    if (!form.projectId || !form.name || !form.startDate || !form.endDate) return
    setSaving(true)
    try {
      if (existing) {
        await updateTask(existing.id, {
          name: form.name, notes: form.notes, projectId: form.projectId,
          startDate: form.startDate, endDate: form.endDate,
          status: form.status,
          percentComplete: form.status === 'done' ? 100 : form.percentComplete,
          isMilestone: form.isMilestone, assigneeIds: form.assigneeIds, recurring: form.recurring,
        })
      } else {
        await addTask({
          projectId: form.projectId, name: form.name, notes: form.notes,
          startDate: form.startDate, endDate: form.endDate,
          status: form.status,
          percentComplete: form.status === 'done' ? 100 : form.percentComplete,
          isMilestone: form.isMilestone, assigneeIds: form.assigneeIds, recurring: form.recurring,
        })
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <>
      <ModalDialog open={open} onClose={handleClose} maxWidth="lg">
        {/* HEADER */}
        <div className="shrink-0 px-6 py-4 border-b border-surface-200 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg text-ink-900 truncate">{creating ? 'New task' : existing?.name || 'Task'}</h2>
            {existing && !creating && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={existing.status} />
                {isOverdue(existing.endDate, existing.status) && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-brick-500"><AlertTriangle size={12} /> Overdue</span>
                )}
                {isDueSoon(existing.endDate, existing.status) && !isOverdue(existing.endDate, existing.status) && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><Flag size={12} /> Due soon</span>
                )}
                <span className="flex items-center gap-1 text-xs text-ink-400"><Calendar size={11} />{fmtLong(existing.startDate)} → {fmtLong(existing.endDate)}</span>
              </div>
            )}
            {existing && <PercentBar percent={existing.percentComplete} />}
          </div>
          <button onClick={handleClose} className="shrink-0 btn-ghost !p-1.5" aria-label="Close"><X size={18} /></button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-4">
          <Field label="Name">
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={readOnly} placeholder="Task name" autoFocus={creating} />
          </Field>
          <Field label="Project">
            <select className="input" value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} disabled={readOnly}>
              {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date"><input type="date" className="input" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} disabled={readOnly} /></Field>
            <Field label="End date"><input type="date" className="input" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} disabled={readOnly} /></Field>
          </div>
          <Field label="Status">
            <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))} disabled={readOnly}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Assignees">
            <div className="flex flex-wrap gap-2">
              {data.members.map(m => {
                const on = form.assigneeIds.includes(m.id)
                return (
                  <button key={m.id} type="button" disabled={readOnly}
                    onClick={() => setForm(f => ({ ...f, assigneeIds: on ? f.assigneeIds.filter(a => a !== m.id) : [...f.assigneeIds, m.id] }))}
                    className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs transition-colors ${on ? 'border-rust-500 bg-rust-500/10 text-rust-700' : 'border-surface-200 text-ink-600 hover:bg-surface-50'} disabled:opacity-60`}>
                    <Avatar member={m} size="xs" />{m.name}
                  </button>
                )
              })}
              {data.members.length === 0 && <p className="text-sm text-ink-400">No members yet</p>}
            </div>
          </Field>
          <Field label="Notes">
            <textarea className="input min-h-[72px] resize-y" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} disabled={readOnly} placeholder="Context, blockers, links…" />
          </Field>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={readOnly} checked={form.isMilestone} onChange={e => setForm(f => ({ ...f, isMilestone: e.target.checked }))} className="rounded border-surface-200 text-rust-500 focus:ring-rust-400" />
              <Flag size={14} /> Milestone
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={readOnly} checked={!!form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked ? { interval: 'weekly' } : null }))} className="rounded border-surface-200 text-rust-500 focus:ring-rust-400" />
              <Repeat size={14} /> Recurring
            </label>
          </div>
          {form.recurring && (
            <Field label="Repeat every">
              <select className="input" value={form.recurring.interval} onChange={e => setForm(f => ({ ...f, recurring: { ...f.recurring!, interval: e.target.value as any } }))} disabled={readOnly}>
                <option value="daily">Day</option><option value="weekly">Week</option><option value="monthly">Month</option>
              </select>
            </Field>
          )}
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
                    <div key={`${d.predecessorId}-${d.successorId}`} className="flex items-center justify-between p-2 rounded-lg bg-surface-50 text-sm">
                      <span className="flex items-center gap-2">
                        <Link2 size={12} className="text-ink-400" />
                        <span className="text-xs text-ink-500">{isBlocking ? 'blocks' : 'blocked by'}</span>
                        <span className="truncate">{otherTask.name}</span>
                      </span>
                      {editMode && <button onClick={() => removeDependency(d.predecessorId, d.successorId)} className="p-1 rounded hover:bg-surface-200"><Trash2 size={12} /></button>}
                    </div>
                  )
                })}
                {editMode && (
                  <select className="input text-xs" value="" onChange={e => { if (e.target.value) addDependency(e.target.value, existing.id) }}>
                    <option value="">+ Add task that must finish first…</option>
                    {data.tasks.filter(t => t.id !== existing.id && !deps.some(d => d.predecessorId === t.id && d.successorId === existing.id))
                      .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
            </Field>
          )}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 px-6 py-3 border-t border-surface-200 bg-white flex justify-between items-center">
          <div>
            {editMode && existing && (
              <button onClick={() => setConfirmDelete(true)} className="btn-ghost text-sm text-brick-500 flex items-center gap-1.5">
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose} className="btn-ghost text-sm">Cancel</button>
            {(editMode || creating) && (
              <button onClick={save} disabled={saving || !form.name || !form.projectId} className="btn-primary text-sm !py-1.5">
                <Save size={14} /> {existing ? 'Save' : 'Create task'}
              </button>
            )}
          </div>
        </div>
      </ModalDialog>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { if (existing) { await deleteTask(existing.id); onClose() } }}
        title="Delete task?" message={`"${existing?.name}" will be removed. This cannot be undone.`}
        confirmLabel="Delete" danger />

      <ConfirmDialog open={discardConfirm} onClose={() => setDiscardConfirm(false)}
        onConfirm={() => { setDiscardConfirm(false); onClose() }}
        title="Discard changes?" message="You have unsaved edits. Discard them and close?"
        confirmLabel="Discard" danger />
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">{label}</label>
      {children}
    </div>
  )
}

function buildInitial(existing: Task | null, defaultProjectId?: string, firstProjectId?: string) {
  if (existing) return {
    name: existing.name, notes: existing.notes,
    projectId: existing.projectId, startDate: existing.startDate, endDate: existing.endDate,
    status: existing.status, percentComplete: existing.percentComplete,
    isMilestone: existing.isMilestone, assigneeIds: existing.assigneeIds, recurring: existing.recurring,
  }
  const todayStr = new Date().toISOString().slice(0, 10)
  const end = new Date(); end.setDate(end.getDate() + 7)
  return {
    name: '', notes: '', projectId: defaultProjectId || firstProjectId || '',
    startDate: todayStr, endDate: end.toISOString().slice(0, 10),
    status: 'not_started' as TaskStatus, percentComplete: 0,
    isMilestone: false, assigneeIds: [] as string[], recurring: null as Task['recurring'],
  }
}
