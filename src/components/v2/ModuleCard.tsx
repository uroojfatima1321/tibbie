/**
 * ModuleCard — EXC-1 (M5.1 C) + EXC-2 (D)
 * Full project-card anatomy: status pill, one-liner, effort, quarter,
 * owners, in-flight count, department chips, client-timeline chip, kebab.
 */
import { useMemo } from 'react'
import { MoreVertical } from 'lucide-react'
import type { ModuleV2, FeatureV2, Member, ProjectV2 } from '../../types'
import { StatusPill } from './StatusPill'
import { Avatar } from '../members/Avatar'
import { DepartmentChips } from './DepartmentChips'

const TERMINAL_STATUSES = ['shipped', 'killed'] as const

interface Props {
  module_: ModuleV2
  childFeatures: FeatureV2[]
  members: Member[]
  parentProject: ProjectV2 | null   // Item 2: needed for inherited portfolio label
  onOpen: () => void
  onKebab: (e: React.MouseEvent) => void
}

export function ModuleCard({ module_, childFeatures, members, parentProject, onOpen, onKebab }: Props) {
  const owners = members.filter(m => module_.ownerIds.includes(m.id))

  const inFlightCount = useMemo(() =>
    childFeatures.filter(f => !TERMINAL_STATUSES.includes(f.status as any) && !f.archived).length
  , [childFeatures])

  return (
    <article
      className="bg-white border border-surface-200 rounded-2xl shadow-card hover:shadow-card-hover transition-shadow cursor-pointer overflow-hidden flex flex-col"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      role="button"
      aria-label={`Open module ${module_.name}`}
      style={{ borderLeft: '4px solid #7B68EE' }}  // distinct module color
    >
      {/* Header */}
      <div className="flex items-start gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5 mt-0.5 shrink-0">          <span className="font-mono text-[10px] text-ink-400">⬡ M</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-sans font-semibold text-[15px] text-ink-900 leading-snug block truncate">{module_.name}</span>
          {/* Item 2: portfolio label under name — own portfolio or inherited */}
          {(() => {
            const portfolio = module_.portfolio ?? parentProject?.portfolio
            return portfolio ? (
              <span className="text-[10px] text-ink-400 truncate block">{portfolio}</span>
            ) : null
          })()}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onKebab(e) }}
          className="shrink-0 p-1 text-ink-300 hover:text-ink-700 hover:bg-surface-100 rounded-lg transition-colors"
          aria-label="Module options"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Status + chips */}
      <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
        <StatusPill status={module_.status} kind="feature" />
        {module_.clientTimeline && (
          <span className="font-sans text-[10px] font-medium text-amber-600 border border-amber-400 px-1.5 py-0.5 rounded-full"
            title="Timeline has been shared with the client">
            Timeline shared with client
          </span>
        )}
        {module_.status === 'on_hold' && module_.holdReason && (
          <span className="text-xs text-ink-500 truncate max-w-[200px]">· {module_.holdReason}</span>
        )}
      </div>

      {/* Department chips (EXC-2 D) */}
      {module_.tracks && module_.tracks.length > 0 && (
        <div className="px-4 pb-2">
          <DepartmentChips tracks={module_.tracks} />
        </div>
      )}

      {/* One-liner */}
      {module_.oneLiner && (
        <p className="px-4 pb-3 font-sans text-[13px] text-ink-600 line-clamp-2 leading-relaxed">
          {module_.oneLiner}
        </p>
      )}

      {/* Meta row */}
      <div className="px-4 pb-4 mt-auto flex items-center gap-3 flex-wrap">        {module_.targetQuarter && (
          <span className="font-mono text-[10px] text-ink-400">{module_.targetQuarter}</span>
        )}
        {inFlightCount > 0 && (
          <span className="font-mono text-[10px] text-steel-600 bg-steel-50 border border-steel-500/20 px-1.5 py-0.5 rounded-full"
            title={`${inFlightCount} feature${inFlightCount !== 1 ? 's' : ''} in progress`}>
            {inFlightCount} in flight
          </span>
        )}
        {owners.length > 0 && (
          <div className="flex -space-x-1 ml-auto">
            {owners.slice(0, 3).map(m => <Avatar key={m.id} member={m} size="xs" />)}
            {owners.length > 3 && (
              <span className="font-mono text-[10px] text-ink-400 pl-2">+{owners.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
