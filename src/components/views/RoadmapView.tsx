import { useMemo } from 'react'
import { parseISO, format, differenceInCalendarDays, addDays, isBefore, isAfter, startOfMonth } from 'date-fns'
import { Flag, ArrowRight } from 'lucide-react'
import { useApp } from '../../store/context'
import { today, fmtLong, isOverdue } from '../../lib/dates'

/**
 * Roadmap view: milestones across all projects on one horizontal track.
 * Designed for stakeholder presentations — minimal chrome, large readable
 * milestone diamonds, project name + date inline, project color coded.
 */
export function RoadmapView({ onMilestoneClick }: { onMilestoneClick: (taskId: string) => void }) {
  const { data, projectsV2 } = useApp()

  const milestones = useMemo(() => {
    if (!data) return []
    return data.tasks
      .filter(t => t.isMilestone)
      .map(t => {
        const project = (projectsV2 || []).find(p => p.id === t.projectId) ?? null
        return { task: t, project }
      })
      .filter(m => !!m.project)
      .sort((a, b) => a.task.startDate.localeCompare(b.task.startDate))
  }, [data])

  // Date range derived from milestone dates plus today, with padding
  const { rangeStart, totalDays, dayWidth } = useMemo(() => {
    const todayD = parseISO(today())
    if (milestones.length === 0) {
      return { rangeStart: addDays(todayD, -30), totalDays: 90, dayWidth: 14 }
    }
    let min = parseISO(milestones[0].task.startDate)
    let max = parseISO(milestones[0].task.startDate)
    for (const m of milestones) {
      const d = parseISO(m.task.startDate)
      if (isBefore(d, min)) min = d
      if (isAfter(d, max)) max = d
    }
    // Include today in the range so the "you are here" marker is always meaningful
    if (isBefore(todayD, min)) min = todayD
    if (isAfter(todayD, max)) max = todayD
    const padded = { s: addDays(min, -7), e: addDays(max, 14) }
    const total = differenceInCalendarDays(padded.e, padded.s) + 1
    // Scale day width to fit roughly within typical screen
    // Long ranges → narrower days; short ranges → wider days
    const dw = total > 365 ? 4 : total > 180 ? 6 : total > 90 ? 9 : total > 30 ? 14 : 28
    return { rangeStart: padded.s, totalDays: total, dayWidth: dw }
  }, [milestones])

  const monthBands = useMemo(() => {
    const bands: { x: number; width: number; label: string; year: number }[] = []
    if (totalDays === 0) return bands
    let cursor = startOfMonth(rangeStart)
    while (differenceInCalendarDays(cursor, addDays(rangeStart, totalDays)) <= 0) {
      const monthStartOff = differenceInCalendarDays(cursor, rangeStart)
      const nextMonth = startOfMonth(addDays(cursor, 32))
      const monthEndOff = differenceInCalendarDays(nextMonth, rangeStart)
      const startX = Math.max(0, monthStartOff) * dayWidth
      const endX = Math.min(totalDays, monthEndOff) * dayWidth
      if (endX > startX) {
        bands.push({
          x: startX,
          width: endX - startX,
          label: format(cursor, 'MMMM').toUpperCase(),
          year: cursor.getFullYear(),
        })
      }
      cursor = nextMonth
    }
    return bands
  }, [rangeStart, totalDays, dayWidth])

  const monthBandsWithYear = useMemo(() => {
    let lastYear: number | null = null
    return monthBands.map(b => {
      const showYear = b.year !== lastYear
      lastYear = b.year
      return { ...b, showYear }
    })
  }, [monthBands])

  const todayX = useMemo(() => {
    const off = differenceInCalendarDays(parseISO(today()), rangeStart)
    if (off < 0 || off > totalDays) return null
    return off * dayWidth
  }, [rangeStart, totalDays, dayWidth])

  const totalWidth = totalDays * dayWidth

  if (!data || ((data.projects.length === 0) && !(projectsV2 || []).length)) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center">
        <p className="text-sm text-ink-500">Add projects and milestones to build a roadmap.</p>
      </div>
    )
  }

  if (milestones.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
          <Flag className="text-ink-400" size={28} />
        </div>
        <h3 className="font-display text-xl font-semibold text-ink-900 mb-1">No milestones yet</h3>
        <p className="text-sm text-ink-500 max-w-sm">
          The roadmap shows milestone-only — the dates that matter for stakeholders.
          Mark a task as a milestone in the task panel to add it here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="px-6 py-4 border-b border-surface-200">
        <h2 className="font-display text-2xl font-semibold text-ink-900">Roadmap</h2>
        <p className="text-sm text-ink-500 mt-0.5">Milestones across all projects — best for stakeholder discussions.</p>
      </div>

      <div className="flex-1 overflow-auto tibbie-scroll">
        <div className="min-w-full py-8 px-6" style={{ width: Math.max(totalWidth + 48, 800) }}>
          {/* Month header */}
          <div className="relative h-10 mb-2" style={{ width: totalWidth }}>
            <svg width={totalWidth} height={32} className="block">
              {monthBandsWithYear.map((b, i) => (
                <g key={i}>
                  <rect x={b.x} y={0} width={b.width} height={28} fill={i % 2 === 0 ? '#E8E7E4' : '#FFFFFF'} rx={4} />
                  <line x1={b.x} y1={28} x2={b.x} y2={32} stroke="#A8A29A" strokeWidth={1} />
                  <text x={b.x + 10} y={18} fontSize={11} fill="#2F2A24" fontFamily="Manrope" fontWeight={600} letterSpacing={0.6}>
                    {b.label}
                    {b.showYear && <tspan dx={6} fill="#8B8680" fontWeight={500} fontSize={10}>{b.year}</tspan>}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Timeline track */}
          <div className="relative" style={{ width: totalWidth, minHeight: 220 }}>
            <svg width={totalWidth} height={220} className="absolute inset-0">
              {/* Spine */}
              <line x1={0} y1={110} x2={totalWidth} y2={110} stroke="#A8A29A" strokeWidth={2} strokeLinecap="round" />

              {/* Today marker */}
              {todayX != null && (
                <g>
                  <line x1={todayX} y1={20} x2={todayX} y2={200} stroke="#C65D3B" strokeWidth={1.5} strokeDasharray="4 3" />
                  <rect x={todayX - 22} y={4} width={44} height={16} rx={8} fill="#C65D3B" />
                  <text x={todayX} y={15} textAnchor="middle" fontSize={9.5} fill="#FFFFFF" fontFamily="Manrope" fontWeight={700} letterSpacing={0.4}>
                    TODAY
                  </text>
                </g>
              )}

              {/* Milestones — alternate above/below spine so labels don't collide on packed timelines */}
              {milestones.map((m, idx) => {
                if (!m.project) return null
                const x = differenceInCalendarDays(parseISO(m.task.startDate), rangeStart) * dayWidth
                const above = idx % 2 === 0
                const isPast = m.task.status === 'done' || isBefore(parseISO(m.task.startDate), parseISO(today()))
                const labelY = above ? 70 : 175
                const lineY1 = above ? 78 : 130
                const lineY2 = above ? 105 : 122
                const diamondSize = 16

                return (
                  <g
                    key={m.task.id}
                    onClick={() => onMilestoneClick(m.task.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Connector line from spine to label */}
                    <line x1={x} y1={lineY1} x2={x} y2={lineY2} stroke={m.project.color} strokeWidth={1.5} opacity={0.5} />

                    {/* Diamond on the spine */}
                    <g transform={`translate(${x}, 110)`}>
                      <polygon
                        points={`0,${-diamondSize/2} ${diamondSize/2},0 0,${diamondSize/2} ${-diamondSize/2},0`}
                        fill={m.project.color}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        opacity={isPast ? 0.8 : 1}
                      />
                      {m.task.status === 'done' && (
                        // Subtle inner dot to mark "achieved"
                        <circle cx={0} cy={0} r={3} fill="#FFFFFF" />
                      )}
                    </g>

                    {/* Label group */}
                    <g transform={`translate(${x}, ${labelY})`}>
                      <rect
                        x={-90} y={above ? 0 : -36}
                        width={180} height={36} rx={6}
                        fill={isPast ? '#FFFFFF' : '#FFFFFF'}
                        stroke={m.project.color}
                        strokeWidth={1}
                        opacity={isPast ? 0.85 : 1}
                      />
                      <text
                        x={-84} y={above ? 14 : -22}
                        fontSize={11} fontFamily="Manrope" fontWeight={600}
                        fill="#171512"
                      >
                        {m.task.name.length > 28 ? m.task.name.slice(0, 27) + '…' : m.task.name}
                      </text>
                      <text
                        x={-84} y={above ? 28 : -8}
                        fontSize={10} fontFamily="Manrope" fontWeight={500}
                        fill="#57524C"
                      >
                        <tspan fill={m.project.color} fontWeight={600}>{m.project.name.length > 18 ? m.project.name.slice(0, 17) + '…' : m.project.name}</tspan>
                        <tspan dx={6}>·</tspan>
                        <tspan dx={4}>{format(parseISO(m.task.startDate), 'd MMM')}</tspan>
                      </text>
                    </g>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Legend below timeline */}
          <div className="mt-12 pt-4 border-t border-surface-200 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-ink-600">
            <span className="font-semibold uppercase tracking-wider text-ink-500">Projects</span>
            {(projectsV2 || [])
              .filter(p => milestones.some(m => m.project?.id === p.id))
              .map(p => (
                <span key={p.id} className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rotate-45" style={{ backgroundColor: p.color ?? '#8B8680' }} />
                  {p.name}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
