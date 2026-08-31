import { useState, useMemo, useRef, useEffect } from 'react'
import { X, Archive, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { FeatureV2, FeatureStatus } from '../../types'
import { useApp } from '../../store/context'
import { useDraftField } from '../../lib/useDraftField'
import { ModalDialog } from '../ui/ModalDialog'
import { StatusPill, ALL_FEATURE_STATUSES, getStatusLabel } from './StatusPill'
import { StatusPicker } from './StatusPicker'
import { ActivityLog } from './ActivityLog'
import { ConfirmDialog as Confirm } from '../ui/Confirm'

const STATUSES_NEEDING_REASON: FeatureStatus[] = ['on_hold', 'killed']
const REWORK_GATES = ['architecture', 'code_review', 'qa'] as const

interface Props {
  featureId: string | null
  onClose: () => void
  scrollToRice?: boolean
}

export function FeatureDrawer({ featureId, onClose, scrollToRice }: Props) {
  const { data, featuresV2, projectsV2,
    updateFeatureV2, addFeatureV2StatusLog, addFeatureV2Decision, archiveFeatureV2, editMode, } = useApp()

  const feature      = useMemo(() => featuresV2.find(f => f.id === featureId) ?? null, [featuresV2, featureId])
  const parentProject = useMemo(() => feature?.projectId ? projectsV2.find(p => p.id === feature.projectId) ?? null : null, [feature, projectsV2])

  const oneLinDraft = useDraftField(feature?.oneLiner, v => feature && updateFeatureV2(feature.id, { oneLiner: v }))
  const members = data?.members || []
  const riceRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollToRice && riceRef.current && bodyRef.current) {
      setTimeout(() => riceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
    }
  }, [scrollToRice, featureId])

  const [statusOpen, setStatusOpen]       = useState(false)
  const [pendingStatus, setPendingStatus] = useState<FeatureStatus | null>(null)
  const [pendingReason, setPendingReason] = useState('')
  const [pendingGate, setPendingGate]     = useState<typeof REWORK_GATES[number]>('code_review')
  const [reasonError, setReasonError]     = useState('')
  const [decisionInput, setDecisionInput] = useState('')
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [editName, setEditName]           = useState(false)
  const [nameValue, setNameValue]         = useState('')

  if (!feature) return null


  function handleClose() {
    if (oneLinDraft.isDirty) { setDiscardConfirm(true); return }
    onClose()
  }

  async function confirmStatusChange() {
    if (!pendingStatus || !feature) return
    if (STATUSES_NEEDING_REASON.includes(pendingStatus) && !pendingReason.trim()) {
      setReasonError(pendingStatus === 'on_hold' ? 'Hold reason is required' : 'Kill reason is required'); return
    }
    if (pendingStatus === 'rework' && !pendingGate) { setReasonError('Gate is required'); return }
    const patch: Partial<FeatureV2> = {}
    if (pendingStatus === 'on_hold') patch.holdReason = pendingReason.trim()
    if (pendingStatus === 'killed')  patch.killReason  = pendingReason.trim()
    if (pendingStatus === 'rework')  patch.reworkFromGate = pendingGate
    await updateFeatureV2(feature.id, patch)
    await addFeatureV2StatusLog(feature.id, feature.status, pendingStatus)
    setPendingStatus(null)
  }

  return (
    <>
      <ModalDialog open={!!featureId} onClose={handleClose} maxWidth="2xl">
        {/* HEADER */}
        <div className="shrink-0 px-6 py-4 border-b border-surface-200 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editMode && editName ? (
              <input autoFocus className="font-semibold text-lg text-ink-900 bg-transparent border-b-2 border-rust-400 outline-none w-full"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={() => { if (nameValue.trim()) updateFeatureV2(feature.id, { name: nameValue.trim() }); setEditName(false) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { if (nameValue.trim()) updateFeatureV2(feature.id, { name: nameValue.trim() }); setEditName(false) }
                  if (e.key === 'Escape') setEditName(false)
                }}
              />
            ) : (
              <h2 className={`font-semibold text-lg text-ink-900 leading-snug ${editMode ? 'cursor-text hover:text-rust-600 transition-colors' : ''}`}
                onClick={() => { if (editMode) { setNameValue(feature.name); setEditName(true) } }}>
                {feature.name}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Item 1: StatusPicker */}
              <StatusPicker
                status={feature.status}
                kind="feature"
                editMode={editMode}
                onSelect={s => setPendingStatus(s as FeatureStatus)}
              />
              {parentProject && (
            <span className="text-xs text-ink-400">
              ↳ {parentProject.name}
              {feature.moduleId && (() => {
                const mod = projectsV2.find(p => p.id === feature.projectId) ? null : null
                const allMods = data?.modulesV2 || []
                const m = allMods.find(m => m.id === feature.moduleId)
                return m ? ` · ${m.name}` : null
              })()}
            </span>
          )}
            </div>
          </div>
          <button onClick={handleClose} className="shrink-0 btn-ghost !p-1.5" aria-label="Close"><X size={18} /></button>
        </div>

        {/* BODY */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-5">
          {pendingStatus && (
            <div className="space-y-2 bg-surface-50 border border-surface-200 rounded-xl p-3">
              {pendingStatus === 'rework' && (
                <>
                  <label className="text-xs font-semibold text-ink-600">Bounced at gate <span className="text-brick-500">*</span></label>
                  <select className="input text-sm w-full" value={pendingGate} onChange={e => setPendingGate(e.target.value as typeof REWORK_GATES[number])}>
                    {REWORK_GATES.map(g => <option key={g} value={g}>{g.replace('_', ' ')}</option>)}
                  </select>
                </>
              )}
              {STATUSES_NEEDING_REASON.includes(pendingStatus) && (
                <>
                  <label className="text-xs font-semibold text-ink-600">{pendingStatus === 'on_hold' ? 'Hold reason' : 'Kill reason'} <span className="text-brick-500">*</span></label>
                  <input autoFocus className="input w-full text-sm" placeholder="Required" maxLength={200}
                    value={pendingReason} onChange={e => { setPendingReason(e.target.value); setReasonError('') }} />
                </>
              )}
              {reasonError && <p className="text-xs text-brick-500">{reasonError}</p>}
              <div className="flex gap-2">
                <button onClick={confirmStatusChange} className="btn-primary !py-1.5 text-sm">Confirm</button>
                <button onClick={() => { setPendingStatus(null); setPendingReason('') }} className="btn-ghost !py-1.5 text-sm">Cancel</button>
              </div>
            </div>
          )}

          {/* oneLiner */}
          {editMode ? (
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Description</label>
              <textarea className="input w-full text-sm min-h-[60px]" maxLength={140} {...oneLinDraft.textareaProps} placeholder="One-liner, ≤140 chars" />
            </div>
          ) : feature.oneLiner ? <p className="text-sm text-ink-600">{feature.oneLiner}</p> : null}

          {/* Effort */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Dev. Effort</p>
            <div className="flex items-center gap-1">            </div>
          </div>

          {/* Phase D: Two-level parent selector (Project → Module) */}
          {editMode && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Project</label>
                <select className="input w-full text-sm"
                  value={feature.projectId || ''}
                  onChange={e => {
                    const newPid = e.target.value || null
                    updateFeatureV2(feature.id, { projectId: newPid, moduleId: null })
                  }}>
                  <option value="">Backlog</option>
                  {projectsV2.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Module (optional)</label>
                <select className="input w-full text-sm"
                  value={feature.moduleId || ''}
                  onChange={e => updateFeatureV2(feature.id, { moduleId: e.target.value || null })}
                  disabled={!feature.projectId}
                >
                  <option value="">Direct (no module)</option>
                  {(data?.modulesV2 || [])
                    .filter(m => m.projectId === feature.projectId && !m.archived)
                    .map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                  }
                </select>
              </div>
            </div>
          )}

          {/* Item 6: Activity Log */}
          <ActivityLog
            entityId={feature.id}
            entityKind="feature"
            activityLog={(feature as any).activityLog}
            members={data?.members}
          />

          {/* Status history */}
          {feature.statusLog.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-2">Status history</p>
              <div className="space-y-1">
                {[...feature.statusLog].reverse().slice(0, 6).map(e => (
                  <div key={e.id} className="text-xs flex items-center gap-2">
                    <span className="font-mono text-ink-400 shrink-0">{format(parseISO(e.at), 'dd MMM')}</span>
                    <span className="text-ink-600">{e.to.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decisions */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-2">Decisions</p>
            <div className="space-y-1 mb-2">
              {feature.decisionLog.map(d => (
                <div key={d.id} className="text-xs flex items-start gap-2">
                  <span className="font-mono text-ink-400 shrink-0">{format(parseISO(d.at), 'dd MMM')}</span>
                  <span className="text-ink-600">{d.text}</span>
                </div>
              ))}
            </div>
            {editMode && (
              <input className="input w-full text-sm !py-1" placeholder="Add decision note…"
                value={decisionInput} onChange={e => setDecisionInput(e.target.value)}
                onKeyDown={async e => { if (e.key === 'Enter' && decisionInput.trim()) { await addFeatureV2Decision(feature.id, decisionInput.trim()); setDecisionInput('') } }} />
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 px-6 py-3 border-t border-surface-200 bg-white flex justify-between items-center">
          <div>
            {editMode && (
              <button onClick={() => setArchiveConfirm(true)} className="btn-ghost text-sm text-ink-500 hover:text-brick-500 flex items-center gap-1.5">
                <Archive size={13} /> Archive
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose} className="btn-outline text-sm !py-1.5">Close</button>
          </div>
        </div>
      </ModalDialog>

      <Confirm open={archiveConfirm} title="Archive feature" message="Archive this feature? It will move to the Archive view."
        onConfirm={async () => { await archiveFeatureV2(feature.id); setArchiveConfirm(false); onClose() }}
        onClose={() => setArchiveConfirm(false)} />

      <Confirm open={discardConfirm} title="Discard changes?" message="You have unsaved edits. Discard them and close?"
        confirmLabel="Discard" danger
        onConfirm={() => { setDiscardConfirm(false); onClose() }}
        onClose={() => setDiscardConfirm(false)} />    </>
  )
}
