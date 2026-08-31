import { useState, useMemo } from 'react'
import { X, Plus, Archive, Tag as TagIcon, Wrench as WrenchIcon, AlertTriangle, Handshake } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { ProjectV2, ProjectStatus, Milestone } from '../../types'
import { useApp } from '../../store/context'
import { useDraftField } from '../../lib/useDraftField'
import { ModalDialog } from '../ui/ModalDialog'
import { StatusPill, ALL_PROJECT_STATUSES, getStatusLabel } from './StatusPill'
import { StatusPicker } from './StatusPicker'
import { ConfirmDialog as Confirm } from '../ui/Confirm'
import { TracksSection } from './TracksSection'
import { PortfolioCombobox } from './PortfolioCombobox'
import { ModulesSection } from './ModulesSection'
import { TasksSection } from './TasksSection'
import { ActivityLog } from './ActivityLog'
import { LIVE_GROUP_STATUSES } from '../../lib/filterV2'

const TERMINAL_STATUSES = ['shipped', 'killed']

const STATUSES_NEEDING_REASON: ProjectStatus[] = ['on_hold', 'killed']
const MS_STATUS_COLOR: Record<string, string> = {
  upcoming: '#3A6B8A', hit: '#2F5743', missed: '#A83D2F', moved: '#C8932F',
}

interface Props { projectId: string | null; onClose: () => void; onOpenModule?: (id: string) => void; onOpenFeature?: (id: string, scrollToRice?: boolean) => void }

export function ProjectDrawer({ projectId, onClose, onOpenModule, onOpenFeature }: Props) {
  const {
    editMode, projectsV2, featuresV2, modulesV2, data,
    updateProjectV2, archiveProjectV2,
    addProjectV2StatusLog, addProjectV2Decision,
    addProjectV2Milestone, updateProjectV2Milestone,
  } = useApp()

  const project = useMemo(() => projectsV2.find(p => p.id === projectId) ?? null, [projectsV2, projectId])
  const childFeatures = useMemo(() => featuresV2.filter(f => f.projectId === projectId), [featuresV2, projectId])
  const childModules  = useMemo(() => modulesV2.filter(m => m.projectId === projectId), [modulesV2, projectId])

  // P-6: portfolio inline editing
  const [portfolioEdit, setPortfolioEdit] = useState<string | null>(null)
  const allPortfolios = useMemo(() => [...new Set(projectsV2.map(p => p.portfolio))].sort(), [projectsV2])

  function commitPortfolio() {
    if (!project) { setPortfolioEdit(null); return }
    const val = (portfolioEdit ?? '').trim() || 'Uncategorized'
    if (val !== project.portfolio) updateProjectV2(project.id, { portfolio: val })
    setPortfolioEdit(null)
  }

  // P-5 + Phase D: in-flight = features + modules in non-terminal status on Live projects
  const inFlightCount = useMemo(() => {
    if (!project) return 0
    if (!LIVE_GROUP_STATUSES.includes(project.status)) return 0
    const liveFeatures = childFeatures.filter(f => !TERMINAL_STATUSES.includes(f.status) && !f.archived).length
    const liveModules  = childModules.filter(m => !TERMINAL_STATUSES.includes(m.status) && !m.archived).length
    return liveFeatures + liveModules
  }, [project, childFeatures, childModules])
  // Draft fields — commit on blur only
  const oneLinDraft  = useDraftField(project?.oneLiner,      v => project && updateProjectV2(project.id, { oneLiner: v }))
  const quarterDraft = useDraftField(project?.targetQuarter, v => project && updateProjectV2(project.id, { targetQuarter: v }))
  const retroDraft   = useDraftField(project?.retroNotes,    v => project && updateProjectV2(project.id, { retroNotes: v }))
  const isAnyDirty   = oneLinDraft.isDirty || quarterDraft.isDirty || retroDraft.isDirty

  const [statusOpen, setStatusOpen]       = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null)
  const [pendingReason, setPendingReason] = useState('')
  const [reasonError, setReasonError]     = useState('')
  const [decisionInput, setDecisionInput] = useState('')
  const [milestoneForm, setMilestoneForm] = useState(false)
  const [msName, setMsName]               = useState('')
  const [msDate, setMsDate]               = useState('')
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [editName, setEditName]           = useState(false)
  const [nameValue, setNameValue]         = useState('')

  function handleClose() {
    if (isAnyDirty) { setDiscardConfirm(true); return }
    onClose()
  }

  async function confirmStatusChange() {
    if (!pendingStatus || !project) return
    if (STATUSES_NEEDING_REASON.includes(pendingStatus) && !pendingReason.trim()) {
      setReasonError('Reason is required'); return
    }
    const patch: Partial<ProjectV2> = { status: pendingStatus }
    if (pendingStatus === 'on_hold')  patch.holdReason = pendingReason
    if (pendingStatus === 'killed')   patch.killReason  = pendingReason
    await updateProjectV2(project.id, patch)
    await addProjectV2StatusLog(project.id, project.status, pendingStatus,
      STATUSES_NEEDING_REASON.includes(pendingStatus) ? pendingReason : undefined)
    setPendingStatus(null); setPendingReason(''); setStatusOpen(false)
  }

  if (!project) return null

  return (
    <>
      <ModalDialog open={!!projectId} onClose={handleClose} maxWidth="2xl">
        {/* HEADER */}
        <div className="shrink-0 px-6 py-4 border-b border-surface-200 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editMode && editName ? (
              <input autoFocus className="font-semibold text-lg text-ink-900 bg-transparent border-b-2 border-rust-400 outline-none w-full"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={() => { if (nameValue.trim()) updateProjectV2(project.id, { name: nameValue.trim() }); setEditName(false) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { if (nameValue.trim()) updateProjectV2(project.id, { name: nameValue.trim() }); setEditName(false) }
                  if (e.key === 'Escape') setEditName(false)
                }}
              />
            ) : (
              <h2 className={`font-semibold text-lg text-ink-900 leading-snug truncate ${editMode ? 'cursor-text hover:text-rust-600 transition-colors' : ''}`}
                onClick={() => { if (editMode) { setNameValue(project.name); setEditName(true) } }}>
                {project.name}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Item 1: StatusPicker replaces inline ladder that displaced body content */}
              <StatusPicker
                status={project.status}
                kind="project"
                editMode={editMode}
                onSelect={s => { setStatusOpen(false); setPendingStatus(s as ProjectStatus) }}
              />
              {/* P-6: portfolio — click-to-edit in editMode */}
              {portfolioEdit !== null ? (
                <PortfolioCombobox
                  value={portfolioEdit}
                  onChange={setPortfolioEdit}
                  onCommit={commitPortfolio}
                  onCancel={() => setPortfolioEdit(null)}
                  options={allPortfolios}
                  className="w-40"
                />
              ) : (
                <button
                  onClick={() => editMode && setPortfolioEdit(project.portfolio)}
                  className={`text-xs text-ink-400 rounded px-1 -mx-1 ${editMode ? 'hover:text-rust-600 hover:bg-rust-50 cursor-pointer transition-colors' : 'cursor-default'}`}
                  title={editMode ? 'Click to edit portfolio' : undefined}
                >
                  {project.portfolio}
                </button>
              )}
              {/* Phase B: client timeline chip */}
              {project.clientTimeline && (
                <span className="font-sans text-[10px] font-medium text-amber-600 border border-amber-400 px-1.5 py-0.5 rounded-full flex items-center gap-1"
                  title="Timeline has been shared with the client">
                  <Handshake size={10} /> Timeline shared with client
                </span>
              )}
              {/* P-5: in-flight chip */}
              {inFlightCount > 0 && (
                <span
                  className="text-[11px] font-mono text-steel-600 bg-steel-50 border border-steel-500/20 px-1.5 py-0.5 rounded-full"
                  title={`${inFlightCount} feature${inFlightCount !== 1 ? 's' : ''}/improvement${inFlightCount !== 1 ? 's' : ''} in progress inside this shipped product`}
                >
                  {inFlightCount} in flight
                </span>
              )}
              {project.status === 'on_hold' && project.holdReason && (
                <span className="text-xs text-ink-500">· {project.holdReason}</span>
              )}
            </div>
          </div>
          <button onClick={handleClose} className="shrink-0 btn-ghost !p-1.5" aria-label="Close"><X size={18} /></button>
        </div>

        {/* BODY — two columns on md+ */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
          {/* pendingStatus confirmation flow — reason inputs for hold/kill/rework */}
          {pendingStatus && (
            <div className="mb-4 space-y-2 bg-surface-50 border border-surface-200 rounded-xl p-3">
              {STATUSES_NEEDING_REASON.includes(pendingStatus) && (
                <>
                  <label className="text-xs font-semibold text-ink-600">{pendingStatus === 'on_hold' ? 'Hold reason' : 'Kill reason'} <span className="text-brick-500">*</span></label>
                  <input autoFocus className="input w-full text-sm" placeholder="Required" maxLength={200}
                    value={pendingReason} onChange={e => { setPendingReason(e.target.value); setReasonError('') }} />
                  {reasonError && <p className="text-xs text-brick-500">{reasonError}</p>}
                </>
              )}
              <div className="flex gap-2">
                <button onClick={confirmStatusChange} className="btn-primary !py-1.5 text-sm">→ {getStatusLabel(pendingStatus)}</button>
                <button onClick={() => { setPendingStatus(null); setPendingReason('') }} className="btn-ghost !py-1.5 text-sm">Cancel</button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            {/* LEFT column */}
            <div className="space-y-5">
              {/* Description */}
              {editMode ? (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Description</label>
                  <textarea className="input w-full text-sm min-h-[60px]" maxLength={140} {...oneLinDraft.textareaProps} placeholder="One-liner, ≤140 chars" />
                </div>
              ) : project.oneLiner ? <p className="text-sm text-ink-600">{project.oneLiner}</p> : null}

              {/* Effort + Quarter — stay on one row (wide layout advantage) */}
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Dev. Effort</p>
                  <div className="flex items-center gap-1">                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Target Quarter</p>
                  {editMode
                    ? <input className="input !py-1 text-sm font-mono w-24" placeholder="Q3 2026" {...quarterDraft.inputProps} pattern="Q[1-4] \d{4}" />
                    : <span className="font-mono text-sm text-ink-700">{project.targetQuarter || '—'}</span>}
                </div>
              </div>

              {/* Phase B: clientTimeline toggle */}
              {editMode && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="rounded border-surface-300 text-rust-500 focus:ring-rust-400"
                      checked={!!project.clientTimeline}
                      onChange={e => updateProjectV2(project.id, { clientTimeline: e.target.checked })} />
                    <span className="text-sm text-ink-700 flex items-center gap-1">
                      <Handshake size={13} className="text-amber-500" />
                      Timeline shared with client
                    </span>
                  </label>
                </div>
              )}

              {/* Retro notes */}
              {['production','production_monitoring','mvp_live','killed'].includes(project.status) && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Retro notes</p>
                  <textarea className="input w-full text-sm min-h-[72px]" placeholder="What went well, what didn't…" {...retroDraft.textareaProps} readOnly={!editMode} />
                </div>
              )}
            </div>

            {/* RIGHT column */}
            <div className="space-y-5">
              {/* Milestones */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Timeline</p>
                  {editMode && <button onClick={() => setMilestoneForm(v => !v)} className="text-xs text-ink-400 hover:text-rust-500 transition-colors">+ Milestone</button>}
                </div>
                {milestoneForm && (
                  <div className="mb-3 flex items-center gap-2 flex-wrap bg-surface-50 p-3 rounded-lg border border-surface-200">
                    <input className="input !py-1 text-sm flex-1 min-w-[120px]" placeholder="Milestone name" value={msName} onChange={e => setMsName(e.target.value)} />
                    <input className="input !py-1 text-sm" type="date" value={msDate} onChange={e => setMsDate(e.target.value)} />
                    <button className="btn-primary !py-1 text-sm" onClick={async () => {
                      if (!msName.trim() || !msDate) return
                      await addProjectV2Milestone(project.id, { name: msName.trim(), date: msDate, status: 'upcoming' })
                      setMsName(''); setMsDate(''); setMilestoneForm(false)
                    }}>Add</button>
                    <button className="btn-ghost !py-1 text-sm" onClick={() => setMilestoneForm(false)}>Cancel</button>
                  </div>
                )}
                {project.milestones.length === 0
                  ? <p className="text-xs text-ink-400">No milestones yet.</p>
                  : (
                    <div className="relative pl-6">
                      <div className="absolute left-2 top-3 bottom-3 w-px bg-surface-200" />
                      <div className="space-y-2">
                        {[...project.milestones].sort((a,b) => a.date.localeCompare(b.date)).map(ms => (
                          <div key={ms.id} className="relative flex items-start gap-2">
                            <span className="absolute -left-4 top-1.5 w-2 h-2 rounded-full border-2 border-white" style={{ backgroundColor: MS_STATUS_COLOR[ms.status] }} />
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm text-ink-800 ${ms.status === 'moved' ? 'line-through text-ink-400' : ''}`}>{ms.name}</span>
                              <span className="ml-2 font-mono text-[11px] text-ink-400">{format(parseISO(ms.date), 'dd MMM yyyy')}</span>
                            </div>
                            {editMode && (
                              <select className="text-[10px] border border-surface-200 rounded bg-white text-ink-600 py-0.5 shrink-0"
                                value={ms.status} onChange={e => updateProjectV2Milestone(project.id, ms.id, { status: e.target.value as Milestone['status'] })}>
                                {(['upcoming','hit','missed','moved'] as Milestone['status'][]).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              {/* Tracks */}
              <TracksSection project={project} />

              {/* Phase D: Modules & Features */}
              <ModulesSection
                project={project}
                onOpenModule={onOpenModule}
                onOpenFeature={onOpenFeature}
              />

              {/* Item 5: Tasks section */}
              {onOpenFeature && (
                <TasksSection
                  projectId={project.id}
                  onOpenTaskInGantt={id => onOpenFeature(id)}
                />
              )}

              {/* Item 6: Activity Log */}
              <ActivityLog
                entityId={project.id}
                entityKind="project"
                activityLog={(project as any).activityLog}
                members={data?.members}
              />

              {/* Status history */}
              {project.statusLog.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-2">Status history</p>
                  <div className="space-y-1">
                    {[...project.statusLog].reverse().slice(0, 8).map(e => (
                      <div key={e.id} className="text-xs text-ink-400 flex items-center gap-2">
                        <span className="font-mono shrink-0">{format(parseISO(e.at), 'dd MMM')}</span>
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
                  {project.decisionLog.map(d => (
                    <div key={d.id} className="text-xs text-ink-600 flex items-start gap-2">
                      <span className="font-mono text-ink-400 shrink-0">{format(parseISO(d.at), 'dd MMM')}</span>
                      <span>{d.text}</span>
                    </div>
                  ))}
                </div>
                {editMode && (
                  <input className="input w-full text-sm !py-1" placeholder="Add decision note…"
                    value={decisionInput} onChange={e => setDecisionInput(e.target.value)}
                    onKeyDown={async e => { if (e.key === 'Enter' && decisionInput.trim()) { await addProjectV2Decision(project.id, decisionInput.trim()); setDecisionInput('') } }} />
                )}
              </div>
            </div>
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

      <Confirm
        open={archiveConfirm}
        title="Archive project"
        message={
          childFeatures.filter(f => !['shipped','killed'].includes(f.status)).length > 0
            ? `${childFeatures.filter(f => !['shipped','killed'].includes(f.status)).length} features are not shipped/killed. Archive anyway?`
            : 'Archive this project? It will move to the Archive view.'
        }
        onConfirm={async () => { await archiveProjectV2(project.id); setArchiveConfirm(false); onClose() }}
        onClose={() => setArchiveConfirm(false)}
      />

      <Confirm
        open={discardConfirm}
        title="Discard changes?"
        message="You have unsaved edits in one or more fields. Discard them and close?"
        confirmLabel="Discard"
        danger
        onConfirm={() => { setDiscardConfirm(false); onClose() }}
        onClose={() => setDiscardConfirm(false)}
      />    </>
  )
}
