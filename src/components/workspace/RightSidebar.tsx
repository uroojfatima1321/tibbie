import { useMemo } from 'react'
import { Library, Users } from 'lucide-react'
import { useApp } from '../../store/context'
import { Avatar } from '../members/Avatar'
import type { PhaseStatus } from '../../types'

const PHASE_STATUS_DOT: Record<PhaseStatus, string> = {
  not_started: '#A8A29A',
  in_progress: '#3A6B8A',
  blocked: '#A83D2F',
  done: '#2F5743',
  skipped: '#8B8680',
}

const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  skipped: 'Skipped',
}

const PHASE_STATUSES: PhaseStatus[] = ['not_started', 'in_progress', 'blocked', 'done', 'skipped']

interface SidebarProps {
  onOpenPhaseLibrary: () => void
}

// ─── Shared inner content (used by both desktop sidebar + mobile sheet) ────────
export function SidebarBody({ onOpenPhaseLibrary }: SidebarProps) {
  const { data, activeProjectId, editMode, updateProjectPhase, projectsV2 } = useApp()

  const project = useMemo(
    () => (projectsV2 || []).find(p => p.id === activeProjectId) ?? null,
    [projectsV2, activeProjectId],
  )

  const projectTasks = useMemo(
    () => (data?.tasks || []).filter(t => t.projectId === activeProjectId),
    [data, activeProjectId],
  )

  const phases = useMemo(() => {
    if (!activeProjectId) return []
    return (data?.projectPhases || [])
      .filter(p => p.projectId === activeProjectId)
      .sort((a, b) => a.order - b.order)
      .map(phase => ({
        phase,
        template: data?.phaseTemplates.find(t => t.id === phase.templateId),
      }))
      .filter(p => !!p.template)
  }, [data, activeProjectId])

  const teamMembers = useMemo(() => {
    if (!data || !activeProjectId) return []
    const ids = new Set<string>()
    for (const t of projectTasks) for (const a of t.assigneeIds) ids.add(a)
    return data.members
      .filter(m => ids.has(m.id))
      .map(m => {
        const mt = projectTasks.filter(t => t.assigneeIds.includes(m.id))
        const done = mt.filter(t => t.status === 'done').length
        const inProgress = mt.filter(t => t.status === 'in_progress').length
        const atRisk = mt.filter(t => t.status === 'at_risk').length
        return { member: m, total: mt.length, done, inProgress, atRisk }
      })
  }, [data, activeProjectId, projectTasks])

  if (!activeProjectId || !project) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-xs text-ink-400">Select a project to see phases and resources.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-surface-100">
      {/* Project label */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <span className="w-2 h-4 rounded-full shrink-0" style={{ backgroundColor: project.color ?? '#8B8680' }} />
        <span className="text-xs font-semibold text-ink-900 truncate">{project.name}</span>
      </div>

      {/* Phases */}
      <section className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 flex items-center gap-1">
            <Library size={10} /> Phases
          </span>
          {editMode && (
            <button onClick={onOpenPhaseLibrary} className="text-[10px] text-ink-400 hover:text-ink-700 transition-colors">
              Manage
            </button>
          )}
        </div>

        {phases.length === 0 ? (
          <p className="text-xs text-ink-400 py-1">No phases on this project.</p>
        ) : (
          <div className="space-y-0.5">
            {phases.map(({ phase, template }) => (
              <div key={phase.id} className="group flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-surface-50 transition-colors">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: PHASE_STATUS_DOT[phase.status] }}
                />
                <span className="text-xs text-ink-800 flex-1 truncate">{template!.name}</span>
                {editMode ? (
                  <select
                    value={phase.status}
                    onChange={e => updateProjectPhase(phase.id, { status: e.target.value as PhaseStatus })}
                    onClick={e => e.stopPropagation()}
                    className="text-[10px] text-ink-500 bg-transparent border-0 outline-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity max-w-[80px]"
                  >
                    {PHASE_STATUSES.map(s => (
                      <option key={s} value={s}>{PHASE_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[10px] text-ink-400 hidden group-hover:inline">{PHASE_STATUS_LABELS[phase.status]}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resources */}
      <section className="p-3">
        <div className="flex items-center gap-1 mb-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 flex items-center gap-1">
            <Users size={10} /> Resources
          </span>
        </div>

        {teamMembers.length === 0 ? (
          <p className="text-xs text-ink-400 py-1">No members assigned.</p>
        ) : (
          <div className="space-y-2.5">
            {teamMembers.map(({ member, total, done, inProgress, atRisk }) => (
              <div key={member.id} className="flex items-center gap-2">
                <Avatar member={member} size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-ink-800 truncate">{member.name}</div>
                  <div className="mt-1 flex gap-1 items-center">
                    <div className="h-1 flex-1 rounded-full bg-surface-200 overflow-hidden flex">
                      {total > 0 && <>
                        <div className="h-full bg-forest-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
                        <div className="h-full bg-sky-500 transition-all" style={{ width: `${(inProgress / total) * 100}%` }} />
                        <div className="h-full bg-amber-400 transition-all" style={{ width: `${(atRisk / total) * 100}%` }} />
                      </>}
                    </div>
                    <span className="text-[10px] text-ink-400 shrink-0">{total}t</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              {[
                { color: 'bg-forest-500', label: 'Done' },
                { color: 'bg-sky-500', label: 'Active' },
                { color: 'bg-amber-400', label: 'At risk' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1 text-[9px] text-ink-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Desktop persistent sidebar ────────────────────────────────────────────────
export function RightSidebar({ onOpenPhaseLibrary }: SidebarProps) {
  const { activeProjectId } = useApp()

  return (
    <div className={`hidden lg:flex w-56 xl:w-64 shrink-0 border-l border-surface-200 bg-white flex-col overflow-hidden transition-all ${activeProjectId ? '' : 'opacity-60'}`}>
      <div className="flex-1 overflow-y-auto tibbie-scroll">
        <SidebarBody onOpenPhaseLibrary={onOpenPhaseLibrary} />
      </div>
    </div>
  )
}
