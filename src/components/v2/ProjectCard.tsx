import { useMemo } from 'react'
import { MoreVertical } from 'lucide-react'
import type { ProjectV2, FeatureV2, Member } from '../../types'
import { StatusPill, statusBorderColor } from './StatusPill'
import { ReadinessStrip } from './ReadinessStrip'
import { Avatar } from '../members/Avatar'
import { useApp } from '../../store/context'
import { LIVE_GROUP_STATUSES } from '../../lib/filterV2'

const TERMINAL_STATUSES = ['shipped', 'killed']

interface Props {
  project: ProjectV2
  index: number
  features: FeatureV2[]
  members: Member[]
  onOpen: () => void
  onKebab: (e: React.MouseEvent) => void
}

export function ProjectCard({ project, index, features, members, onOpen, onKebab }: Props) {
  const { editMode, updateProjectV2, modulesV2 } = useApp()
  const owners = useMemo(
    () => members.filter(m => project.ownerIds.includes(m.id)),
    [members, project.ownerIds],
  )

  const nextMilestone = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return project.milestones
      .filter(m => m.status === 'upcoming' && m.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  }, [project.milestones])

  const holdDays = useMemo(() => {
    if (project.status !== 'on_hold') return 0
    const entry = [...project.statusLog].reverse().find(e => e.to === 'on_hold')
    if (!entry) return 0
    return Math.floor((Date.now() - new Date(entry.at).getTime()) / 86_400_000)
  }, [project.status, project.statusLog])

  const borderColor = statusBorderColor(project.status)
  const num = String(index + 1).padStart(2, '0')

  // P-5 + Phase D: "in flight" count — features + modules in non-terminal status
  const inFlightCount = useMemo(() => {
    if (!LIVE_GROUP_STATUSES.includes(project.status)) return 0
    const projectModules = modulesV2.filter(m => m.projectId === project.id)
    const liveFeatures = features.filter(f => !TERMINAL_STATUSES.includes(f.status) && !f.archived).length
    const liveModules  = projectModules.filter(m => !TERMINAL_STATUSES.includes(m.status) && !m.archived).length
    return liveFeatures + liveModules
  }, [project.status, features, modulesV2, project.id])

  return (
    <article
      className="relative bg-white rounded-xl shadow-card border border-surface-200 cursor-pointer hover:shadow-float transition-shadow duration-150 overflow-hidden group"
      style={{ borderLeft: `3px solid ${borderColor}` }}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      aria-label={`Project: ${project.name}`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
          <span className="font-mono text-xs text-ink-400">◆ {num}</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-sans font-semibold text-[15px] text-ink-900 leading-snug block truncate">{project.name}</span>
          {/* Item 2: portfolio label — brief confirms projects also need it */}
          <span className="text-[10px] text-ink-400 truncate block">{project.portfolio}</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onKebab(e) }}
          className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface-100 text-ink-400 hover:text-ink-700 transition-all"
          aria-label="More options"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Status pill + hold reason + clientTimeline chip */}
      <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
        <StatusPill status={project.status} kind="project" />
        {/* Phase B: client timeline caution chip */}
        {project.clientTimeline && (
          <span className="font-sans text-[10px] font-medium text-amber-600 border border-amber-400 px-1.5 py-0.5 rounded-full"
            title="Timeline has been shared with the client — date changes need communication">
            Timeline shared with client
          </span>
        )}
        {project.status === 'on_hold' && project.holdReason && (
          <span className="text-xs text-ink-500 truncate max-w-[200px]">· {project.holdReason}</span>
        )}
        {holdDays > 60 && (
          <span className="font-mono text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            On hold {holdDays}d
          </span>
        )}
      </div>

      {/* EXC-2 (D) + BUG-2 (B): department readiness chips.
          Replaces the track dot-strip that was dropped in Phase B/C card rewrites. */}
      {project.tracks && project.tracks.length > 0 && (
        <div className="px-4 pb-2">
        </div>
      )}

      {/* oneLiner */}
      {project.oneLiner && (
        <p className="px-4 pb-3 font-sans text-[13px] text-ink-600 line-clamp-2 leading-relaxed">
          {project.oneLiner}
        </p>
      )}

      {/* Meta line 1: feature count + in-flight chip + top RICE */}
      <div className="px-4 pb-1 flex items-center gap-3 text-xs text-ink-500">
        {/* Item 6: Active dot + last updated */}
        {(() => {
          const log: any[] = (project as any).activityLog || []
          const lastEntry = log[log.length - 1]
          const isActive = lastEntry && (Date.now() - new Date(lastEntry.at).getTime()) < 7 * 86_400_000
          const isStale  = lastEntry && (Date.now() - new Date(lastEntry.at).getTime()) > 30 * 86_400_000
          return lastEntry ? (
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isStale ? 'bg-ink-300' : isActive ? 'bg-forest-400' : 'bg-ink-300'}`} title={isActive ? 'Active in last 7 days' : isStale ? 'No activity in 30+ days' : ''} />
              <span className="text-ink-400">
                {new Date(lastEntry.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            </span>
          ) : null
        })()}
        <span>◇ {features.length} feature{features.length !== 1 ? 's' : ''}</span>
        {inFlightCount > 0 && (
          <span
            className="font-mono text-[10px] text-steel-600 bg-steel-50 border border-steel-500/20 px-1.5 py-0.5 rounded-full"
            title={`${inFlightCount} feature${inFlightCount !== 1 ? 's' : ''}/improvement${inFlightCount !== 1 ? 's' : ''} in progress inside this shipped product`}
          >
            {inFlightCount} in flight
          </span>
        )}
      </div>

      {/* Meta line 2: next milestone */}
      {nextMilestone && (
        <div className="px-4 pb-1 text-xs text-ink-600">
          ▸ Next: <span className="font-medium">{nextMilestone.name}</span>{' '}
          <span className="font-mono text-ink-400">
            — {new Date(nextMilestone.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      )}

      {/* Footer: owners · strip · quarter */}
      <div className="px-4 py-3 mt-1 border-t border-surface-100 flex items-center gap-2 flex-wrap">
        <ReadinessStrip project={project} />
        {owners.length > 0 && (
          <div className="flex items-center -space-x-1">
            {owners.slice(0, 3).map(m => <Avatar key={m.id} member={m} size="xs" />)}
            {owners.length > 3 && <span className="font-mono text-[10px] text-ink-400 pl-2">+{owners.length - 3}</span>}
          </div>
        )}
        <div className="flex-1" />
        {project.targetQuarter && <span className="font-mono text-[11px] text-ink-500 font-medium">{project.targetQuarter}</span>}
      </div>
    </article>
  )
}
