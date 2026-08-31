/**
 * MustDoModal — Phase B
 * Applies or removes a Must-Do tag. Reason is REQUIRED on apply.
 * Removal is immediate (no reason needed, logs to statusLog via applyMustDo).
 */
import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useApp } from '../../store/context'

interface Props {
  open: boolean
  itemId: string
  kind: 'project' | 'feature' | 'module'
  itemName: string
  /** Non-null = already tagged (show remove option) */
  existingReason: string | null
  onClose: () => void
}

export function MustDoModal({ open, itemId, kind, itemName, existingReason, onClose }: Props) {
  const { applyMustDo } = useApp()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleApply() {
    if (!reason.trim()) { setError('Reason is required'); return }
    setLoading(true)
    try {
      await applyMustDo(itemId, kind, {
        reason: reason.trim(),
        at: new Date().toISOString(),
      })
      setReason('')
      onClose()
    } finally { setLoading(false) }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await applyMustDo(itemId, kind, null)
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-float max-w-sm w-full p-6 space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brick-600">
              <AlertTriangle size={13} className="text-white" />
            </span>
            <h2 className="font-semibold text-ink-900">
              {existingReason ? 'Remove Must-Do tag' : 'Mark as Must-Do'}
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 p-1 rounded-lg hover:bg-surface-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-ink-600 truncate">
          <span className="font-medium">{itemName}</span>
        </p>

        {existingReason ? (
          // Remove mode
          <div className="space-y-3">
            <div className="bg-brick-50 border border-brick-200 rounded-lg p-3">
              <p className="text-xs text-ink-500 font-medium mb-0.5">Current reason</p>
              <p className="text-sm text-brick-700 italic">{existingReason}</p>
            </div>
            <p className="text-sm text-ink-600">
              Removing this tag will return the item to the scored rank pool. The removal will be logged to the item's status history.
            </p>
            <div className="flex gap-2">
              <button onClick={handleRemove} disabled={loading}
                className="btn-primary !py-1.5 text-sm bg-brick-500 hover:bg-brick-600 disabled:opacity-50">
                {loading ? 'Removing…' : 'Remove Must-Do tag'}
              </button>
              <button onClick={onClose} className="btn-ghost !py-1.5 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          // Apply mode
          <div className="space-y-3">
            <p className="text-sm text-ink-600">
              Must-Do items are excluded from RICE/WSJF scoring and appear above the ranked queue. They ship regardless of score.
            </p>
            <div>
              <label className="text-xs font-semibold text-ink-600 block mb-1">
                Reason <span className="text-brick-500">*</span>
              </label>
              <input
                autoFocus
                className="input w-full text-sm"
                placeholder="e.g. Regulatory requirement, customer commitment…"
                maxLength={200}
                value={reason}
                onChange={e => { setReason(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleApply() }}
              />
              {error && <p className="text-xs text-brick-500 mt-0.5">{error}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={handleApply} disabled={loading}
                className="btn-primary !py-1.5 text-sm disabled:opacity-50">
                {loading ? 'Saving…' : 'Mark as Must-Do'}
              </button>
              <button onClick={onClose} className="btn-ghost !py-1.5 text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
