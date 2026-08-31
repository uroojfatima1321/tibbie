import { useRef, useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { useApp } from '../../store/context'
import type { FeatureV2, FeatureStatus, EffortSize } from '../../types'
import { ConfirmDialog as Confirm } from '../ui/Confirm'
import { ALL_FEATURE_STATUSES, getStatusLabel, StatusPill } from './StatusPill'

interface Props {
  selectedIds: string[]
  allFeatures: FeatureV2[]
  onClear: () => void
}

type Action = 'owner' | 'status' | 'effort' | 'project' | 'archive' | null

const EFFORT_SIZES: EffortSize[] = ['S', 'M', 'L', 'XL']
const STATUSES_NEEDING_REASON: FeatureStatus[] = ['on_hold', 'killed', 'rework']
const REWORK_GATES = ['architecture', 'code_review', 'qa'] as const

export function BulkBar({ selectedIds, allFeatures, onClear }: Props) {
  const { data, projectsV2, updateFeatureV2, addFeatureV2StatusLog, archiveFeatureV2, moveFeatureV2 } = useApp()
  const [activeAction, setActiveAction] = useState<Action>(null)
  const [archiveConfirm, setArchiveConfirm] = useState(false)

  // Action popover state
  const [selectedOwner, setSelectedOwner] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<FeatureStatus>('intake')
  const [statusReason, setStatusReason] = useState('')
  const [reworkGate, setReworkGate] = useState<typeof REWORK_GATES[number]>('code_review')
  const [selectedEffort, setSelectedEffort] = useState<EffortSize>('M')
  const [selectedProject, setSelectedProject] = useState('')
  const [reasonErr, setReasonErr] = useState('')
  const [applying, setApplying] = useState(false)

  const members = data?.members || []
  const count = selectedIds.length

  function toggleAction(a: Action) {
    setActiveAction(prev => prev === a ? null : a)
    setReasonErr('')
  }

  async function applyOwner() {
    if (!selectedOwner) return
    setApplying(true)
    try {
      for (const id of selectedIds) {
        const f = allFeatures.find(x => x.id === id)
        if (!f) continue
        await updateFeatureV2(id, { ownerIds: [...new Set([...f.ownerIds, selectedOwner])] })
      }
      setActiveAction(null)
      onClear()
    } finally { setApplying(false) }
  }

  async function applyStatus() {
    if (STATUSES_NEEDING_REASON.includes(selectedStatus)) {
      if (selectedStatus === 'rework' && !reworkGate) { setReasonErr('Gate required'); return }
      if (selectedStatus !== 'rework' && !statusReason.trim()) { setReasonErr('Reason required'); return }
    }
    setApplying(true)
    try {
      for (const id of selectedIds) {
        const f = allFeatures.find(x => x.id === id)
        if (!f) continue
        const patch: Partial<FeatureV2> = {}
        if (selectedStatus === 'on_hold') patch.holdReason = statusReason.trim()
        if (selectedStatus === 'killed') patch.killReason = statusReason.trim()
        if (selectedStatus === 'rework') patch.reworkFromGate = reworkGate
        await updateFeatureV2(id, patch)
        await addFeatureV2StatusLog(id, f.status, selectedStatus)
      }
      setActiveAction(null)
      onClear()
    } finally { setApplying(false) }
  }

  async function applyEffort() {
    setApplying(true)
    try {
      for (const id of selectedIds) await updateFeatureV2(id, { effortEstimate: selectedEffort })
      setActiveAction(null)
      onClear()
    } finally { setApplying(false) }
  }

  async function applyProject() {
    setApplying(true)
    try {
      for (const id of selectedIds) await moveFeatureV2(id, selectedProject || null)
      setActiveAction(null)
      onClear()
    } finally { setApplying(false) }
  }

  async function applyArchive() {
    setApplying(true)
    try {
      for (const id of selectedIds) await archiveFeatureV2(id)
      setArchiveConfirm(false)
      onClear()
    } finally { setApplying(false) }
  }

  if (count === 0) return null

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-4 animate-slide-up pointer-events-none">
        <div className="pointer-events-auto bg-ink-900 text-white rounded-2xl shadow-float flex items-center gap-2 px-4 py-3 max-w-3xl w-full">
          {/* Selection count */}
          <span className="font-mono text-sm font-semibold shrink-0">{count} selected</span>
          <div className="w-px h-5 bg-white/20 shrink-0" />

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {[
              { id: 'owner' as Action,   label: 'Assign owner' },
              { id: 'status' as Action,  label: 'Set status' },
              { id: 'effort' as Action,  label: 'Set effort required' },
              { id: 'project' as Action, label: 'Move to project' },
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => toggleAction(btn.id)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeAction === btn.id ? 'bg-white text-ink-900' : 'hover:bg-white/10 text-white'
                }`}
              >
                {btn.label}
                <ChevronDown size={12} className={`transition-transform ${activeAction === btn.id ? 'rotate-180' : ''}`} />
              </button>
            ))}
            <button
              onClick={() => setArchiveConfirm(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brick-500/40 text-brick-200 transition-colors"
            >
              Archive
            </button>
          </div>

          {/* Clear */}
          <button onClick={onClear} className="shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Action popovers */}
      {activeAction && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-float border border-surface-200 p-4 w-72 animate-scale-in">
          {activeAction === 'owner' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Assign owner</p>
              <select className="input w-full text-sm" value={selectedOwner} onChange={e => setSelectedOwner(e.target.value)}>
                <option value="">Select member…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={applyOwner} disabled={!selectedOwner || applying} className="btn-primary w-full !py-1.5 text-sm">
                {applying ? 'Applying…' : `Apply to ${count} features`}
              </button>
            </div>
          )}

          {activeAction === 'status' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Set status</p>
              <select className="input w-full text-sm" value={selectedStatus} onChange={e => { setSelectedStatus(e.target.value as FeatureStatus); setReasonErr('') }}>
                {ALL_FEATURE_STATUSES.map(s => (
                  <option key={s} value={s}>{getStatusLabel(s, 'feature')}</option>
                ))}
              </select>
              {selectedStatus === 'rework' && (
                <select className="input w-full text-sm" value={reworkGate} onChange={e => setReworkGate(e.target.value as typeof REWORK_GATES[number])}>
                  {REWORK_GATES.map(g => <option key={g} value={g}>{g.replace('_', ' ')}</option>)}
                </select>
              )}
              {(selectedStatus === 'on_hold' || selectedStatus === 'killed') && (
                <input className="input w-full text-sm" placeholder="Reason (required)" value={statusReason}
                  onChange={e => { setStatusReason(e.target.value); setReasonErr('') }} maxLength={200} />
              )}
              {reasonErr && <p className="text-xs text-brick-500">{reasonErr}</p>}
              <button onClick={applyStatus} disabled={applying} className="btn-primary w-full !py-1.5 text-sm">
                {applying ? 'Applying…' : `Apply to ${count} features`}
              </button>
            </div>
          )}

          {activeAction === 'effort' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Set effort required</p>
              <div className="flex gap-1">
                {EFFORT_SIZES.map(s => (
                  <button key={s} onClick={() => setSelectedEffort(s)}
                    className={`flex-1 py-1.5 rounded-lg border font-mono text-sm font-medium transition-colors ${selectedEffort === s ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-300 text-ink-600 hover:border-ink-400'}`}>
                    {s}
                  </button>
                ))}
              </div>
              <button onClick={applyEffort} disabled={applying} className="btn-primary w-full !py-1.5 text-sm">
                {applying ? 'Applying…' : `Apply to ${count} features`}
              </button>
            </div>
          )}

          {activeAction === 'project' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-600">Move to project</p>
              <select className="input w-full text-sm" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                <option value="">Backlog (unassigned)</option>
                {projectsV2.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={applyProject} disabled={applying} className="btn-primary w-full !py-1.5 text-sm">
                {applying ? 'Moving…' : `Move ${count} features`}
              </button>
            </div>
          )}
        </div>
      )}

      <Confirm
        open={archiveConfirm}
        title={`Archive ${count} features`}
        message={`Archive ${count} selected features? They will move to the Archive view.`}
        onConfirm={applyArchive}
        onClose={() => setArchiveConfirm(false)}
        danger
      />
    </>
  )
}
