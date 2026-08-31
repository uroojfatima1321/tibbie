import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { useApp } from '../../store/context'
import { Modal } from '../ui/Modal'

interface Props {
  open: boolean
  onClose: () => void
}

export function CleanupModal({ open, onClose }: Props) {
  const { orphanProjectsV2, cleanupOrphans } = useApp()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleCleanup() {
    setBusy(true)
    try {
      await cleanupOrphans(orphanProjectsV2.map(p => p.id))
      setDone(true)
    } finally { setBusy(false) }
  }

  function handleClose() { setDone(false); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="Clean up migrated items" size="sm">
      <div className="p-5 space-y-4">
        {done ? (
          <div className="text-center py-4">
            <p className="text-forest-600 font-semibold mb-1">Done!</p>
            <p className="text-sm text-ink-500">Placeholder items have been removed. Your V2 Roadmap is clean.</p>
            <button onClick={handleClose} className="btn-primary mt-4">Close</button>
          </div>
        ) : orphanProjectsV2.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-ink-500">No placeholder items found. You're all set.</p>
            <button onClick={handleClose} className="btn-outline mt-4">Close</button>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-600">
              These {orphanProjectsV2.length} item{orphanProjectsV2.length > 1 ? 's were' : ' was'} automatically created
              when your V1 projects were first migrated. They have no features, no RICE score, no tracks, and no history
              — safe to remove.
            </p>
            <div className="border border-surface-200 rounded-xl divide-y divide-surface-100 max-h-48 overflow-y-auto">
              {orphanProjectsV2.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700">
                  <span className="w-2 h-2 rounded-full bg-ink-300 shrink-0" />
                  <span className="truncate">{p.name}</span>
                  <span className="text-ink-400 font-mono text-[11px] ml-auto">{p.portfolio}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-400">
              Tip: Export a backup first via Settings → Export all data (JSON) if you want to keep a record.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={handleClose} className="btn-outline">Cancel</button>
              <button
                onClick={handleCleanup}
                disabled={busy}
                className="btn-primary flex items-center gap-2 !bg-brick-500 hover:!bg-brick-600"
              >
                <Trash2 size={14} />
                {busy ? 'Removing…' : `Remove ${orphanProjectsV2.length} item${orphanProjectsV2.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
