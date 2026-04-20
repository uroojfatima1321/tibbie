import { useEffect, useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import type { Project } from '../../types'
import { useApp } from '../../store/context'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/Confirm'
import { PROJECT_PALETTE, nextProjectColor } from '../../lib/util'

interface Props {
  projectId: string | null
  creating: boolean
  onClose: () => void
}

export function ProjectForm({ projectId, creating, onClose }: Props) {
  const { data, addProject, updateProject, deleteProject, editMode } = useApp()
  const existing = !creating && projectId ? data?.projects.find(p => p.id === projectId) || null : null

  const [form, setForm] = useState(() => buildInitial(existing, data?.projects.map(p => p.color) || []))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(buildInitial(existing, data?.projects.map(p => p.color) || []))
  }, [projectId, creating, existing, data?.projects])

  const open = creating || !!existing

  async function save() {
    if (!form.name || !form.startDate || !form.endDate) return
    setSaving(true)
    try {
      if (existing) {
        await updateProject(existing.id, {
          name: form.name, description: form.description,
          startDate: form.startDate, endDate: form.endDate,
          color: form.color,
        })
      } else {
        await addProject({
          name: form.name, description: form.description,
          startDate: form.startDate, endDate: form.endDate,
          color: form.color,
        })
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit project' : 'New project'}>
      <div className="p-5 space-y-4">
        <Field label="Name">
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus={creating} placeholder="Project name" />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-[80px] resize-y" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this project about?" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" className="input" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </Field>
          <Field label="End date">
            <input type="date" className="input" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </Field>
        </div>
        <Field label="Colour">
          <div className="flex flex-wrap gap-2">
            {PROJECT_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-8 h-8 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-ink-900 scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
                aria-label={`Colour ${c}`}
              />
            ))}
          </div>
        </Field>
      </div>

      {editMode && (
        <div className="border-t border-cream-300 bg-cream-50 px-5 py-3 flex items-center gap-2">
          {existing && (
            <button onClick={() => setConfirmDelete(true)} className="btn-ghost !text-brick-500">
              <Trash2 size={16} /> Delete
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving || !form.name} className="btn-primary">
            <Save size={16} /> {existing ? 'Save' : 'Create'}
          </button>
        </div>
      )}

      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => { await deleteProject(existing.id); onClose() }}
          title="Delete project?"
          message={`"${existing.name}" and all its tasks will be removed. This cannot be undone.`}
          confirmLabel="Delete project"
          danger
        />
      )}
    </Modal>
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

function buildInitial(p: Project | null, usedColors: string[]) {
  if (p) return {
    name: p.name, description: p.description,
    startDate: p.startDate, endDate: p.endDate,
    color: p.color,
  }
  const today = new Date().toISOString().slice(0, 10)
  const end = new Date(); end.setMonth(end.getMonth() + 1)
  return {
    name: '', description: '',
    startDate: today, endDate: end.toISOString().slice(0, 10),
    color: nextProjectColor(usedColors),
  }
}
