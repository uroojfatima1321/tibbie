import { useMemo, useState } from 'react'
import { parseISO, startOfWeek, addDays, format, differenceInCalendarDays, isBefore } from 'date-fns'
import type { Task, Member } from '../../types'
import { useApp } from '../../store/context'
import { Avatar } from '../members/Avatar'

/**
 * Workload heatmap: rows = members, columns = weeks, cell colour scales with
 * count of tasks active in that week. Horizontally scrollable on mobile with
 * sticky-left member column.
 */
export function HeatmapView({ onClose }: { onClose: () => void }) {
  const { data } = useApp()

  const { weeks, matrix, maxCount } = useMemo(() => {
    if (!data || data.members.length === 0) return { weeks: [] as Date[], matrix: new Map<string, number[]>(), maxCount: 0 }

    // Determine range: earliest task start → latest task end
    if (data.tasks.length === 0) return { weeks: [], matrix: new Map(), maxCount: 0 }
    let min = parseISO(data.tasks[0].startDate)
    let max = parseISO(data.tasks[0].endDate)
    for (const t of data.tasks) {
      const s = parseISO(t.startDate), e = parseISO(t.endDate)
      if (isBefore(s, min)) min = s
      if (isBefore(max, e)) max = e
    }

    // Align to week starts (Monday)
    const firstWeek = startOfWeek(min, { weekStartsOn: 1 })
    const weekCount = Math.ceil(differenceInCalendarDays(max, firstWeek) / 7) + 1
    const ws: Date[] = []
    for (let i = 0; i < weekCount; i++) ws.push(addDays(firstWeek, i * 7))

    // For each member, count tasks active in each week
    const mx = new Map<string, number[]>()
    let maxC = 0
    for (const m of data.members) {
      const row: number[] = new Array(weekCount).fill(0)
      for (const t of data.tasks) {
        if (!t.assigneeIds.includes(m.id)) continue
        const tStart = parseISO(t.startDate), tEnd = parseISO(t.endDate)
        for (let i = 0; i < weekCount; i++) {
          const wStart = ws[i]
          const wEnd = addDays(wStart, 7)
          if (isBefore(tStart, wEnd) && isBefore(wStart, tEnd)) row[i]++
        }
      }
      const rowMax = Math.max(...row)
      if (rowMax > maxC) maxC = rowMax
      mx.set(m.id, row)
    }

    return { weeks: ws, matrix: mx, maxCount: maxC }
  }, [data])

  if (!data) return null

  function cellColor(count: number): string {
    if (count === 0) return '#FFFFFF'
    const intensity = maxCount === 0 ? 0 : count / maxCount
    // Lerp from cream → rust based on intensity
    if (intensity < 0.33) return '#F3D5C7'
    if (intensity < 0.66) return '#E4A98E'
    if (intensity < 1.0) return '#D47757'
    return '#C65D3B'
  }

  const cellW = 36
  const rowH = 44
  const labelW = 200   // wider to fit capacity bar
  const DEFAULT_CAPACITY = 5
  const [capacities, setCapacities] = useState<Record<string, number>>({})
  function capacityFor(memberId: string) { return capacities[memberId] ?? DEFAULT_CAPACITY }

  // Count tasks-in-flight for each member this week
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const inFlight = useMemo(() => {
    if (!data) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const m of data.members) {
      const count = data.tasks.filter(t => {
        if (!t.assigneeIds.includes(m.id)) return false
        if (t.status === 'done') return false
        const s = parseISO(t.startDate), e = parseISO(t.endDate)
        return s <= addDays(thisWeekStart, 7) && e >= thisWeekStart
      }).length
      map.set(m.id, count)
    }
    return map
  }, [data, thisWeekStart])

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white">
      <div className="px-4 sm:px-6 py-4 border-b border-surface-200 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">Workload heatmap</h2>
          <p className="text-xs text-ink-500 mt-0.5">Active tasks per member, per week. Darker = more concurrent work.</p>
        </div>
        <button onClick={onClose} className="btn-outline">Back to Gantt</button>
      </div>

      {data.tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 text-sm text-ink-500">Add tasks to see workload.</div>
      ) : (
        <div className="flex-1 overflow-auto tibbie-scroll">
          <div style={{ minWidth: labelW + weeks.length * cellW + 16 }}>
            {/* Header row */}
            <div className="sticky top-0 z-10 bg-white border-b border-surface-200 flex">
              <div className="shrink-0 border-r border-surface-200" style={{ width: labelW, height: 36 }} />
              <div className="flex">
                {weeks.map((w, i) => (
                  <div key={i} className="shrink-0 text-center text-[10px] text-ink-500 pt-2 pb-1 border-r border-surface-100" style={{ width: cellW }}>
                    {format(w, 'd MMM')}
                  </div>
                ))}
              </div>
            </div>
            {/* Rows */}
            {data.members.map(m => {
              const row = matrix.get(m.id) || []
              const cap = capacityFor(m.id)
              const current = inFlight.get(m.id) ?? 0
              const overCapacity = current > cap
              return (
                <div key={m.id} className="flex border-b border-surface-100">
                  <div className="shrink-0 flex items-center gap-2 px-3 border-r border-surface-200 sticky left-0 bg-white" style={{ width: labelW, height: rowH }}>
                    <Avatar member={m} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block">{m.name}</span>
                      {/* Capacity bar */}
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${overCapacity ? 'bg-amber-500' : 'bg-forest-500'}`}
                            style={{ width: `${Math.min(100, (current / cap) * 100)}%` }}
                          />
                        </div>
                        <span className={`font-mono text-[9px] shrink-0 ${overCapacity ? 'text-amber-600 font-semibold' : 'text-ink-400'}`}>
                          {current}/{cap}
                        </span>
                        <button
                          onClick={() => setCapacities(prev => ({ ...prev, [m.id]: Math.max(1, cap - 1) }))}
                          className="text-[9px] text-ink-300 hover:text-ink-600 w-3 text-center leading-none"
                          title="Decrease capacity"
                        >−</button>
                        <button
                          onClick={() => setCapacities(prev => ({ ...prev, [m.id]: cap + 1 }))}
                          className="text-[9px] text-ink-300 hover:text-ink-600 w-3 text-center leading-none"
                          title="Increase capacity"
                        >+</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    {row.map((count: number, i: number) => (
                      <div
                        key={i}
                        className="shrink-0 flex items-center justify-center text-[10px] font-mono tabular-nums border-r border-surface-100"
                        style={{ width: cellW, height: rowH, backgroundColor: cellColor(count), color: count > 2 ? '#FFFFFF' : '#57524C' }}
                        title={`${m.name}, week of ${format(weeks[i], 'd MMM')}: ${count} task${count === 1 ? '' : 's'}`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
