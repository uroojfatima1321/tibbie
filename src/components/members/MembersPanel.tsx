import { useState } from 'react'
import { Plus, Trash2, Save, Pencil, X } from 'lucide-react'
import type { Member } from '../../types'
import { useApp } from '../../store/context'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/Confirm'
import { Avatar } from './Avatar'
import { MEMBER_PALETTE, nextMemberColor } from '../../lib/util'

export function MembersPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, editMode, addMember, updateMember, deleteMember, setMyTasksMemberId } = useApp()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <Modal open={open} onClose={onClose} title="Team members" size="md">
      <div className="p-5 space-y-3">
        {data?.members.length === 0 && !creating && (
          <p className="text-sm text-ink-500 text-center py-6">
            No members yet. Add teammates to assign tasks to them.
          </p>
        )}

        {data?.members.map(m => (
          <div key={m.id}>
            {editing === m.id ? (
              <MemberEditor
                member={m}
                onSave={async patch => { await updateMember(m.id, patch); setEditing(null) }}
                onCancel={() => setEditing(null)}
                usedColors={data?.members.filter(x => x.id !== m.id).map(x => x.color) || []}
              />
            ) : (
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream-100 group">
                <Avatar member={m} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">{m.name}</div>
                  {m.email && <div className="text-xs text-ink-500 truncate">{m.email}</div>}
                </div>
                <button
                  onClick={() => { setMyTasksMemberId(m.id); onClose() }}
                  className="text-xs text-ink-500 hover:text-rust-500 px-2 py-1 rounded"
                >
                  View tasks
                </button>
                {editMode && (
                  <>
                    <button onClick={() => setEditing(m.id)} className="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setConfirmDelete(m.id)} className="btn-ghost !p-1.5 !text-brick-500 opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {creating ? (
          <MemberEditor
            onSave={async input => { await addMember(input); setCreating(false) }}
            onCancel={() => setCreating(false)}
            usedColors={data?.members.map(m => m.color) || []}
          />
        ) : editMode && (
          <button onClick={() => setCreating(true)} className="btn-outline w-full">
            <Plus size={16} /> Add member
          </button>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) await deleteMember(confirmDelete) }}
        title="Remove member?"
        message="They'll be unassigned from all tasks. This cannot be undone."
        confirmLabel="Remove"
        danger
      />
    </Modal>
  )
}

interface EditorProps {
  member?: Member
  onSave: (input: { name: string; email?: string; color?: string }) => Promise<void>
  onCancel: () => void
  usedColors: string[]
}

function MemberEditor({ member, onSave, onCancel, usedColors }: EditorProps) {
  const [name, setName] = useState(member?.name || '')
  const [email, setEmail] = useState(member?.email || '')
  const [color, setColor] = useState(member?.color || nextMemberColor(usedColors))
  const [saving, setSaving] = useState(false)

  return (
    <div className="p-3 rounded-lg bg-cream-100 space-y-2.5">
      <div className="flex gap-2">
        <input autoFocus className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input className="input" placeholder="Email (optional)" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {MEMBER_PALETTE.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-1 ring-ink-900 scale-110' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost"><X size={14} /></button>
        <button
          onClick={async () => { setSaving(true); try { await onSave({ name, email: email || undefined, color }) } finally { setSaving(false) } }}
          disabled={!name.trim() || saving}
          className="btn-primary"
        >
          <Save size={14} /> Save
        </button>
      </div>
    </div>
  )
}
