import { useState, useRef } from 'react'
import { Download, Upload, AlertTriangle } from 'lucide-react'
import { useApp } from '../../store/context'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/Confirm'

interface Props {
  open: boolean
  onClose: () => void
}

export function BackupModal({ open, onClose }: Props) {
  const { exportDataJSON, importDataJSON } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importConfirm, setImportConfirm] = useState(false)
  const [pendingRaw, setPendingRaw] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importErr, setImportErr] = useState('')

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const raw = ev.target?.result as string
      try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed.projects)) throw new Error('Missing projects array')
        setPendingRaw(raw)
        setImportErr('')
        setImportConfirm(true)
      } catch (err) {
        setImportErr(err instanceof Error ? err.message : 'Invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''   // allow re-select same file
  }

  async function doImport() {
    if (!pendingRaw) return
    setImporting(true)
    try {
      await importDataJSON(pendingRaw)
      setImportConfirm(false)
      setPendingRaw(null)
      onClose()
    } catch (err) {
      setImportErr(err instanceof Error ? err.message : 'Import failed')
      setImportConfirm(false)
    } finally { setImporting(false) }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Data backup" size="sm">
        <div className="p-5 space-y-4">
          <div className="space-y-3">
            {/* Export */}
            <div className="border border-surface-200 rounded-xl p-4 flex items-start gap-3">
              <Download size={18} className="text-ink-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink-900">Export all data (JSON)</p>
                <p className="text-xs text-ink-500 mt-0.5">Full V1 + V2 dump — tibbie-backup-YYYY-MM-DD.json</p>
                <button
                  onClick={() => { exportDataJSON(); onClose() }}
                  className="btn-primary !py-1.5 !text-sm mt-3"
                >
                  Download backup
                </button>
              </div>
            </div>

            {/* Import */}
            <div className="border border-surface-200 rounded-xl p-4 flex items-start gap-3">
              <Upload size={18} className="text-ink-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink-900">Import data (JSON)</p>
                <p className="text-xs text-ink-500 mt-0.5">Replaces ALL current data. Use a backup file from this app.</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="btn-outline !py-1.5 !text-sm mt-3"
                >
                  Choose file…
                </button>
                <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
                {importErr && (
                  <p className="text-xs text-brick-500 mt-2 flex items-center gap-1">
                    <AlertTriangle size={12} /> {importErr}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={importConfirm}
        title="Replace all data?"
        message="This replaces ALL current data with the backup file. Your existing projects, features, tasks, and RICE data will be overwritten. This cannot be undone — export a backup first if you haven't."
        confirmLabel="Replace data"
        danger
        onConfirm={doImport}
        onClose={() => { setImportConfirm(false); setPendingRaw(null) }}
      />
    </>
  )
}
