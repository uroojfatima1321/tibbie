/**
 * DepartmentChips — EXC-2 (M5.1 D)
 * Labeled chips: Mkt · Sales · Sup · Impl, shown on project AND module cards.
 * Colors derive from track readiness (not_started=gray / in_progress=steel /
 * final=forest / blocked=brick-ring). Max 4 + overflow. Tooltip per chip.
 */
import type { DepartmentTrack, TrackKind } from '../../types'

const CHIP_LABELS: Record<TrackKind, string> = {
  marketing:      'Mkt',
  sales:          'Sales',
  support:        'Sup',
  implementation: 'Impl',
}

const FINAL_RUNGS: Record<TrackKind, string> = {
  marketing:      'launched',
  sales:          'selling',
  support:        'live',
  implementation: 'rolled_out',
}

const STATUS_LABELS: Record<string, string> = {
  not_started:       'Not started',
  positioning:       'Positioning',
  collateral_ready:  'Collateral ready',
  launched:          'Launched',
  deck_pricing_ready:'Deck & pricing ready',
  team_trained:      'Team trained',
  selling:           'Selling',
  docs_written:      'Docs written',
  live:              'Live',
  deployment_plan:   'Deployment plan',
  pilot_client:      'Pilot client',
  rolled_out:        'Rolled out',
}

type DisplayStatus = 'not_started' | 'in_progress' | 'final' | 'blocked'

function trackDisplayStatus(t: DepartmentTrack): DisplayStatus {
  if (t.blocked) return 'blocked'
  if (t.status === 'not_started' || !t.status) return 'not_started'
  if (FINAL_RUNGS[t.kind] === t.status) return 'final'
  return 'in_progress'
}

const CHIP_CLASSES: Record<DisplayStatus, string> = {
  not_started: 'text-ink-400 bg-surface-100 border-surface-200',
  in_progress: 'text-steel-600 bg-steel-50 border-steel-500/30',
  final:       'text-forest-600 bg-forest-50 border-forest-500/20',
  blocked:     'text-brick-600 bg-white border-brick-400 border-dashed',
}

interface Props {
  tracks: DepartmentTrack[]
  className?: string
}

export function DepartmentChips({ tracks, className = '' }: Props) {
  if (!tracks || tracks.length === 0) return null

  const MAX_VISIBLE = 4
  const visible = tracks.slice(0, MAX_VISIBLE)
  const overflow = tracks.length - MAX_VISIBLE

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {visible.map(t => {
        const ds = trackDisplayStatus(t)
        const statusLabel = STATUS_LABELS[t.status] ?? t.status?.replace(/_/g, ' ')
        const tip = `${t.kind.charAt(0).toUpperCase() + t.kind.slice(1)}: ${statusLabel}${t.blocked ? ' (blocked)' : ''}${t.note ? ' — ' + t.note : ''}`
        return (
          <span key={t.kind}
            className={`font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none ${CHIP_CLASSES[ds]}`}
            title={tip}
          >
            {CHIP_LABELS[t.kind]}
          </span>
        )
      })}
      {overflow > 0 && (
        <span className="font-mono text-[10px] text-ink-400">+{overflow}</span>
      )}
    </div>
  )
}
