import { useMemo } from 'react'
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
    if (count === 0) return '#FAF8F3'
    const intensity = maxCount === 0 ? 0 : count / maxCount
    // Lerp from cream → rust based on intensity
    if (intensity < 0.33) return '#F3D5C7'
    if (intensity < 0.66) return '#E4A98E'
    if (intensity < 1.0) return '#D47757'
    return '#C65D3B'
  }

  const cellW = 36
  const rowH = 44
  const labelW = 160

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-cream-50">
      <div className="px-4 sm:px-6 py-4 border-b border-cream-300 flex items-center justify-between">
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
            <div className="sticky top-0 z-10 bg-cream-50 border-b border-cream-300 flex">
              <div className="shrink-0 border-r border-cream-300" style={{ width: labelW, height: 36 }} />
              <div className="flex">
                {weeks.map((w, i) => (
                  <div key={i} className="shrink-0 text-center text-[10px] text-ink-500 pt-2 pb-1 border-r border-cream-200" style={{ width: cellW }}>
                    {format(w, 'd MMM')}
                  </div>
                ))}
              </div>
            </div>
            {/* Rows */}
            {data.members.map(m => {
              const row = matrix.get(m.id) || []
              return (
                <div key={m.id} className="flex border-b border-cream-200">
                  <div className="shrink-0 flex items-center gap-2 px-3 border-r border-cream-300 sticky left-0 bg-cream-50" style={{ width: labelW, height: rowH }}>
                    <Avatar member={m} size="sm" />
                    <span className="text-sm truncate">{m.name}</span>
                  </div>
                  <div className="flex">
                    {row.map((count: number, i: number) => (
                      <div
                        key={i}
                        className="shrink-0 flex items-center justify-center text-[10px] font-mono tabular-nums border-r border-cream-200"
                        style={{ width: cellW, height: rowH, backgroundColor: cellColor(count), color: count > 2 ? '#FAF8F3' : '#57524C' }}
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
