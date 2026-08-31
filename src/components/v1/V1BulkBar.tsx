import { useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import type { TaskStatus } from '../../types'
import { ConfirmDialog } from '../ui/Confirm'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'done', label: 'Done' },
]

interface Props {
  selectedIds: Set<string>
  memberOptions: { id: string; name: string }[]
  onClear: () => void
  onDelete: (ids: string[]) => Promise<void>
  onSetStatus: (ids: string[], status: TaskStatus) => Promise<void>
  onReassign: (ids: string[], memberId: string) => Promise<void>
  onShiftDates: (ids: string[], days: number) => Promise<void>
}

type Action = 'delete' | 'status' | 'reassign' | 'shift' | null

export function V1BulkBar({ selectedIds, memberOptions, onClear, onDelete, onSetStatus, onReassign, onShiftDates }: Props) {
  const [action, setAction] = useState<Action>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [statusVal, setStatusVal] = useState<TaskStatus>('in_progress')
  const [memberId, setMemberId] = useState(memberOptions[0]?.id ?? '')
  const [shiftDays, setShiftDays] = useState(1)
  const [applying, setApplying] = useState(false)

  const count = selectedIds.size
  if (count === 0) return null
  const ids = [...selectedIds]

  async function run(fn: () => Promise<void>) {
    setApplying(true)
    try { await fn(); setAction(null); onClear() } finally { setApplying(false) }
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-4 pointer-events-none animate-slide-up">
        <div className="pointer-events-auto bg-ink-900 text-white rounded-2xl shadow-float flex items-center gap-2 px-4 py-3 max-w-2xl w-full">
          <span className="font-mono text-sm font-semibold shrink-0">{count} task{count > 1 ? 's' : ''}</span>
          <div className="w-px h-5 bg-white/20 shrink-0" />
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {([
              { id: 'delete' as Action, label: 'Delete' },
              { id: 'status' as Action, label: 'Set status' },
              { id: 'reassign' as Action, label: 'Reassign' },
              { id: 'shift' as Action, label: 'Shift dates' },
            ]).map(btn => (
              <button key={btn.id} onClick={() => { setAction(action === btn.id ? null : btn.id) }}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${action === btn.id ? 'bg-white text-ink-900' : 'hover:bg-white/10 text-white'}`}>
                {btn.label} <ChevronDown size={12} className={action === btn.id ? 'rotate-180' : ''} />
              </button>
            ))}
          </div>
          <button onClick={onClear} className="shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X size={16} /></button>
        </div>
      </div>

      {action && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-float border border-surface-200 p-4 w-64 animate-scale-in">
          {action === 'delete' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Delete {count} task{count > 1 ? 's' : ''}?</p>
              <p className="text-xs text-ink-400">This cannot be undone.</p>
              <button onClick={() => { setAction(null); setDeleteConfirm(true) }} className="btn-primary w-full !py-1.5 text-sm !bg-brick-500 hover:!bg-brick-600">Delete {count}</button>
            </div>
          )}
          {action === 'status' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Set status for {count}</p>
              <select className="input w-full text-sm" value={statusVal} onChange={e => setStatusVal(e.target.value as TaskStatus)}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={() => run(() => onSetStatus(ids, statusVal))} disabled={applying} className="btn-primary w-full !py-1.5 text-sm">Apply</button>
            </div>
          )}
          {action === 'reassign' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Reassign {count} task{count > 1 ? 's' : ''}</p>
              <select className="input w-full text-sm" value={memberId} onChange={e => setMemberId(e.target.value)}>
                {memberOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={() => run(() => onReassign(ids, memberId))} disabled={applying || !memberId} className="btn-primary w-full !py-1.5 text-sm">Reassign</button>
            </div>
          )}
          {action === 'shift' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Shift {count} task{count > 1 ? 's' : ''}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setShiftDays(d => d - 1)} className="w-8 h-8 rounded-lg bg-surface-100 hover:bg-surface-200 text-ink-700 font-bold flex items-center justify-center shrink-0">−</button>
                <div className="flex-1 text-center">
                  <span className="font-mono text-sm font-semibold text-ink-900">{shiftDays > 0 ? '+' : ''}{shiftDays}</span>
                  <span className="text-xs text-ink-400 ml-1">day{Math.abs(shiftDays) !== 1 ? 's' : ''}</span>
                </div>
                <button onClick={() => setShiftDays(d => d + 1)} className="w-8 h-8 rounded-lg bg-surface-100 hover:bg-surface-200 text-ink-700 font-bold flex items-center justify-center shrink-0">+</button>
              </div>
              <button onClick={() => run(() => onShiftDates(ids, shiftDays))} disabled={applying || shiftDays === 0} className="btn-primary w-full !py-1.5 text-sm">
                {applying ? 'Shifting…' : `Shift ${shiftDays > 0 ? '+' : ''}${shiftDays} day${Math.abs(shiftDays) !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm}
        title={`Delete ${count} task${count > 1 ? 's' : ''}`}
        message={`Permanently delete ${count} selected task${count > 1 ? 's' : ''}? This cannot be undone.`}
        confirmLabel={`Delete ${count} task${count > 1 ? 's' : ''}`}
        danger
        onConfirm={async () => { await run(() => onDelete(ids)); setDeleteConfirm(false) }}
        onClose={() => setDeleteConfirm(false)}
      />
    </>
  )
}
