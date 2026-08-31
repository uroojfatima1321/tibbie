import { useMemo } from 'react'
import { MoreVertical, Tag, Wrench } from 'lucide-react'
import type { FeatureV2, ProjectV2 } from '../../types'
import { isValidRice, safeRiceScore } from '../../lib/filterV2'
import { StatusPill } from './StatusPill'
import { ValueDots } from './ValueDots'
import { useApp } from '../../store/context'

function riceScore(f: FeatureV2): number | null { return safeRiceScore(f.rice) }
const STALE_DAYS = 90
function isStale(f: FeatureV2): boolean {
  if (!isValidRice(f.rice)) return false
  return (Date.now() - new Date(f.rice.scoredAt).getTime()) > STALE_DAYS * 86_400_000
}

interface Props {
  feature: FeatureV2
  rank: number | null
  totalScored: number
  parentProject: ProjectV2 | null
  parentModule?: { id: string; name: string } | null   // Phase D
  onOpen: () => void
  onKebab: (e: React.MouseEvent) => void
  onOpenParent?: () => void
}

export function FeatureCard({ feature, rank, totalScored, parentProject, parentModule, onOpen, onKebab, onOpenParent }: Props) {
  const { editMode, updateFeatureV2 } = useApp()
  const score = useMemo(() => riceScore(feature), [feature])
  const stale = useMemo(() => isStale(feature), [feature])
  const reworkCount = feature.statusLog.filter(e => e.to === 'rework').length
  const isImprovement = feature.itemType === 'improvement'

  const parentLabel = parentProject
    ? (parentProject.name.length > 18 ? parentProject.name.slice(0, 18) + '…' : parentProject.name)
    : null

  return (
    <article
      className="relative bg-surface-50 rounded-xl border border-dashed border-surface-300 cursor-pointer hover:shadow-card transition-shadow duration-150 overflow-hidden group"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      aria-label={`${isImprovement ? 'Improvement' : 'Feature'}: ${feature.name}`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-2 mb-2">
          {/* Phase B: Must-Do badge replaces rank/Unscored badge */}
          {feature.mustDo ? (
            <span className="shrink-0 font-sans text-[11px] font-semibold bg-brick-600 text-white px-2 py-0.5 rounded-full"
              title={`Must-Do: ${feature.mustDo.reason}`}>
              Must-Do
            </span>
          ) : rank !== null ? (
            <span className="shrink-0 font-mono text-[11px] font-medium bg-rust-500 text-white px-2 py-0.5 rounded-full">
              #{rank} <span className="opacity-60">/ {totalScored}</span>
            </span>
          ) : (
            <span className="shrink-0 font-sans text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
              Unscored
            </span>
          )}
          <span className="font-sans font-semibold text-[15px] text-ink-900 flex-1 min-w-0 leading-snug">{feature.name}</span>
          <button
            onClick={e => { e.stopPropagation(); onKebab(e) }}
            className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface-100 text-ink-400 hover:text-ink-700 transition-all"
            aria-label="More options"
          >
            <MoreVertical size={14} />
          </button>
        </div>

        {/* Status + type */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <StatusPill status={feature.status} kind="feature" reworkGate={feature.reworkFromGate} />
          {/* P-3: item type chip */}
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            isImprovement
              ? 'text-blue-600 bg-blue-50 border border-blue-200'
              : 'text-ink-500 bg-surface-100 border border-surface-200'
          }`}>
            {isImprovement ? <Wrench size={9} /> : <Tag size={9} />}
            {isImprovement ? 'Improvement' : 'Feature'}
          </span>
          {stale && (
            <span className="font-mono text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"
              title={`Scored ${Math.floor((Date.now() - new Date(feature.rice!.scoredAt).getTime()) / (30 * 86_400_000))} months ago — re-validate`}>
              Stale
            </span>
          )}
          {reworkCount >= 2 && (
            <span className="font-mono text-[10px] text-brick-500 bg-white border border-brick-500 px-1.5 py-0.5 rounded-full">
              Rework ×{reworkCount}
            </span>
          )}
        </div>

        {feature.oneLiner && (
          <p className="font-sans text-[13px] text-ink-600 line-clamp-1 mb-2">{feature.oneLiner}</p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* P-4 + Phase D: parent chip — shows project · module when applicable */}
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

          <div className="flex-1" />
          <ValueDots value={feature.valueRating} editable={editMode} onSet={v => updateFeatureV2(feature.id, { valueRating: v })} />
          {feature.effortEstimate && (
            <span className="font-mono text-[11px] text-ink-400">{feature.effortEstimate}</span>
          )}
          {score !== null && (
            <span className="font-mono text-[11px] text-ink-500">{score.toFixed(1)}</span>
          )}
        </div>
      </div>
    </article>
  )
}
