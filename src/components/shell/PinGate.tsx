import { useState } from 'react'
import { Lock, LockOpen, KeyRound } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useApp } from '../../store/context'

export function PinGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pinConfigured, unlock, setupPin, lock, editMode } = useApp()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const title = editMode
    ? 'Edit mode'
    : pinConfigured === false ? 'Set an edit PIN' : 'Unlock edit mode'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (pinConfigured === false) {
        if (pin !== confirm) { setError("PINs don't match"); return }
        if (pin.length < 4) { setError('PIN must be at least 4 characters'); return }
        const ok = await setupPin(pin)
        if (!ok) { setError('Could not set PIN'); return }
        close()
      } else {
        const ok = await unlock(pin)
        if (!ok) { setError('Incorrect PIN'); return }
        close()
      }
    } finally {
      setBusy(false)
    }
  }

  function close() {
    setPin(''); setConfirm(''); setError(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title={title} size="sm">
      <div className="p-5">
        {editMode ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-forest-50 border border-forest-400/20">
              <LockOpen size={18} className="text-forest-500 mt-0.5 shrink-0" />
              <p className="text-sm text-ink-700">
                Edit mode is active. Anyone with the URL can read Tibbie, but only you can make changes in this session.
              </p>
            </div>
            <button onClick={() => { lock(); close() }} className="btn-outline w-full">
              <Lock size={16} />
              Lock edit mode
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {pinConfigured === false ? (
              <p className="text-sm text-ink-600">
                No PIN is set yet. Create one now — it will be required to add, edit, or delete anything. Keep it safe; there's no recovery.
              </p>
            ) : (
              <p className="text-sm text-ink-600">
                Enter the edit PIN to unlock changes for this session. It stays unlocked until you close the tab or press lock.
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1.5">PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="input font-mono"
                autoFocus
                minLength={4}
                maxLength={32}
                required
              />
            </div>
            {pinConfigured === false && (
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1.5">Confirm PIN</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="input font-mono"
                  minLength={4}
                  maxLength={32}
                  required
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-brick-500">{error}</p>
            )}
            <button type="submit" disabled={busy || !pin} className="btn-primary w-full">
              <KeyRound size={16} />
              {pinConfigured === false ? 'Create PIN' : 'Unlock'}
            </button>
          </form>
        )}
      </div>
    </Modal>
  )
}
