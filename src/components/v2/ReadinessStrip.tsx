import type { ProjectV2, ProjectStatus, DepartmentTrack, TrackKind } from '../../types'

const FINAL_PROJECT: ProjectStatus[] = ['production', 'production_monitoring', 'mvp_live']
const FINAL_TRACK: Record<TrackKind, string> = {
  marketing: 'launched',
  sales: 'selling',
  support: 'live',
  implementation: 'rolled_out',
}
const NOT_STARTED = 'not_started'

const TRACK_LABELS: Record<TrackKind, string> = {
  marketing: 'Marketing',
  sales: 'Sales',
  support: 'Support',
  implementation: 'Implementation',
}

function dotColor(isBlocked: boolean, isFinal: boolean, isNotStarted: boolean): string {
  if (isBlocked) return 'border-2 border-brick-500 bg-white'
  if (isFinal) return 'bg-forest-500'
  if (isNotStarted) return 'bg-ink-300'
  return 'bg-steel-500'
}

function engDot(status: ProjectStatus) {
  const isFinal = FINAL_PROJECT.includes(status)
  const isNotStarted = status === 'intake'
  return dotColor(false, isFinal, isNotStarted)
}

function trackDot(t: DepartmentTrack) {
  const isFinal = t.status === FINAL_TRACK[t.kind]
  const isNotStarted = t.status === NOT_STARTED
  return dotColor(t.blocked, isFinal, isNotStarted)
}

interface Props {
  project: ProjectV2
}

/** Compact dot strip — hidden if project has no tracks (engineering-only) */
export function ReadinessStrip({ project }: Props) {
  if (project.tracks.length === 0) return null

  const dots: { label: string; cls: string; tooltip: string }[] = [
    {
      label: 'E',
      cls: engDot(project.status),
      tooltip: `Engineering · ${project.status.replace(/_/g, ' ')}`,
    },
    ...project.tracks.map(t => ({
      label: t.kind === 'implementation' ? 'I' : t.kind === 'support' ? 'Su' : t.kind[0].toUpperCase(),
      cls: trackDot(t),
      tooltip: `${TRACK_LABELS[t.kind]} · ${t.status.replace(/_/g, ' ')}${t.blocked && t.note ? ` — ${t.note}` : ''}`,
    })),
  ]

  return (
    <div className="flex items-center gap-1" aria-label="Readiness strip">
      {dots.map((d, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.cls} cursor-default`}
          title={d.tooltip}
          aria-label={d.tooltip}
        />
      ))}
    </div>
  )
}
