import { useState } from 'react'
import { Plus, Trash2, Save, X, Sparkles, GripVertical } from 'lucide-react'
import type { PhaseTemplate } from '../../types'
import { useApp } from '../../store/context'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/Confirm'
import { buildPhasePresets } from '../../lib/phasePresets'

const PHASE_COLORS = [
  '#7B4A6E', '#3A6B8A', '#2F5743', '#C65D3B', '#D88752',
  '#4A6E8B', '#C8932F', '#A8763D', '#5A7A4A', '#8B8680',
]

export function PhaseLibraryPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, editMode, addPhaseTemplate, updatePhaseTemplate, deletePhaseTemplate, loadPhasePresets } = useApp()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmPreset, setConfirmPreset] = useState(false)

  const templates = data?.phaseTemplates || []

  return (
    <Modal open={open} onClose={onClose} title="Phase library" size="md">
      <div className="p-5 space-y-4">
        <p className="text-sm text-ink-600">
          Phases describe how work moves through stages — discovery, design, build, QA, release.
          Define them once here, then pick which ones apply to each project. Editing a phase's name updates it everywhere.
        </p>

        {editMode && (
          <button onClick={() => setConfirmPreset(true)} className="btn-outline w-full">
            <Sparkles size={14} />
            Load default phase library
          </button>
        )}

        <div className="space-y-2">
          {templates.length === 0 && !creating && (
            <p className="text-sm text-ink-400 text-center py-6">
              No phases defined. {editMode ? 'Add one below or load the defaults.' : 'Unlock edit mode to add phases.'}
            </p>
          )}

          {templates.map(t => (
            <div key={t.id}>
              {editing === t.id ? (
                <PhaseTemplateEditor
                  template={t}
                  onSave={async patch => { await updatePhaseTemplate(t.id, patch); setEditing(null) }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-50 group">
                  <span className="w-2 h-7 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">{t.name}</div>
                    {t.description && <div className="text-xs text-ink-500 truncate">{t.description}</div>}
                  </div>
                  {editMode && (
                    <>
                      <button
                        onClick={() => setEditing(t.id)}
                        className="text-xs text-ink-500 hover:text-rust-500 px-2 py-1 rounded opacity-0 group-hover:opacity-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(t.id)}
                        className="btn-ghost !p-1.5 !text-brick-500 opacity-0 group-hover:opacity-100"
                        aria-label="Delete phase template"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {creating ? (
            <PhaseTemplateEditor
              onSave={async input => { await addPhaseTemplate(input); setCreating(false) }}
              onCancel={() => setCreating(false)}
            />
          ) : editMode && (
            <button onClick={() => setCreating(true)} className="btn-outline w-full">
              <Plus size={16} /> Add phase to library
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) await deletePhaseTemplate(confirmDelete) }}
        title="Remove phase from library?"
        message="Projects currently using this phase will lose it. Their other phases and tasks are not affected."
        confirmLabel="Remove"
        danger
      />

      <ConfirmDialog
        open={confirmPreset}
        onClose={() => setConfirmPreset(false)}
        onConfirm={async () => { await loadPhasePresets(buildPhasePresets()) }}
        title="Load default phases?"
        message="Adds 10 common phases: Discovery, Requirements, Architecture, UX Design, UI Design, Build, QA, UAT, Release, Post-Launch. Existing phases with matching names are skipped."
        confirmLabel="Load defaults"
      />
    </Modal>
  )
}

interface EditorProps {
  template?: PhaseTemplate
  onSave: (input: { name: string; description?: string; color?: string }) => Promise<void>
  onCancel: () => void
}

function PhaseTemplateEditor({ template, onSave, onCancel }: EditorProps) {
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [color, setColor] = useState(template?.color || PHASE_COLORS[0])
  const [saving, setSaving] = useState(false)

  return (
    <div className="p-3 rounded-lg bg-surface-50 space-y-2.5">
      <input
        autoFocus
        className="input"
        placeholder="Phase name (e.g. Architecture Finalizing)"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        className="input"
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-ink-500 mr-1">Color:</span>
        {PHASE_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-ink-900 ring-offset-1 ring-offset-white scale-110' : 'hover:scale-105'}`}
            style={{ backgroundColor: c }}
            aria-label={`Pick color ${c}`}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost"><X size={14} /></button>
        <button
          onClick={async () => {
            if (!name.trim()) return
            setSaving(true)
            try { await onSave({ name: name.trim(), description: description.trim() || undefined, color }) }
            finally { setSaving(false) }
          }}
          disabled={!name.trim() || saving}
          className="btn-primary"
        >
          <Save size={14} /> Save
        </button>
      </div>
    </div>
  )
}
