import { useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { parseISO, differenceInCalendarDays, addDays, format, startOfWeek, startOfMonth, isBefore, isAfter, isSameMonth } from 'date-fns'
import type { Task, Project, Member, Dependency, ZoomLevel, GroupBy, TaskStatus } from '../../types'
import { useApp } from '../../store/context'
import { Avatar } from '../members/Avatar'
import { computeCriticalPath } from '../../lib/cpm'
import { isOverdue, isDueSoon, overlapsRange, today } from '../../lib/dates'
import { initials } from '../../lib/util'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { AlertTriangle, Flag, StickyNote } from 'lucide-react'

interface Props {
  onTaskClick: (taskId: string) => void
}

export interface GanttHandle {
  getChartElement: () => HTMLDivElement | null
}

// Column widths per zoom level (px per day)
const DAY_WIDTH: Record<ZoomLevel, number> = { day: 40, week: 14, month: 4 }

const STATUS_FILL: Record<TaskStatus, string> = {
  not_started: '#A8A29A',
  in_progress: '#3A6B8A',
  at_risk: '#C8932F',
  done: '#2F5743',
}

export const GanttView = forwardRef<GanttHandle, Props>(function GanttView({ onTaskClick }, ref) {
  const { data, filters, groupBy, zoom, myTasksMemberId } = useApp()
  const isMobile = useIsMobile()
  const chartRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    getChartElement: () => chartRef.current,
  }))

  const dayWidth = DAY_WIDTH[zoom]
  const rowHeight = isMobile ? 44 : 40
  const leftColWidth = isMobile ? 140 : 220

  // Apply filters + My Tasks
  const filteredTasks = useMemo(() => {
    if (!data) return []
    return data.tasks.filter(t => {
      if (myTasksMemberId && !t.assigneeIds.includes(myTasksMemberId)) return false
      if (filters.projectIds.length && !filters.projectIds.includes(t.projectId)) return false
      if (filters.statuses.length && !filters.statuses.includes(t.status)) return false
      if (filters.memberIds.length && !t.assigneeIds.some(a => filters.memberIds.includes(a))) return false
      if (!overlapsRange(t.startDate, t.endDate, filters.dateRange.start, filters.dateRange.end)) return false
      return true
    })
  }, [data, filters, myTasksMemberId])

  // Determine chart date range
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    if (filteredTasks.length === 0) {
      const t = parseISO(today())
      return { rangeStart: addDays(t, -7), rangeEnd: addDays(t, 30), totalDays: 38 }
    }
    let min = parseISO(filteredTasks[0].startDate)
    let max = parseISO(filteredTasks[0].endDate)
    for (const t of filteredTasks) {
      const s = parseISO(t.startDate), e = parseISO(t.endDate)
      if (isBefore(s, min)) min = s
      if (isAfter(e, max)) max = e
    }
    const padded = { s: addDays(min, -3), e: addDays(max, 7) }
    return { rangeStart: padded.s, rangeEnd: padded.e, totalDays: differenceInCalendarDays(padded.e, padded.s) + 1 }
  }, [filteredTasks])

  // Critical path
  const criticalSet = useMemo(
    () => data ? computeCriticalPath(filteredTasks, data.dependencies) : new Set<string>(),
    [filteredTasks, data],
  )

  // Group rows
  const rows = useMemo(() => {
    if (!data) return []
    type Row = { kind: 'group'; label: string; color?: string; count: number } | { kind: 'task'; task: Task }
    const out: Row[] = []

    if (groupBy === 'project') {
      const byProject = new Map<string, Task[]>()
      for (const t of filteredTasks) {
        if (!byProject.has(t.projectId)) byProject.set(t.projectId, [])
        byProject.get(t.projectId)!.push(t)
      }
      for (const p of data.projects) {
        const list = byProject.get(p.id)
        if (!list || list.length === 0) continue
        out.push({ kind: 'group', label: p.name, color: p.color, count: list.length })
        for (const t of list.sort((a, b) => a.startDate.localeCompare(b.startDate))) {
          out.push({ kind: 'task', task: t })
        }
      }
    } else if (groupBy === 'assignee') {
      const byMember = new Map<string, Task[]>()
      for (const t of filteredTasks) {
        if (t.assigneeIds.length === 0) {
          if (!byMember.has('__unassigned')) byMember.set('__unassigned', [])
          byMember.get('__unassigned')!.push(t)
        } else {
          for (const a of t.assigneeIds) {
            if (!byMember.has(a)) byMember.set(a, [])
            byMember.get(a)!.push(t)
          }
        }
      }
      for (const m of data.members) {
        const list = byMember.get(m.id)
        if (!list || list.length === 0) continue
        out.push({ kind: 'group', label: m.name, color: m.color, count: list.length })
        for (const t of list.sort((a, b) => a.startDate.localeCompare(b.startDate))) {
          out.push({ kind: 'task', task: t })
        }
      }
      const unassigned = byMember.get('__unassigned')
      if (unassigned && unassigned.length) {
        out.push({ kind: 'group', label: 'Unassigned', count: unassigned.length })
        for (const t of unassigned.sort((a, b) => a.startDate.localeCompare(b.startDate))) {
          out.push({ kind: 'task', task: t })
        }
      }
    } else {
      for (const t of filteredTasks.sort((a, b) => a.startDate.localeCompare(b.startDate))) {
        out.push({ kind: 'task', task: t })
      }
    }
    return out
  }, [filteredTasks, data, groupBy])

  // Build time-axis ticks based on zoom
  const ticks = useMemo(() => {
    const out: { x: number; label: string; major: boolean }[] = []
    let cursor = rangeStart
    if (zoom === 'day') {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(rangeStart, i)
        out.push({ x: i * dayWidth, label: format(d, 'd'), major: format(d, 'd') === '1' })
      }
    } else if (zoom === 'week') {
      cursor = startOfWeek(rangeStart, { weekStartsOn: 1 })
      let i = Math.max(0, differenceInCalendarDays(cursor, rangeStart))
      while (i < totalDays) {
        const d = addDays(rangeStart, i)
        out.push({ x: i * dayWidth, label: format(d, 'd MMM'), major: format(d, 'd') === '1' })
        i += 7
      }
    } else {
      cursor = startOfMonth(rangeStart)
      let currMonth = cursor
      while (differenceInCalendarDays(currMonth, rangeEnd) <= 0) {
        const offset = differenceInCalendarDays(currMonth, rangeStart)
        if (offset >= 0 && offset < totalDays) {
          out.push({ x: offset * dayWidth, label: format(currMonth, 'MMM'), major: isSameMonth(currMonth, new Date(currMonth.getFullYear(), 0, 1)) })
        }
        currMonth = addDays(startOfMonth(addDays(currMonth, 32)), 0)
      }
    }
    return out
  }, [rangeStart, rangeEnd, totalDays, dayWidth, zoom])

  // Today indicator X
  const todayX = useMemo(() => {
    const t = parseISO(today())
    const off = differenceInCalendarDays(t, rangeStart)
    if (off < 0 || off > totalDays) return null
    return off * dayWidth
  }, [rangeStart, totalDays, dayWidth])

  // Dependency arrows
  const arrowPaths = useMemo(() => {
    if (!data) return []
    const taskY = new Map<string, number>()
    rows.forEach((r, i) => { if (r.kind === 'task') taskY.set(r.task.id, i * rowHeight + rowHeight / 2) })

    return data.dependencies.flatMap(d => {
      const p = filteredTasks.find(t => t.id === d.predecessorId)
      const s = filteredTasks.find(t => t.id === d.successorId)
      if (!p || !s) return []
      const py = taskY.get(p.id); const sy = taskY.get(s.id)
      if (py == null || sy == null) return []
      const px = (differenceInCalendarDays(parseISO(p.endDate), rangeStart) + 1) * dayWidth
      const sx = differenceInCalendarDays(parseISO(s.startDate), rangeStart) * dayWidth
      const mx = (px + sx) / 2
      const isCrit = criticalSet.has(p.id) && criticalSet.has(s.id)
      return [{
        d: `M ${px} ${py} C ${mx} ${py}, ${mx} ${sy}, ${sx} ${sy}`,
        critical: isCrit,
        key: `${p.id}__${s.id}`,
      }]
    })
  }, [data, rows, filteredTasks, rangeStart, dayWidth, rowHeight, criticalSet])

  const totalWidth = totalDays * dayWidth
  const totalHeight = rows.length * rowHeight

  if (!data) return null

  if (filteredTasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-cream-200 flex items-center justify-center mb-4">
          <Flag className="text-ink-400" size={28} />
        </div>
        <h3 className="font-display text-xl font-semibold text-ink-900 mb-1">No tasks to show</h3>
        <p className="text-sm text-ink-500 max-w-sm">
          {data.tasks.length === 0
            ? 'Add your first project and task to see the timeline here.'
            : 'Adjust your filters or clear them to see tasks.'}
        </p>
      </div>
    )
  }

  return (
    <div ref={chartRef} className="flex-1 flex overflow-hidden bg-cream-50">
      {/* Sticky left column: task names */}
      <div className="shrink-0 border-r border-cream-300 bg-cream-50 overflow-hidden flex flex-col" style={{ width: leftColWidth }}>
        {/* Header spacer */}
        <div className="h-10 border-b border-cream-300 flex items-end px-3 pb-1.5">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Task</span>
        </div>
        <div className="tibbie-scroll overflow-y-auto" style={{ height: 'calc(100% - 2.5rem)' }}>
          <div style={{ height: totalHeight }}>
            {rows.map((r, i) => {
              if (r.kind === 'group') {
                return (
                  <div key={`g-${i}`} className="flex items-center gap-2 px-3 border-b border-cream-200 bg-cream-100/80" style={{ height: rowHeight }}>
                    {r.color && <span className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />}
                    <span className="font-semibold text-xs text-ink-900 truncate flex-1">{r.label}</span>
                    <span className="text-[10px] text-ink-400 shrink-0">{r.count}</span>
                  </div>
                )
              }
              const t = r.task
              const project = data.projects.find(p => p.id === t.projectId)
              const overdue = isOverdue(t.endDate, t.status)
              return (
                <button
                  key={t.id}
                  onClick={() => onTaskClick(t.id)}
                  className="w-full flex items-center gap-2 px-3 border-b border-cream-200 hover:bg-cream-100 text-left group"
                  style={{ height: rowHeight }}
                  title={t.name}
                >
                  {project && <span className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
                  <span className="text-xs text-ink-900 truncate flex-1 group-hover:text-rust-600">{t.name}</span>
                  {overdue && <AlertTriangle size={12} className="text-brick-500 shrink-0" />}
                  {t.notes && <StickyNote size={11} className="text-ink-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right: scrolling chart */}
      <div className="flex-1 overflow-auto tibbie-scroll relative">
        <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>
          {/* Time axis header */}
          <div className="sticky top-0 z-10 h-10 bg-cream-50/95 backdrop-blur border-b border-cream-300">
            <svg width={totalWidth} height={40} className="block">
              {ticks.map((t, i) => (
                <g key={i}>
                  <line x1={t.x} y1={28} x2={t.x} y2={40} stroke={t.major ? '#A8A29A' : '#EAE4D9'} strokeWidth={t.major ? 1 : 1} />
                  <text x={t.x + 4} y={22} fontSize={10} fill="#57524C" fontFamily="Manrope">{t.label}</text>
                </g>
              ))}
              {todayX != null && (
                <line x1={todayX} y1={0} x2={todayX} y2={40} stroke="#C65D3B" strokeWidth={1.5} strokeDasharray="3 3" />
              )}
            </svg>
          </div>

          {/* Grid + bars */}
          <svg width={totalWidth} height={totalHeight} className="block">
            {/* Row backgrounds */}
            {rows.map((r, i) => (
              <rect
                key={`bg-${i}`}
                x={0} y={i * rowHeight}
                width={totalWidth} height={rowHeight}
                fill={r.kind === 'group' ? '#F4EFE4' : (i % 2 === 0 ? '#FDFBF6' : 'transparent')}
              />
            ))}
            {/* Vertical gridlines */}
            {ticks.map((t, i) => (
              <line
                key={`v-${i}`}
                x1={t.x} y1={0} x2={t.x} y2={totalHeight}
                stroke={t.major ? '#EAE4D9' : '#F4EFE4'}
              />
            ))}
            {/* Row dividers */}
            {rows.map((_, i) => (
              <line key={`h-${i}`} x1={0} y1={(i + 1) * rowHeight} x2={totalWidth} y2={(i + 1) * rowHeight} stroke="#EAE4D9" />
            ))}
            {/* Today line */}
            {todayX != null && (
              <line x1={todayX} y1={0} x2={todayX} y2={totalHeight} stroke="#C65D3B" strokeWidth={1.5} strokeDasharray="3 3" />
            )}

            {/* Dependency arrows */}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#8B8680" />
              </marker>
              <marker id="arrow-crit" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#A83D2F" />
              </marker>
            </defs>
            {arrowPaths.map(a => (
              <path
                key={a.key}
                d={a.d}
                fill="none"
                stroke={a.critical ? '#A83D2F' : '#8B8680'}
                strokeWidth={a.critical ? 1.75 : 1}
                markerEnd={`url(#${a.critical ? 'arrow-crit' : 'arrow'})`}
                opacity={a.critical ? 0.9 : 0.6}
              />
            ))}

            {/* Task bars */}
            {rows.map((r, i) => {
              if (r.kind !== 'task') return null
              const t = r.task
              const startOff = differenceInCalendarDays(parseISO(t.startDate), rangeStart)
              const duration = Math.max(1, differenceInCalendarDays(parseISO(t.endDate), parseISO(t.startDate)))
              const x = startOff * dayWidth
              const y = i * rowHeight + 6
              const h = rowHeight - 12
              const w = t.isMilestone ? h : duration * dayWidth
              const overdue = isOverdue(t.endDate, t.status)
              const dueSoon = isDueSoon(t.endDate, t.status)
              const critical = criticalSet.has(t.id)
              const fill = STATUS_FILL[t.status]

              if (t.isMilestone) {
                return (
                  <g key={t.id} onClick={() => onTaskClick(t.id)} style={{ cursor: 'pointer' }}>
                    <polygon
                      points={`${x},${y + h / 2} ${x + h / 2},${y} ${x + h},${y + h / 2} ${x + h / 2},${y + h}`}
                      fill="#171512"
                      stroke={critical ? '#A83D2F' : '#2F2A24'}
                      strokeWidth={critical ? 2 : 1}
                    />
                    <title>{t.name}</title>
                  </g>
                )
              }

              return (
                <g key={t.id} onClick={() => onTaskClick(t.id)} style={{ cursor: 'pointer' }}>
                  {/* Bar */}
                  <rect
                    x={x} y={y} width={Math.max(w, 4)} height={h} rx={4}
                    fill={fill}
                    opacity={t.status === 'done' ? 0.7 : 0.92}
                    stroke={critical ? '#A83D2F' : overdue ? '#A83D2F' : 'transparent'}
                    strokeWidth={critical || overdue ? 1.5 : 0}
                  />
                  {/* Progress fill */}
                  {t.percentComplete > 0 && t.status !== 'done' && (
                    <rect
                      x={x} y={y}
                      width={Math.max(w, 4) * (t.percentComplete / 100)}
                      height={h} rx={4}
                      fill={fill} opacity={0.45}
                    />
                  )}
                  {/* Amber flag for due-soon (US-15) */}
                  {dueSoon && !overdue && (
                    <circle cx={x + w - 4} cy={y + 4} r={3} fill="#C8932F" />
                  )}
                  {/* Label inside bar if wide enough */}
                  {w > 80 && (
                    <text
                      x={x + 6} y={y + h / 2 + 3}
                      fontSize={11} fill="#FAF8F3" fontFamily="Manrope"
                      fontWeight={500}
                      style={{ pointerEvents: 'none' }}
                    >
                      {t.name.length > Math.floor(w / 7) ? t.name.slice(0, Math.floor(w / 7)) + '…' : t.name}
                    </text>
                  )}
                  <title>{`${t.name}\n${t.startDate} → ${t.endDate} (${t.percentComplete}%)`}</title>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
})
