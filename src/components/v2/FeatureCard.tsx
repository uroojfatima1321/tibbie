import { useMemo } from 'react'
import { MoreVertical } from 'lucide-react'
import type { FeatureV2, ProjectV2 } from '../../types'
import { useApp } from '../../store/context'
import { StatusPill } from './StatusPill'
import { format, parseISO } from 'date-fns'

const STALE_DAYS = 90

interface Props {
  feature: FeatureV2
  parentProject: ProjectV2 | null
  parentModule?: { id: string; name: string } | null
  onOpen: () => void
  onKebab: (e: React.MouseEvent) => void
  onOpenParent?: () => void
}

export function FeatureCard({ feature, parentProject, parentModule, onOpen, onKebab, onOpenParent }: Props) {
  const { editMode } = useApp()

  const activityLog: any[] = (feature as any).activityLog || []
  const lastEntry = activityLog[activityLog.length - 1]
  const isActive = lastEntry && (Date.now() - new Date(lastEntry.at).getTime()) < 7 * 86_400_000
  const isStale  = lastEntry && (Date.now() - new Date(lastEntry.at).getTime()) > 30 * 86_400_000

  return (
    <article
      className={`bg-white border border-surface-200 rounded-2xl shadow-card hover:shadow-card-hover transition-shadow cursor-pointer overflow-hidden flex flex-col ${feature.itemType === 'improvement' ? 'border-l-4 border-l-blue-300' : ''}`}
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      role="button"
      aria-label={`Open ${feature.itemType ?? 'feature'} ${feature.name}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2 px-4 pt-4 pb-2">
        <span className="font-sans font-semibold text-[15px] text-ink-900 flex-1 min-w-0 leading-snug">{feature.name}</span>
        <button
          onClick={e => { e.stopPropagation(); onKebab(e) }}
          className="shrink-0 p-1 text-ink-300 hover:text-ink-700 hover:bg-surface-100 rounded-lg transition-colors"
          aria-label="Feature options"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Status + activity dot */}
      <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
        <StatusPill status={feature.status} kind="feature" />
        {lastEntry && (
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isStale ? 'bg-ink-300' : isActive ? 'bg-forest-400' : 'bg-ink-300'}`}
              title={isActive ? 'Active in last 7 days' : isStale ? 'No activity in 30+ days' : ''} />
            <span className="text-ink-400">{format(parseISO(lastEntry.at), 'MMM d')}</span>
          </span>
        )}
        {feature.status === 'on_hold' && feature.holdReason && (
          <span className="text-xs text-ink-500 truncate max-w-[200px]">· {feature.holdReason}</span>
        )}
      </div>

      {/* One-liner */}
      {feature.oneLiner && (
        <p className="px-4 pb-3 font-sans text-[13px] text-ink-600 line-clamp-2 leading-relaxed">
          {feature.oneLiner}
        </p>
      )}

      {/* Parent chip */}
      <div className="px-4 pb-4 mt-auto flex items-center gap-2 flex-wrap">
        {parentProject ? (
          <button
            onClick={e => { e.stopPropagation(); onOpenParent?.() }}
            className="inline-flex items-center gap-1 text-ink-500 bg-surface-100 px-2 py-0.5 rounded-full text-[11px] font-sans hover:bg-surface-200 transition-colors"
            title={parentModule ? `${parentProject.name} · ${parentModule.name}` : parentProject.name}
          >
            ↳ {parentProject.name.length > 14 ? parentProject.name.slice(0, 14) + '…' : parentProject.name}
            {parentModule && (
              <span className="text-ink-400">
                · {parentModule.name.length > 12 ? parentModule.name.slice(0, 12) + '…' : parentModule.name}
              </span>
            )}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-sans">
            Backlog
          </span>
        )}
      </div>
    </article>
  )
}
