/**
 * ModuleDrawer — Phase D
 * Full editing panel for ModuleV2. Opened from App.tsx (top-level) same pattern as FeatureDrawer.
 * Inputs at module scope (not render-body closures) per input registry.
 */
import { useState, useMemo } from 'react'
import { X, Archive, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { ModuleV2, FeatureStatus } from '../../types'
import { useApp } from '../../store/context'
import { useDraftField } from '../../lib/useDraftField'
import { ModalDialog } from '../ui/ModalDialog'
import { PortfolioCombobox } from './PortfolioCombobox'
import { TasksSection } from './TasksSection'
import { ActivityLog } from './ActivityLog'
import { StatusPill, ALL_FEATURE_STATUSES, getStatusLabel } from './StatusPill'
import { StatusPicker } from './StatusPicker'
import { ConfirmDialog as Confirm } from '../ui/Confirm'

const STATUSES_NEEDING_REASON: FeatureStatus[] = ['on_hold', 'killed']
const REWORK_GATES = ['architecture', 'code_review', 'qa'] as const

// ── Module-scope sub-components (input registry compliance) ───────────────────

interface DecisionInputProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}
function DecisionInput({ value, onChange, onSubmit }: DecisionInputProps) {
  return (
    <input
      className="input w-full text-sm !py-1"
      placeholder="Add decision note…"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onSubmit() }}
    />
  )
}

interface Props {
  moduleId: string | null
  onClose: () => void
  onOpenFeature?: (id: string) => void
}

export function ModuleDrawer({ moduleId, onClose, onOpenFeature }: Props) {
  const {
    modulesV2, featuresV2, projectsV2, data,
    updateModuleV2, archiveModuleV2, addModuleV2StatusLog, addModuleV2Decision,
    editMode,
  } = useApp()

  const module_ = useMemo(() => modulesV2.find(m => m.id === moduleId) ?? null, [modulesV2, moduleId])
  const parentProject = useMemo(() => module_?.projectId ? projectsV2.find(p => p.id === module_.projectId) ?? null : null, [module_, projectsV2])
  const moduleFeatures = useMemo(() => featuresV2.filter(f => f.moduleId === moduleId), [featuresV2, moduleId])
  // Item 2: portfolio editing — mirrors ProjectDrawer.tsx:43-50 pattern
  const [portfolioEdit, setPortfolioEdit] = useState<string | null>(null)
  const allPortfolios = useMemo(() => [...new Set(projectsV2.map(p => p.portfolio))].sort(), [projectsV2])

  function commitPortfolio() {
    if (!module_) { setPortfolioEdit(null); return }
    const val = (portfolioEdit ?? '').trim() || (parentProject?.portfolio ?? 'Uncategorized')
    if (val !== module_.portfolio) updateModuleV2(module_.id, { portfolio: val })
    setPortfolioEdit(null)
  }

  const oneLinDraft = useDraftField(module_?.oneLiner, v => module_ && updateModuleV2(module_.id, { oneLiner: v }))

  const [statusOpen, setStatusOpen]     = useState(false)
  const [pendingStatus, setPendingStatus] = useState<FeatureStatus | null>(null)
  const [pendingReason, setPendingReason] = useState('')
  const [pendingGate, setPendingGate]   = useState<typeof REWORK_GATES[number]>('code_review')
  const [reasonError, setReasonError]   = useState('')
  const [decisionText, setDecisionText] = useState('')
  const [archiveOpen, setArchiveOpen]   = useState(false)
  const [archivePath, setArchivePath]   = useState<'archive' | 'detach' | null>(null)
  const [editName, setEditName]         = useState(false)
  const [nameValue, setNameValue]       = useState('')

  if (!module_) return null

  const reworkCount = module_.statusLog.filter(e => e.to === 'rework').length

  async function confirmStatusChange() {
    if (!pendingStatus || !module_) return
    if (STATUSES_NEEDING_REASON.includes(pendingStatus) && !pendingReason.trim()) {
      setReasonError('Reason is required'); return
    }
    const patch: Partial<ModuleV2> = {}
    if (pendingStatus === 'on_hold') patch.holdReason = pendingReason.trim()
    if (pendingStatus === 'killed')  patch.killReason  = pendingReason.trim()
    if (pendingStatus === 'rework')  patch.reworkFromGate = pendingGate
    await updateModuleV2(module_.id, patch)
    await addModuleV2StatusLog(module_.id, module_.status, pendingStatus)
    setPendingStatus(null); setPendingReason('')
  }

  async function handleDecisionSubmit() {
    if (!decisionText.trim() || !module_) return
    await addModuleV2Decision(module_.id, decisionText.trim())
    setDecisionText('')
  }

  return (
    <>
      <ModalDialog open={!!moduleId} onClose={onClose} maxWidth="2xl">
        {/* HEADER */}
        <div className="shrink-0 px-6 py-4 border-b border-surface-200 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editMode && editName ? (
              <input
                autoFocus
                className="font-semibold text-lg text-ink-900 bg-transparent border-b-2 border-rust-400 outline-none w-full"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={() => { if (nameValue.trim()) updateModuleV2(module_.id, { name: nameValue.trim() }); setEditName(false) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { if (nameValue.trim()) updateModuleV2(module_.id, { name: nameValue.trim() }); setEditName(false) }
                  if (e.key === 'Escape') setEditName(false)
                }}
              />
            ) : (
              <h2
                className={`font-semibold text-lg text-ink-900 leading-snug truncate ${editMode ? 'cursor-text hover:text-rust-600 transition-colors' : ''}`}
                onClick={() => { if (editMode) { setNameValue(module_.name); setEditName(true) } }}
              >
                {module_.name}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Item 1: StatusPicker */}
              <StatusPicker
                status={module_.status}
                kind="feature"
                editMode={editMode}
                onSelect={s => setPendingStatus(s as FeatureStatus)}
              />
              {reworkCount > 0 && (
                <span className="font-mono text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                  Rework ×{reworkCount}
                </span>
              )}
              {parentProject && (
                <span className="text-xs text-ink-400">↳ {parentProject.name}</span>
              )}
              {/* Item 2: portfolio — mirrors ProjectDrawer.tsx:129–146 pattern */}
              {portfolioEdit !== null ? (
                <PortfolioCombobox
                  value={portfolioEdit}
                  onChange={setPortfolioEdit}
                  options={allPortfolios}
                  onCommit={commitPortfolio}
                  onCancel={() => setPortfolioEdit(null)}
                />
              ) : (
                <button
                  onClick={() => editMode && setPortfolioEdit(module_.portfolio ?? '')}
                  className={`text-[10px] font-medium ${module_.portfolio ? 'text-ink-500' : 'text-ink-300 italic'} ${editMode ? 'hover:text-rust-500 cursor-pointer' : 'cursor-default'}`}
                  title={editMode ? 'Click to set portfolio' : undefined}
                >
                  {module_.portfolio
                    ? module_.portfolio
                    : parentProject?.portfolio
                    ? `Inherits from ${parentProject.name}${editMode ? ' — click to override' : ''}`
                    : 'Other'
                  }
                </button>
              )}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 btn-ghost !p-1.5" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-5">
          {/* pendingStatus confirmation flow */}
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
                  <label className="text-xs font-semibold text-ink-600">
                    {pendingStatus === 'on_hold' ? 'Hold reason' : 'Kill reason'} <span className="text-brick-500">*</span>
                  </label>
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

          {/* Description */}
          {editMode ? (
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Description</label>
              <textarea className="input w-full text-sm min-h-[60px]" maxLength={140}
                {...oneLinDraft.textareaProps} placeholder="One-liner, ≤140 chars" />
            </div>
          ) : module_.oneLiner ? <p className="text-sm text-ink-600">{module_.oneLiner}</p> : null}

          {/* Features in this module */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-2">
              Features ({moduleFeatures.length})
            </p>
            {moduleFeatures.length === 0
              ? <p className="text-xs text-ink-400">No features assigned to this module yet.</p>
              : (
                <div className="space-y-0.5">
                  {moduleFeatures.map(f => (
                    <button key={f.id}
                      onClick={() => onOpenFeature?.(f.id)}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-50 text-sm w-full text-left"
                    >
                      <span className="flex-1 text-ink-800 truncate">{f.name}</span>
                      <StatusPill status={f.status} kind="feature" className="!text-[10px]" />
                    </button>
                  ))}
                </div>
              )}
          </div>

          {/* Item 5: Tasks in this module */}
          {module_.projectId && (
            <TasksSection
              projectId={module_.projectId}
              moduleId={module_.id}
              onOpenTaskInGantt={id => onOpenFeature?.(id)}
            />
          )}

          {/* Item 6: Activity Log */}
          <ActivityLog
            entityId={module_.id}
            entityKind="module"
            activityLog={(module_ as any).activityLog}
            members={data?.members}
          />

          {/* Status history */}
          {module_.statusLog.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-2">Status history</p>
              <div className="space-y-1">
                {[...module_.statusLog].reverse().slice(0, 6).map(e => (
                  <div key={e.id} className="text-xs flex items-center gap-2">
                    <span className="font-mono text-ink-400 shrink-0">{format(parseISO(e.at), 'dd MMM')}</span>
                    <span className="text-ink-600">{e.to.replace(/_/g, ' ')}</span>
                    {e.note && <span className="text-ink-400 truncate">· {e.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decisions */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-2">Decisions</p>
            <div className="space-y-1 mb-2">
              {module_.decisionLog.map(d => (
                <div key={d.id} className="text-xs flex items-start gap-2">
                  <span className="font-mono text-ink-400 shrink-0">{format(parseISO(d.at), 'dd MMM')}</span>
                  <span className="text-ink-600">{d.text}</span>
                </div>
              ))}
            </div>
            {editMode && (
              <DecisionInput
                value={decisionText}
                onChange={setDecisionText}
                onSubmit={handleDecisionSubmit}
              />
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 px-6 py-3 border-t border-surface-200 bg-white flex justify-between items-center">
          <div>
            {editMode && (
              <button onClick={() => setArchiveOpen(true)}
                className="btn-ghost text-sm text-ink-500 hover:text-brick-500 flex items-center gap-1.5">
                <Archive size={13} /> Archive
              </button>
            )}
          </div>
          <button onClick={onClose} className="btn-outline text-sm !py-1.5">Close</button>
        </div>
      </ModalDialog>

      {/* Archive — choose path (single confirm with both options shown as buttons) */}
      {archiveOpen && archivePath === null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-float max-w-sm w-full p-6 space-y-4 animate-scale-in">
            <h2 className="font-semibold text-ink-900">Archive module</h2>
            <p className="text-sm text-ink-600">
              "{module_.name}" has {moduleFeatures.length} feature{moduleFeatures.length !== 1 ? 's' : ''}. What should happen to them?
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => setArchivePath('archive')}
                className="btn-primary text-sm !py-2">
                Archive module + features
              </button>
              <button onClick={() => setArchivePath('detach')}
                className="btn-outline text-sm !py-2">
                Archive module, detach features to project
              </button>
              <button onClick={() => { setArchiveOpen(false); setArchivePath(null) }}
                className="btn-ghost text-sm !py-1.5">Cancel</button>
            </div>
          </div>
        </div>
      )}
      <Confirm
        open={archivePath === 'archive'}
        title="Archive module and its features?"
        message={`This archives "${module_.name}" and all ${moduleFeatures.length} features inside it.`}
        confirmLabel="Archive all"
        danger
        onConfirm={async () => {
          await archiveModuleV2(module_.id, false)
          setArchivePath(null); setArchiveOpen(false); onClose()
        }}
        onClose={() => { setArchivePath(null); setArchiveOpen(false) }}
      />
      <Confirm
        open={archivePath === 'detach'}
        title="Archive module, detach features?"
        message={`This archives "${module_.name}". Its ${moduleFeatures.length} features move to the project level (not archived).`}
        onConfirm={async () => {
          await archiveModuleV2(module_.id, true)
          setArchivePath(null); setArchiveOpen(false); onClose()
        }}
        onClose={() => { setArchivePath(null); setArchiveOpen(false) }}
      />
    </>
  )
}
