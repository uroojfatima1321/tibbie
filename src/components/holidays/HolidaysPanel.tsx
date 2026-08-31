import { useState, useMemo } from 'react'
import { Plus, Trash2, Save, X, Calendar, Sparkles, Repeat } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { Holiday } from '../../types'
import { useApp } from '../../store/context'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/Confirm'
import { pakistanHolidayPreset2026 } from '../../lib/holidays'

export function HolidaysPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, editMode, addHoliday, updateHoliday, deleteHoliday, loadHolidayPreset } = useApp()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmPreset, setConfirmPreset] = useState(false)

  const holidaysSorted = useMemo(() => {
    return [...(data?.holidays || [])].sort((a, b) => {
      // Sort by month-day so yearly entries group naturally
      const aKey = a.date.slice(5)
      const bKey = b.date.slice(5)
      if (aKey !== bKey) return aKey.localeCompare(bKey)
      return a.date.localeCompare(b.date)
    })
  }, [data?.holidays])

  return (
    <Modal open={open} onClose={onClose} title="Holidays & non-working days" size="md">
      <div className="p-5 space-y-4">
        <p className="text-sm text-ink-600">
          Mark holidays so they're shaded on the timeline and tasks spanning them get flagged.
          Yearly-recurring holidays repeat on the same date every year. Lunar holidays (Eid, Muharram) shift each year — store them as one-off entries and update annually.
        </p>

        {/* Preset loader */}
        {editMode && (
          <button
            onClick={() => setConfirmPreset(true)}
            className="btn-outline w-full"
          >
            <Sparkles size={14} />
            Load Pakistan holidays preset (2026)
          </button>
        )}

        {/* Holiday list */}
        <div className="space-y-2">
          {holidaysSorted.length === 0 && !creating && (
            <p className="text-sm text-ink-400 text-center py-6">
              No holidays set. {editMode ? 'Add one below or load the preset.' : 'Unlock edit mode to add holidays.'}
            </p>
          )}

          {holidaysSorted.map(h => (
            <div key={h.id}>
              {editing === h.id ? (
                <HolidayEditor
                  holiday={h}
                  onSave={async patch => { await updateHoliday(h.id, patch); setEditing(null) }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-50 group">
                  <Calendar size={14} className="text-ink-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">{h.name}</div>
                    <div className="text-xs text-ink-500 flex items-center gap-2">
                      {h.recurring === 'yearly'
                        ? <span className="inline-flex items-center gap-1"><Repeat size={10} /> {format(parseISO(h.date), 'd MMM')} yearly</span>
                        : format(parseISO(h.date), 'd MMM yyyy')}
                    </div>
                  </div>
                  {editMode && (
                    <>
                      <button
                        onClick={() => setEditing(h.id)}
                        className="text-xs text-ink-500 hover:text-rust-500 px-2 py-1 rounded opacity-0 group-hover:opacity-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(h.id)}
                        className="btn-ghost !p-1.5 !text-brick-500 opacity-0 group-hover:opacity-100"
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
            <HolidayEditor
              onSave={async input => { await addHoliday(input); setCreating(false) }}
              onCancel={() => setCreating(false)}
            />
          ) : editMode && (
            <button onClick={() => setCreating(true)} className="btn-outline w-full">
              <Plus size={16} /> Add holiday
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) await deleteHoliday(confirmDelete) }}
        title="Remove holiday?"
        message="This won't affect any tasks; only the timeline shading and warnings."
        confirmLabel="Remove"
        danger
      />

      <ConfirmDialog
        open={confirmPreset}
        onClose={() => setConfirmPreset(false)}
        onConfirm={async () => {
          const preset = pakistanHolidayPreset2026()
          await loadHolidayPreset(preset)
        }}
        title="Load Pakistan holidays?"
        message="This adds 2026 Pakistan public holidays. Existing holidays you've added are kept; duplicates are skipped. Lunar holiday dates are estimates — verify against official notifications."
        confirmLabel="Load preset"
      />
    </Modal>
  )
}

interface EditorProps {
  holiday?: Holiday
  onSave: (input: { date: string; name: string; recurring?: 'yearly' | null }) => Promise<void>
  onCancel: () => void
}

function HolidayEditor({ holiday, onSave, onCancel }: EditorProps) {
  const [date, setDate] = useState(holiday?.date || new Date().toISOString().slice(0, 10))
  const [name, setName] = useState(holiday?.name || '')
  const [recurring, setRecurring] = useState<'yearly' | null>(holiday?.recurring ?? null)
  const [saving, setSaving] = useState(false)

  return (
    <div className="p-3 rounded-lg bg-surface-50 space-y-2.5">
      <input
        autoFocus
        className="input"
        placeholder="Holiday name (e.g. Eid-ul-Fitr)"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          type="date"
          className="input"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-ink-700 px-3 rounded-lg border border-surface-200 bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={recurring === 'yearly'}
            onChange={e => setRecurring(e.target.checked ? 'yearly' : null)}
            className="rounded border-surface-200 text-rust-500 focus:ring-rust-400"
          />
          Yearly
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost"><X size={14} /></button>
        <button
          onClick={async () => {
            if (!name.trim() || !date) return
            setSaving(true)
            try { await onSave({ date, name: name.trim(), recurring }) }
            finally { setSaving(false) }
          }}
          disabled={!name.trim() || !date || saving}
          className="btn-primary"
        >
          <Save size={14} /> Save
        </button>
      </div>
    </div>
  )
}
