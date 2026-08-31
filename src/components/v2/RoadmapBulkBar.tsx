import { useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { useApp } from '../../store/context'
import type { ProjectV2, FeatureV2, ProjectStatus, FeatureStatus } from '../../types'
import { ALL_PROJECT_STATUSES, ALL_FEATURE_STATUSES, getStatusLabel, StatusPill } from './StatusPill'
import { PortfolioCombobox } from './PortfolioCombobox'
import { ConfirmDialog } from '../ui/Confirm'
import { ValueDots } from './ValueDots'

const REASON_STATUSES: string[] = ['on_hold', 'killed', 'rework']

interface Props {
  selectedIds: Set<string>
  allProjects: ProjectV2[]
  allFeatures: FeatureV2[]
  portfolios: string[]
  onClear: () => void
}

type Action = 'archive' | 'status' | 'portfolio' | 'value' | null

export function RoadmapBulkBar({ selectedIds, allProjects, allFeatures, portfolios, onClear }: Props) {
  const { archiveBulkV2, setStatusBulk, moveToPortfolioBulk, setValueRatingBulk } = useApp()
  const [action, setAction] = useState<Action>(null)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [statusTarget, setStatusTarget] = useState<ProjectStatus | FeatureStatus>('on_hold')
  const [reason, setReason] = useState('')
  const [reasonErr, setReasonErr] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [valueRating, setValueRating] = useState<1|2|3|4|5|undefined>(undefined)
  const [applying, setApplying] = useState(false)

  const count = selectedIds.size
  if (count === 0) return null

  const selProjects = allProjects.filter(p => selectedIds.has(p.id))
  const selFeatures = allFeatures.filter(f => selectedIds.has(f.id))

  // Live-features aggregate warning for archive
  const liveFeatureCount = selProjects.reduce((sum, p) => {
    return sum + allFeatures.filter(f => f.projectId === p.id && !['shipped', 'killed'].includes(f.status)).length
  }, 0)

  async function doArchive() {
    setApplying(true)
    try {
      await archiveBulkV2(selProjects.map(p => p.id), selFeatures.map(f => f.id))
      setArchiveConfirm(false); onClear()
    } finally { setApplying(false) }
  }

  async function doStatus() {
    if (REASON_STATUSES.includes(statusTarget) && !reason.trim()) {
      setReasonErr('Reason is required'); return
    }
    setApplying(true)
    try {
      const items = [
        ...selProjects.map(p => ({ id: p.id, kind: 'project' as const, currentStatus: p.status })),
        ...selFeatures.map(f => ({ id: f.id, kind: 'feature' as const, currentStatus: f.status })),
      ]
      await setStatusBulk(items, statusTarget, reason.trim() || undefined)
      setAction(null); onClear()
    } finally { setApplying(false) }
  }

  async function doPortfolio() {
    if (!portfolio.trim()) return
    setApplying(true)
    try {
      await moveToPortfolioBulk(selProjects.map(p => p.id), portfolio.trim())
      setAction(null); onClear()
    } finally { setApplying(false) }
  }

  async function doValue() {
    setApplying(true)
    try {
      await setValueRatingBulk(selProjects.map(p => p.id), 'project', valueRating)
      await setValueRatingBulk(selFeatures.map(f => f.id), 'feature', valueRating)
      setAction(null); onClear()
    } finally { setApplying(false) }
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-4 pointer-events-none animate-slide-up">
        <div className="pointer-events-auto bg-ink-900 text-white rounded-2xl shadow-float flex items-center gap-2 px-4 py-3 max-w-3xl w-full">
          <span className="font-mono text-sm font-semibold shrink-0">{count} selected</span>
          <div className="w-px h-5 bg-white/20 shrink-0" />
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {[
              { id: 'archive' as Action, label: 'Archive' },
              { id: 'status' as Action,   label: 'Set status' },
              { id: 'portfolio' as Action, label: 'Move to portfolio', disabled: selFeatures.length > 0 },
              { id: 'value' as Action,    label: 'Business Value' },
            ].map(btn => (
              <button key={btn.id} onClick={() => setAction(action === btn.id ? null : btn.id)}
                disabled={btn.disabled}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${action === btn.id ? 'bg-white text-ink-900' : 'hover:bg-white/10 text-white'}`}>
                {btn.label}
                <ChevronDown size={12} className={action === btn.id ? 'rotate-180' : ''} />
              </button>
            ))}
          </div>
          <button onClick={onClear} className="shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X size={16} /></button>
        </div>
      </div>

      {/* Popovers */}
      {action && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-float border border-surface-200 p-4 w-72 animate-scale-in" onClick={e => e.stopPropagation()}>
          {action === 'archive' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Archive {count} item{count > 1 ? 's' : ''}</p>
              {liveFeatureCount > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                  {selProjects.length} project{selProjects.length > 1 ? 's' : ''} contain{selProjects.length === 1 ? 's' : ''} {liveFeatureCount} unshipped feature{liveFeatureCount > 1 ? 's' : ''} — they'll be archived too.
                </p>
              )}
              <p className="text-xs text-ink-400">Tip: Export a backup first.</p>
              <button onClick={() => { setAction(null); setArchiveConfirm(true) }} className="btn-primary w-full !py-1.5 text-sm">Confirm archive</button>
            </div>
          )}
          {action === 'status' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Set status for {count} item{count > 1 ? 's' : ''}</p>
              <select className="input w-full text-sm" value={statusTarget} onChange={e => { setStatusTarget(e.target.value as any); setReason(''); setReasonErr('') }}>
                {[...ALL_PROJECT_STATUSES, ...ALL_FEATURE_STATUSES.filter(s => !ALL_PROJECT_STATUSES.includes(s as any))].map(s => (
                  <option key={s} value={s}>{getStatusLabel(s)}</option>
                ))}
              </select>
              {REASON_STATUSES.includes(statusTarget) && (
                <>
                  <input className="input w-full text-sm" placeholder="Reason (required, applied to all)"
                    value={reason} onChange={e => { setReason(e.target.value); setReasonErr('') }} />
                  {reasonErr && <p className="text-xs text-brick-500">{reasonErr}</p>}
                </>
              )}
              <button onClick={doStatus} disabled={applying} className="btn-primary w-full !py-1.5 text-sm">
                {applying ? 'Applying…' : `Apply to ${count}`}
              </button>
            </div>
          )}
          {action === 'portfolio' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Move {selProjects.length} project{selProjects.length > 1 ? 's' : ''} to portfolio</p>
              <PortfolioCombobox
                value={portfolio}
                onChange={setPortfolio}
                options={portfolios}
                placeholder="Portfolio name"
                autoFocus={false}
              />
              <button onClick={doPortfolio} disabled={!portfolio.trim() || applying} className="btn-primary w-full !py-1.5 text-sm">
                {applying ? 'Moving…' : 'Move'}
              </button>
            </div>
          )}
          {action === 'value' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Set Business Value for {count}</p>
              <div className="flex items-center justify-center gap-1 py-2">
                <ValueDots value={valueRating} editable onSet={v => setValueRating(v)} size="md" />
              </div>
              <p className="text-xs text-ink-400 text-center">{valueRating ? `${valueRating} / 5` : 'Click to set (click again to clear)'}</p>
              <button onClick={doValue} disabled={applying} className="btn-primary w-full !py-1.5 text-sm">
                {applying ? 'Applying…' : 'Apply'}
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={archiveConfirm}
        title={`Archive ${count} item${count > 1 ? 's' : ''}`}
        message={`Archive ${count} selected item${count > 1 ? 's' : ''}?${liveFeatureCount > 0 ? ` ${liveFeatureCount} unshipped feature${liveFeatureCount > 1 ? 's' : ''} will also be archived.` : ''} Tip: Export a backup first.`}
        onConfirm={doArchive}
        onClose={() => setArchiveConfirm(false)}
        danger
      />
    </>
  )
}
