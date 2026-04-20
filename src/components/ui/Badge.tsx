import type { TaskStatus } from '../../types'

const LABELS: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  at_risk: 'At risk',
  done: 'Done',
}

const TONES: Record<TaskStatus, string> = {
  not_started: 'bg-cream-200 text-ink-600',
  in_progress: 'bg-steel-500/10 text-steel-600 border border-steel-500/20',
  at_risk:     'bg-amber-500/15 text-amber-600 border border-amber-500/25',
  done:        'bg-forest-400/15 text-forest-600 border border-forest-400/25',
}

export function StatusBadge({ status, size = 'md' }: { status: TaskStatus; size?: 'sm' | 'md' }) {
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${pad} ${TONES[status]}`}>
      {LABELS[status]}
    </span>
  )
}

export function PercentBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-cream-300 overflow-hidden">
        <div className="h-full bg-forest-500 transition-all" style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs text-ink-500 font-mono tabular-nums w-8 text-right">{p}%</span>
    </div>
  )
}
