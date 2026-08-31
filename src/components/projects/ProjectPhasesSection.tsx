import { useMemo, useState } from 'react'
import { Plus, X, Trash2, Save, ChevronDown, ChevronUp, ArrowLeft, ArrowRight, Library } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import type { ProjectPhase, PhaseStatus, PhaseTemplate } from '../../types'
import { useApp } from '../../store/context'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/Confirm'

interface Props {
  projectId: string
  onOpenLibrary: () => void
}

const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  skipped: 'Skipped',
}

const PHASE_STATUS_DOT: Record<PhaseStatus, string> = {
  not_started: '#A8A29A',
  in_progress: '#3A6B8A',
  blocked: '#A83D2F',
  done: '#2F5743',
  skipped: '#8B8680',
}

const PHASE_STATUSES: PhaseStatus[] = ['not_started', 'in_progress', 'blocked', 'done', 'skipped']

export function ProjectPhasesSection({ projectId, onOpenLibrary }: Props) {
  const { data, editMode, addProjectPhase, deleteProjectPhase, reorderProjectPhases } = useApp()
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const projectPhases = useMemo(() => {
    return (data?.projectPhases || [])
      .filter(p => p.projectId === projectId)
      .sort((a, b) => a.order - b.order)
  }, [data, projectId])

  const templateMap = useMemo(() => {
    const m = new Map<string, PhaseTemplate>()
    data?.phaseTemplates.forEach(t => m.set(t.id, t))
    return m
  }, [data])

  const stats = useMemo(() => {
    const done = projectPhases.filter(p => p.status === 'done').length
    const skipped = projectPhases.filter(p => p.status === 'skipped').length
    const inProgress = projectPhases.find(p => p.status === 'in_progress')
    const blocked = projectPhases.find(p => p.status === 'blocked')
    const total = projectPhases.length
    const current = blocked || inProgress
    const currentTemplate = current ? templateMap.get(current.templateId) : null
    return { done, skipped, total, current, currentTemplate }
  }, [projectPhases, templateMap])

  const availableTemplates = useMemo(() => {
    const usedIds = new Set(projectPhases.map(p => p.templateId))
    return (data?.phaseTemplates || []).filter(t => !usedIds.has(t.id))
  }, [data, projectPhases])

  function move(phase: ProjectPhase, direction: 'up' | 'down') {
    const idx = projectPhases.findIndex(p => p.id === phase.id)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= projectPhases.length) return
    const reordered = [...projectPhases]
    const [removed] = reordered.splice(idx, 1)
    reordered.splice(targetIdx, 0, removed)
    reorderProjectPhases(projectId, reordered.map(p => p.id))
  }

  // If the library is empty, prompt the user to set it up first
  if ((data?.phaseTemplates || []).length === 0) {
    return (
      <section className="p-4 rounded-xl bg-surface-50 border border-surface-200">
        <div className="flex items-center gap-3">
          <Library size={18} className="text-ink-500 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-ink-900">No phases in library yet</h3>
            <p className="text-xs text-ink-500 mt-0.5">
              Set up reusable phases (Discovery, Build, QA…) once, then pick which apply to each project.
            </p>
          </div>
          <button onClick={onOpenLibrary} className="btn-primary shrink-0">
            Open library
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">Phases</h2>
          {stats.total > 0 && (
            <p className="text-xs text-ink-500 mt-0.5">
              {stats.done} of {stats.total - stats.skipped} done
              {stats.currentTemplate && (
                <>
                  {' · currently in '}
                  <span style={{ color: stats.currentTemplate.color }} className="font-medium">
                    {stats.currentTemplate.name}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <>
              <button onClick={onOpenLibrary} className="btn-ghost text-xs" title="Manage phase library">
                <Library size={14} /> Library
              </button>
              {availableTemplates.length > 0 && (
                <button onClick={() => setAddOpen(true)} className="btn-ghost text-xs">
                  <Plus size={14} /> Add phase
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {projectPhases.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-surface-200 text-center">
          <p className="text-sm text-ink-500">No phases on this project yet.</p>
          {editMode && (
            <button onClick={() => setAddOpen(true)} className="btn-outline mt-3">
              <Plus size={14} /> Add the first phase
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Pipeline strip — horizontal scroll on narrow screens */}
          <div className="overflow-x-auto tibbie-scroll -mx-1 px-1 pb-1">
            <div className="flex items-center gap-2 min-w-fit">
              {projectPhases.map((phase, idx) => {
                const template = templateMap.get(phase.templateId)
                if (!template) return null
                const isLast = idx === projectPhases.length - 1
                const isCurrent = stats.current?.id === phase.id
                return (
                  <div key={phase.id} className="flex items-center gap-2 shrink-0">
                    <PhasePill
                      phase={phase}
                      template={template}
                      isCurrent={isCurrent}
                      onClick={() => setEditingPhaseId(phase.id)}
                    />
                    {!isLast && (
                      <span className="text-ink-300 shrink-0">
                        <ArrowRight size={14} />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Inline editor when a phase is selected */}
          {editingPhaseId && (
            <PhaseEditor
              phaseId={editingPhaseId}
              onClose={() => setEditingPhaseId(null)}
              onRequestRemove={() => { setConfirmRemove(editingPhaseId); setEditingPhaseId(null) }}
              onMoveUp={() => {
                const p = projectPhases.find(pp => pp.id === editingPhaseId)
                if (p) move(p, 'up')
              }}
              onMoveDown={() => {
                const p = projectPhases.find(pp => pp.id === editingPhaseId)
                if (p) move(p, 'down')
              }}
              canMoveUp={projectPhases.findIndex(p => p.id === editingPhaseId) > 0}
              canMoveDown={projectPhases.findIndex(p => p.id === editingPhaseId) < projectPhases.length - 1}
            />
          )}
        </>
      )}

      {/* Add-phase picker modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add phase to project" size="sm">
        <div className="p-5 space-y-2">
          <p className="text-sm text-ink-600 mb-3">Pick from your library:</p>
          {availableTemplates.length === 0 ? (
            <p className="text-sm text-ink-400 text-center py-4">All library phases are already on this project.</p>
          ) : (
            availableTemplates.map(t => (
              <button
                key={t.id}
                onClick={async () => {
                  await addProjectPhase({ projectId, templateId: t.id })
                  setAddOpen(false)
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-surface-200 hover:border-rust-400 hover:bg-surface-50 text-left transition-colors"
              >
                <span className="w-2 h-7 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900">{t.name}</div>
                  {t.description && <div className="text-xs text-ink-500 truncate">{t.description}</div>}
                </div>
                <Plus size={14} className="text-ink-400" />
              </button>
            ))
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => { if (confirmRemove) await deleteProjectPhase(confirmRemove) }}
        title="Remove phase from this project?"
        message="The phase template stays in the library and can be re-added later. Auto-posted updates about this phase are not deleted."
        confirmLabel="Remove"
        danger
      />
    </section>
  )
}

function PhasePill({
  phase, template, isCurrent, onClick,
}: {
  phase: ProjectPhase
  template: PhaseTemplate
  isCurrent: boolean
  onClick: () => void
}) {
  const dim = phase.status === 'skipped'
  const isDone = phase.status === 'done'
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium
        transition-all
        ${isCurrent ? 'shadow-sm ring-2 ring-offset-1 ring-offset-white' : ''}
        ${dim ? 'opacity-50' : ''}
        ${isDone ? 'bg-surface-50' : 'bg-white'}
        hover:bg-surface-50
      `}
      style={{
        borderColor: template.color,
        // Active-phase ring uses the template color
        ...(isCurrent ? { '--tw-ring-color': template.color } as any : {}),
      }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PHASE_STATUS_DOT[phase.status] }} />
      <span className="text-ink-900">{template.name}</span>
      <span className="text-[10px] text-ink-500 hidden sm:inline">· {PHASE_STATUS_LABELS[phase.status]}</span>
    </button>
  )
}

function PhaseEditor({
  phaseId, onClose, onRequestRemove,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: {
  phaseId: string
  onClose: () => void
  onRequestRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const { data, editMode, updateProjectPhase, updatePhaseTemplate } = useApp()
  const phase = data?.projectPhases.find(p => p.id === phaseId)
  const template = phase ? data?.phaseTemplates.find(t => t.id === phase.templateId) : null
  const [notes, setNotes] = useState(phase?.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(template?.name || '')

  if (!phase || !template) return null

  async function saveName() {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== template!.name) {
      await updatePhaseTemplate(template!.id, { name: trimmed })
    }
    setEditingName(false)
  }

  const duration = phase.startedAt && phase.completedAt
    ? differenceInDays(parseISO(phase.completedAt), parseISO(phase.startedAt))
    : null

  return (
    <div className="p-4 rounded-xl border border-surface-200 bg-white">
      <div className="flex items-start gap-3 mb-3">
        <span className="w-2 h-8 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: template.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {editMode && editingName ? (
              <input
                autoFocus
                className="font-semibold text-sm text-ink-900 bg-transparent border-b border-rust-400 outline-none flex-1 min-w-0"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={saveName}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); saveName() }
                  if (e.key === 'Escape') { setEditingName(false) }
                }}
              />
            ) : (
              <h3
                className={`font-semibold text-sm text-ink-900 ${editMode ? 'cursor-text hover:text-rust-600 transition-colors' : ''}`}
                onClick={() => { if (editMode) { setNameValue(template.name); setEditingName(true) } }}
                title={editMode ? 'Click to rename phase' : undefined}
              >
                {template.name}
              </h3>
            )}
            <span
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: PHASE_STATUS_DOT[phase.status] + '22', color: PHASE_STATUS_DOT[phase.status] }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PHASE_STATUS_DOT[phase.status] }} />
              {PHASE_STATUS_LABELS[phase.status]}
            </span>
          </div>
          {template.description && <p className="text-xs text-ink-500 mt-0.5">{template.description}</p>}
          {editMode && !editingName && (
            <p className="text-[10px] text-ink-400 mt-0.5">Click name to rename · affects all projects</p>
          )}
        </div>
        <button onClick={onClose} className="btn-ghost !p-1 shrink-0" aria-label="Close editor">
          <X size={14} />
        </button>
      </div>

      {editMode && (
        <div className="space-y-3">
          {/* Status selector */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1.5">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {PHASE_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => updateProjectPhase(phaseId, { status: s })}
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                    ${phase.status === s
                      ? 'border-current shadow-sm'
                      : 'border-surface-200 text-ink-500 hover:bg-surface-50'}
                  `}
                  style={phase.status === s ? { color: PHASE_STATUS_DOT[s], backgroundColor: PHASE_STATUS_DOT[s] + '15' } : {}}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PHASE_STATUS_DOT[s] }} />
                  {PHASE_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Started</label>
              <input
                type="date"
                className="input !py-1.5 text-sm"
                value={phase.startedAt ? phase.startedAt.slice(0, 10) : ''}
                onChange={e => updateProjectPhase(phaseId, { startedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Completed</label>
              <input
                type="date"
                className="input !py-1.5 text-sm"
                value={phase.completedAt ? phase.completedAt.slice(0, 10) : ''}
                onChange={e => updateProjectPhase(phaseId, { completedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              />
            </div>
          </div>
          {duration != null && duration > 0 && (
            <p className="text-xs text-ink-500 italic">Took {duration} day{duration === 1 ? '' : 's'}</p>
          )}

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Notes (optional)</label>
            <textarea
              className="input min-h-[60px] text-sm"
              placeholder="Decisions, blockers, sign-offs…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={async () => {
                if (notes === (phase.notes || '')) return
                setSavingNotes(true)
                try { await updateProjectPhase(phaseId, { notes: notes || undefined }) }
                finally { setSavingNotes(false) }
              }}
            />
          </div>

          {/* Reorder + remove */}
          <div className="flex items-center gap-2 pt-1 border-t border-surface-200">
            <button onClick={onMoveUp} disabled={!canMoveUp} className="btn-ghost text-xs disabled:opacity-30">
              <ChevronUp size={14} /> Move earlier
            </button>
            <button onClick={onMoveDown} disabled={!canMoveDown} className="btn-ghost text-xs disabled:opacity-30">
              <ChevronDown size={14} /> Move later
            </button>
            <div className="flex-1" />
            <button onClick={onRequestRemove} className="btn-ghost text-xs !text-brick-500">
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>
      )}

      {!editMode && (
        <div className="text-xs text-ink-500 space-y-1">
          {phase.startedAt && <p>Started {format(parseISO(phase.startedAt), 'd MMM yyyy')}</p>}
          {phase.completedAt && <p>Completed {format(parseISO(phase.completedAt), 'd MMM yyyy')}</p>}
          {phase.notes && <p className="pt-2 text-ink-700 whitespace-pre-wrap">{phase.notes}</p>}
        </div>
      )}
    </div>
  )
}

/**
 * Returns the "current phase" (in_progress or blocked) for a project, used
 * by GanttView to show a small badge on project rows. Exported as a helper
 * to keep GanttView from duplicating the logic.
 */
export function findCurrentPhase(
  projectId: string,
  projectPhases: ProjectPhase[],
  phaseTemplates: PhaseTemplate[],
): { phase: ProjectPhase; template: PhaseTemplate } | null {
  const phases = projectPhases.filter(p => p.projectId === projectId).sort((a, b) => a.order - b.order)
  if (phases.length === 0) return null
  // Priority: blocked > in_progress > first not_started > nothing
  const blocked = phases.find(p => p.status === 'blocked')
  if (blocked) {
    const tpl = phaseTemplates.find(t => t.id === blocked.templateId)
    return tpl ? { phase: blocked, template: tpl } : null
  }
  const inProgress = phases.find(p => p.status === 'in_progress')
  if (inProgress) {
    const tpl = phaseTemplates.find(t => t.id === inProgress.templateId)
    return tpl ? { phase: inProgress, template: tpl } : null
  }
  return null
}
