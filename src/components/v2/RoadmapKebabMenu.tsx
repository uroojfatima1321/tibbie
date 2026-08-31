import { useEffect, useRef, useState } from 'react'
import { Edit2, RefreshCw, MessageSquarePlus, Archive, Copy } from 'lucide-react'
import type { ProjectStatus, FeatureStatus, TibbieData } from '../../types'
import { useApp } from '../../store/context'
import { ALL_PROJECT_STATUSES, ALL_FEATURE_STATUSES, getStatusLabel } from './StatusPill'

export interface KebabTarget {
  id: string
  kind: 'project' | 'feature'
  x: number
  y: number
  currentStatus: string
}

interface Props {
  target: KebabTarget | null
  onClose: () => void
  onOpenItem: (id: string, kind: 'project' | 'feature') => void
}

const nowISO = () => new Date().toISOString()
const randId = (prefix: string) => prefix + '-' + Math.random().toString(36).slice(2, 9)

export function RoadmapKebabMenu({ target, onClose, onOpenItem }: Props) {
  const {
    archiveProjectV2, archiveFeatureV2,
    updateProjectV2, updateFeatureV2,
    addProjectV2Decision, addFeatureV2Decision,
    permanentDeleteProjectV2, permanentDeleteFeatureV2,
    projectsV2, featuresV2,
    addProjectV2, addFeatureV2,
  } = useApp()

  const menuRef = useRef<HTMLDivElement>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [decisionOpen, setDecisionOpen] = useState(false)
  const [decisionText, setDecisionText] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset sub-panels when target changes
  useEffect(() => { setStatusOpen(false); setDecisionOpen(false); setDecisionText('') }, [target?.id])

  // Close on Esc or outside click
  useEffect(() => {
    if (!target) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onPtr(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPtr)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onPtr) }
  }, [target, onClose])

  if (!target) return null

  const { id, kind, x: rawX, y: rawY, currentStatus } = target
  const X = Math.min(rawX, window.innerWidth - 224)
  const Y = Math.min(rawY, window.innerHeight - 310)

  const statuses = kind === 'project' ? ALL_PROJECT_STATUSES : ALL_FEATURE_STATUSES

  async function run(fn: () => Promise<void>) {
    setBusy(true); try { await fn(); onClose() } catch {} finally { setBusy(false) }
  }

  function doEdit() { onOpenItem(id, kind); onClose() }

  function doStatus(status: string) {
    run(async () => {
      if (kind === 'project') await updateProjectV2(id, { status: status as ProjectStatus })
      else await updateFeatureV2(id, { status: status as FeatureStatus })
    })
  }

  function doDecision() {
    if (!decisionText.trim()) return
    run(async () => {
      if (kind === 'project') await addProjectV2Decision(id, decisionText.trim())
      else await addFeatureV2Decision(id, decisionText.trim())
    })
  }

  function doArchive() {
    run(async () => {
      if (kind === 'project') await archiveProjectV2(id)
      else await archiveFeatureV2(id)
    })
  }

  function doDuplicate() {
    run(async () => {
      const now = nowISO()
      if (kind === 'project') {
        const src = projectsV2.find(p => p.id === id)
        if (!src) return
        await addProjectV2({ name: src.name + ' (copy)', portfolio: src.portfolio, oneLiner: src.oneLiner })
      } else {
        const src = featuresV2.find(f => f.id === id)
        if (!src) return
        await addFeatureV2({ name: src.name + ' (copy)', projectId: src.projectId, oneLiner: src.oneLiner })
      }
    })
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Card options"
      className="fixed z-50 bg-white border border-surface-200 rounded-xl shadow-float w-52 py-1 animate-scale-in"
      style={{ left: X, top: Y }}
      onClick={e => e.stopPropagation()}
    >
      <MenuItem icon={<Edit2 size={13} />} label="Edit" onClick={doEdit} />

      {/* Change status */}
      <div className="relative">
        <MenuItem icon={<RefreshCw size={13} />} label="Change status"
          onClick={() => { setStatusOpen(v => !v); setDecisionOpen(false) }} />
        {statusOpen && (
          <div className="absolute left-full top-0 ml-1 w-52 bg-white border border-surface-200 rounded-xl shadow-float py-1 z-10 max-h-64 overflow-y-auto">
            {statuses.map(s => (
              <button key={s} onClick={() => doStatus(s)}
                disabled={busy}
                className={`w-full flex items-center px-3 py-2 text-sm transition-colors text-left disabled:opacity-40 ${
                  s === currentStatus ? 'text-rust-600 font-medium bg-rust-50' : 'text-ink-700 hover:bg-surface-50'
                }`}>
                {getStatusLabel(s, kind)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add decision note */}
      <div>
        <MenuItem icon={<MessageSquarePlus size={13} />} label="Add decision note"
          onClick={() => { setDecisionOpen(v => !v); setStatusOpen(false) }} />
        {decisionOpen && (
          <div className="px-3 pb-2">
            <textarea autoFocus value={decisionText} onChange={e => setDecisionText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) doDecision() }}
              placeholder="Decision text… (⌘↵ to save)"
              rows={3}
              className="w-full text-xs border border-surface-200 rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-rust-400 resize-none mt-1"
            />
            <button onClick={doDecision} disabled={!decisionText.trim() || busy}
              className="btn-primary !py-1 !text-xs w-full mt-1 disabled:opacity-40">
              {busy ? 'Saving…' : 'Save note'}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-surface-100 my-1" />

      <MenuItem icon={<Copy size={13} />} label="Duplicate" onClick={doDuplicate} disabled={busy} />
      <MenuItem icon={<Archive size={13} />} label="Archive" onClick={doArchive} disabled={busy} danger />
    </div>
  )
}

function MenuItem({ icon, label, onClick, disabled, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean
}) {
  return (
    <button role="menuitem" onClick={onClick} disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left disabled:opacity-40 ${
        danger ? 'text-brick-500 hover:bg-brick-50' : 'text-ink-700 hover:bg-surface-50'
      }`}>
      <span className={danger ? 'text-brick-400' : 'text-ink-400'}>{icon}</span>
      {label}
    </button>
  )
}
