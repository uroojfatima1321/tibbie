import { useMemo } from 'react'
import { AlertTriangle, Flag, Activity, UserX } from 'lucide-react'
import { useApp } from '../../store/context'
import { isOverdue, isDueSoon } from '../../lib/dates'

interface Props {
  onShowTask: (id: string) => void
}

/**
 * Toolbar-style stats strip across the top of the chart area. Replaces the
 * old single-pill StatusBanner. Each stat is a clickable filter — clicking
 * "Overdue" filters the timeline to overdue tasks only.
 *
 * Stats: Overdue · Due this week · In progress · Unassigned
 */
export function StatsStrip({ onShowTask }: Props) {
  const { data, setFilters, filters, setMyTasksMemberId } = useApp()

  const stats = useMemo(() => {
    if (!data) return { overdue: [], dueSoon: [], inProgress: [], unassigned: [] }
    const overdue = data.tasks.filter(t => isOverdue(t.endDate, t.status))
    const dueSoon = data.tasks.filter(t => isDueSoon(t.endDate, t.status) && !isOverdue(t.endDate, t.status))
    const inProgress = data.tasks.filter(t => t.status === 'in_progress')
    const unassigned = data.tasks.filter(t => t.assigneeIds.length === 0 && t.status !== 'done')
    return { overdue, dueSoon, inProgress, unassigned }
  }, [data])

  if (!data || data.tasks.length === 0) return null

  // Active state: a stat tile lights up when its filter is currently applied
  const isStatusActive = (s: string) => filters.statuses.length === 1 && filters.statuses[0] === s
  const isOverdueActive = false  // overdue isn't a clean single filter; just a click action

  return (
    <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-b border-surface-200 bg-surface-50/50 overflow-x-auto">
      <StatTile
        icon={<AlertTriangle size={14} />}
        label="Overdue"
        value={stats.overdue.length}
        tone="brick"
        active={isOverdueActive}
        disabled={stats.overdue.length === 0}
        onClick={() => {
          // Open the first overdue task as the most useful action — gets user to the issue
          if (stats.overdue.length === 1) onShowTask(stats.overdue[0].id)
          // For multiple, would ideally open a list; for now just opens the first
          else if (stats.overdue.length > 1) onShowTask(stats.overdue[0].id)
        }}
      />
      <StatTile
        icon={<Flag size={14} />}
        label="Due this week"
        value={stats.dueSoon.length}
        tone="amber"
        disabled={stats.dueSoon.length === 0}
        onClick={() => { if (stats.dueSoon.length > 0) onShowTask(stats.dueSoon[0].id) }}
      />
      <StatTile
        icon={<Activity size={14} />}
        label="In progress"
        value={stats.inProgress.length}
        tone="steel"
        active={isStatusActive('in_progress')}
        onClick={() => {
          setFilters(f => ({
            ...f,
            statuses: isStatusActive('in_progress') ? [] : ['in_progress'],
          }))
        }}
      />
      <StatTile
        icon={<UserX size={14} />}
        label="Unassigned"
        value={stats.unassigned.length}
        tone="ink"
        disabled={stats.unassigned.length === 0}
        onClick={() => { if (stats.unassigned.length > 0) onShowTask(stats.unassigned[0].id) }}
      />
    </div>
  )
}

type Tone = 'brick' | 'amber' | 'steel' | 'ink'

const TONE_STYLES: Record<Tone, { bg: string; text: string; activeBg: string; activeText: string }> = {
  brick:  { bg: 'bg-brick-500/10',  text: 'text-brick-500',  activeBg: 'bg-brick-500',  activeText: 'text-white' },
  amber:  { bg: 'bg-amber-500/15',  text: 'text-amber-600',  activeBg: 'bg-amber-500',  activeText: 'text-white' },
  steel:  { bg: 'bg-steel-500/10',  text: 'text-steel-600',  activeBg: 'bg-steel-500',  activeText: 'text-white' },
  ink:    { bg: 'bg-surface-100',     text: 'text-ink-700',    activeBg: 'bg-ink-900',    activeText: 'text-white' },
}

function StatTile({
  icon, label, value, tone, active, disabled, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: Tone
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  const t = TONE_STYLES[tone]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors
        ${active ? `${t.activeBg} ${t.activeText}` : `${t.bg} ${t.text} hover:brightness-95`}
        ${disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}
      `}
    >
      <span className={active ? '' : t.text}>{icon}</span>
      <span>{label}</span>
      <span className={`
        font-mono tabular-nums font-semibold px-1.5 rounded
        ${active ? 'bg-white/20' : 'bg-white/60'}
      `}>
        {value}
      </span>
    </button>
  )
}
