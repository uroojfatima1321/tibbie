import { useMemo, useRef, useState, forwardRef, useImperativeHandle, useCallback, useEffect } from 'react'
import {
  parseISO, differenceInCalendarDays, addDays, format,
  startOfWeek, startOfMonth, isBefore, isAfter, getDay, addMonths,
} from 'date-fns'
import type { Task, TaskStatus, Member } from '../../types'
import { useApp } from '../../store/context'
import { StatusPill } from '../v2/StatusPill'
import { DepartmentChips } from '../v2/DepartmentChips'
import { computeCriticalPath } from '../../lib/cpm'
import { isOverdue, isDueSoon, overlapsRange, today, addDaysISO } from '../../lib/dates'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { initials } from '../../lib/util'
import { expandHolidays, taskOverlapsHoliday } from '../../lib/holidays'
import { findCurrentPhase } from '../projects/ProjectPhasesSection'
import {
  AlertTriangle, Flag, StickyNote,
  ChevronDown, ChevronRight, ChevronLeft,
  CalendarDays, CalendarOff, LayoutDashboard,
  ExternalLink, Copy, Trash2, User,
} from 'lucide-react'
import { ConfirmDialog } from '../ui/Confirm'
import { V1BulkBar } from '../v1/V1BulkBar'

interface Props {
  onTaskClick: (taskId: string) => void
  onOpenV2Project?: (v2Id: string) => void
}

export interface GanttHandle {
  getChartElement: () => HTMLDivElement | null
}

const DAY_WIDTH: Record<'day' | 'week' | 'month', number> = { day: 40, week: 14, month: 4 }

const STATUS_FILL: Record<TaskStatus, string> = {
  not_started: '#A8A29A',
  in_progress: '#3A6B8A',
  at_risk: '#C8932F',
  done: '#2F5743',
}
const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  at_risk: 'At risk',
  done: 'Done',
}
const STATUS_CYCLE: TaskStatus[] = ['not_started', 'in_progress', 'at_risk', 'done']

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const HOLIDAY_TINT = '#E8C5B8'
const HOLIDAY_ICON_COLOR = '#A84A2C'

const inclusiveDays = (startISO: string, endISO: string) =>
  Math.max(1, differenceInCalendarDays(parseISO(endISO), parseISO(startISO)) + 1)

// ── Drag types ────────────────────────────────────────────────────────────────
type DragType = 'move' | 'resize-left' | 'resize-right'
interface DragState {
  type: DragType
  taskId: string
  startClientX: number
  origStart: string
  origEnd: string
  currentDeltaDays: number
}

// ── Context menu ──────────────────────────────────────────────────────────────
interface ContextMenuState {
  taskId: string
  x: number
  y: number
}

// ── Inline create ─────────────────────────────────────────────────────────────
interface InlineCreate {
  projectId: string
  dateISO: string
  y: number
  x: number
}

export const GanttView = forwardRef<GanttHandle, Props>(function GanttView({ onTaskClick, onOpenV2Project }, ref) {
  const { data, filters, groupBy, zoom, setZoom, myTasksMemberId, setActiveProjectId, editMode, updateTask, addTask, deleteTask, projectsV2, modulesV2 } = useApp()
  const isMobile = useIsMobile()
  const chartRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [quickAddValue, setQuickAddValue] = useState('')
  const [drag, setDrag] = useState<DragState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [inlineCreate, setInlineCreate] = useState<InlineCreate | null>(null)
  const [inlineCreateName, setInlineCreateName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  // CR-2.4: V1 bulk selection
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  function toggleTaskSelect(id: string) {
    setSelectedTaskIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectTaskGroup(taskIds: string[]) {
    setSelectedTaskIds(prev => {
      const n = new Set(prev)
      const allSelected = taskIds.every(id => n.has(id))
      if (allSelected) taskIds.forEach(id => n.delete(id))
      else taskIds.forEach(id => n.add(id))
      return n
    })
  }

  const toggleCollapse = (projectId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId)
      return next
    })
  }

  useImperativeHandle(ref, () => ({ getChartElement: () => chartRef.current }))

  // ── Drag-to-move / resize ─────────────────────────────────────────────────
  function svgX(clientX: number): number {
    const scroller = scrollerRef.current
    if (!scroller) return 0
    const rect = scroller.getBoundingClientRect()
    return clientX - rect.left + scroller.scrollLeft
  }

  function startDrag(e: React.PointerEvent, taskId: string, type: DragType) {
    if (!editMode) return
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const t = data?.tasks.find(x => x.id === taskId)
    if (!t) return
    setDrag({ type, taskId, startClientX: e.clientX, origStart: t.startDate, origEnd: t.endDate, currentDeltaDays: 0 })
    setContextMenu(null)
  }

  function onSvgPointerMove(e: React.PointerEvent) {
    if (!drag || !dayWidth) return
    const rawDelta = e.clientX - drag.startClientX
    const deltaDays = Math.round(rawDelta / dayWidth)
    if (deltaDays === drag.currentDeltaDays) return
    setDrag(prev => prev ? { ...prev, currentDeltaDays: deltaDays } : null)
  }

  function onSvgPointerUp(e: React.PointerEvent) {
    if (!drag) return
    const { type, taskId, currentDeltaDays: d, origStart, origEnd } = drag
    if (d !== 0) {
      let newStart = origStart, newEnd = origEnd
      if (type === 'move') {
        newStart = addDaysISO(origStart, d)
        newEnd = addDaysISO(origEnd, d)
      } else if (type === 'resize-right') {
        const newDur = Math.max(1, inclusiveDays(origStart, origEnd) + d)
        newEnd = addDaysISO(origStart, newDur - 1)
      } else {
        const origDur = inclusiveDays(origStart, origEnd)
        const newDur = Math.max(1, origDur - d)
        newStart = addDaysISO(origEnd, -(newDur - 1))
      }
      updateTask(taskId, { startDate: newStart, endDate: newEnd })
    }
    setDrag(null)
  }

  // ── Keyboard pan — wired after dayWidth is computed (see below) ──────────
  const dayWidthRef = useRef(40)

  // ── @member / #phase prefix parsing for quick-add ─────────────────────────
  function parseQuickAdd(raw: string, projectId: string) {
    const parts = raw.trim().split(' ')
    let name = ''
    const assigneeIds: string[] = []
    for (const part of parts) {
      if (part.startsWith('@') && data) {
        const handle = part.slice(1).toLowerCase()
        const member = data.members.find(m => m.name.toLowerCase().includes(handle))
        if (member) { assigneeIds.push(member.id); continue }
      }
      name += (name ? ' ' : '') + part
    }
    return { name: name || raw.trim(), assigneeIds }
  }

  // ── V1/V2 bridge name lookup ──────────────────────────────────────────────
  const v2ByName = useMemo(() => {
    const map = new Map<string, string>() // v1 project name → v2 project id
    for (const p of projectsV2 || []) {
      map.set(p.name.toLowerCase().trim(), p.id)
    }
    return map
  }, [projectsV2])

  // ── Context menu actions ──────────────────────────────────────────────────
  async function ctxCycleStatus(taskId: string) {
    const t = data?.tasks.find(x => x.id === taskId)
    if (!t) return
    const idx = STATUS_CYCLE.indexOf(t.status)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    await updateTask(taskId, { status: next })
    setContextMenu(null)
  }

  async function ctxDuplicate(taskId: string) {
    const t = data?.tasks.find(x => x.id === taskId)
    if (!t) return
    await addTask({ ...t, name: t.name + ' (copy)', percentComplete: 0, status: 'not_started' })
    setContextMenu(null)
  }

  // ── V1 bulk handlers (CR-2.4) ─────────────────────────────────────────────
  async function bulkDelete(ids: string[]) {
    for (const id of ids) await deleteTask(id)
    setSelectedTaskIds(new Set())
  }
  async function bulkSetStatus(ids: string[], status: TaskStatus) {
    for (const id of ids) await updateTask(id, { status })
    setSelectedTaskIds(new Set())
  }
  async function bulkReassign(ids: string[], memberId: string) {
    for (const id of ids) await updateTask(id, { assigneeIds: [memberId] })
    setSelectedTaskIds(new Set())
  }
  async function bulkShiftDates(ids: string[], days: number) {
    for (const id of ids) {
      const t = data?.tasks.find(x => x.id === id)
      if (!t) continue
      await updateTask(id, { startDate: addDaysISO(t.startDate, days), endDate: addDaysISO(t.endDate, days) })
    }
    setSelectedTaskIds(new Set())
  }

  const dayWidth = DAY_WIDTH[zoom]

  // Sync ref so keyboard pan always uses current dayWidth without re-subscribing
  dayWidthRef.current = dayWidth

  // Keyboard pan: arrow keys scroll timeline when chart is focused
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = scrollerRef.current
      if (!el) return
      if (document.activeElement !== el && !el.contains(document.activeElement)) return
      const scroll = dayWidthRef.current * 7
      if (e.key === 'ArrowRight') { e.preventDefault(); el.scrollBy({ left: scroll, behavior: 'smooth' }) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); el.scrollBy({ left: -scroll, behavior: 'smooth' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])  // stable — uses ref for dayWidth
  const rowHeight = isMobile ? 48 : 44
  const leftColWidth = isMobile ? 160 : 280
  const showWeekdayRow = zoom === 'day'
  const headerHeight = showWeekdayRow ? 70 : 56
  const monthBandHeight = 26
  const weekdayBandHeight = showWeekdayRow ? 16 : 0

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

  const { rangeStart, rangeEndISO, totalDays } = useMemo(() => {
    if (filteredTasks.length === 0) {
      const t = parseISO(today())
      const startD = addDays(t, -7)
      const endD = addDays(t, 30)
      return { rangeStart: startD, rangeEndISO: format(endD, 'yyyy-MM-dd'), totalDays: 38 }
    }
    let min = parseISO(filteredTasks[0].startDate)
    let max = parseISO(filteredTasks[0].endDate)
    for (const t of filteredTasks) {
      const s = parseISO(t.startDate), e = parseISO(t.endDate)
      if (isBefore(s, min)) min = s
      if (isAfter(e, max)) max = e
    }
    const padded = { s: addDays(min, -3), e: addDays(max, 7) }
    return {
      rangeStart: padded.s,
      rangeEndISO: format(padded.e, 'yyyy-MM-dd'),
      totalDays: differenceInCalendarDays(padded.e, padded.s) + 1,
    }
  }, [filteredTasks])

  const rangeStartISO = useMemo(() => format(rangeStart, 'yyyy-MM-dd'), [rangeStart])

  const holidayMap = useMemo(
    () => expandHolidays(data?.holidays || [], rangeStartISO, rangeEndISO),
    [data?.holidays, rangeStartISO, rangeEndISO],
  )

  const criticalSet = useMemo(
    () => data ? computeCriticalPath(filteredTasks, data.dependencies) : new Set<string>(),
    [filteredTasks, data],
  )

  const memberMap = useMemo(() => {
    const m = new Map<string, Member>()
    data?.members.forEach(member => m.set(member.id, member))
    return m
  }, [data])

  type ProjectAgg = {
    startDate: string; endDate: string; taskCount: number; avgPercent: number
    statusMix: { done: number; inProgress: number; atRisk: number; notStarted: number }
    hasOverdue: boolean
  }
  const projectAggregates = useMemo(() => {
    const map = new Map<string, ProjectAgg>()
    if (!data) return map
    for (const p of projectsV2 || []) {
      const list = filteredTasks.filter(t => t.projectId === p.id)
      if (list.length === 0) continue
      let min = list[0].startDate, max = list[0].endDate
      let percentSum = 0
      const mix = { done: 0, inProgress: 0, atRisk: 0, notStarted: 0 }
      let hasOverdue = false
      for (const t of list) {
        if (t.startDate < min) min = t.startDate
        if (t.endDate > max) max = t.endDate
        percentSum += t.percentComplete
        if (t.status === 'done') mix.done++
        else if (t.status === 'in_progress') mix.inProgress++
        else if (t.status === 'at_risk') mix.atRisk++
        else mix.notStarted++
        if (isOverdue(t.endDate, t.status)) hasOverdue = true
      }
      map.set(p.id, {
        startDate: min, endDate: max, taskCount: list.length,
        avgPercent: Math.round(percentSum / list.length),
        statusMix: mix, hasOverdue,
      })
    }
    return map
  }, [data, filteredTasks, projectsV2])

  type Row =
    | { kind: 'group'; projectId?: string; label: string; color?: string; count: number; collapsible: boolean }
    | { kind: 'project'; projectId: string; label: string; color: string; count: number }
    | { kind: 'task'; task: Task }
    | { kind: 'moduleGroup'; moduleId: string; projectId: string; label: string; color: string; count: number }
    // ^^ Item 3: clean discriminant replaces the 'mod-${id}' string-prefix hack

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const out: Row[] = []
    if (groupBy === 'project') {
      const byProject = new Map<string, Task[]>()
      for (const t of filteredTasks) {
        if (!byProject.has(t.projectId)) byProject.set(t.projectId, [])
        byProject.get(t.projectId)!.push(t)
      }
      // Unified loop: projectsV2 is the single source of truth post-schemaVersion 3
      for (const p of (projectsV2 || [])) {
        if (p.archived) continue
        const list = byProject.get(p.id) || []
        // Noise control: skip projects with no tasks AND no gantt date range set
        if (list.length === 0 && !p.ganttStart && !p.ganttEnd) continue
        const color = p.color ?? '#8B8680'
        if (collapsed.has(p.id)) {
          out.push({ kind: 'project', projectId: p.id, label: p.name, color, count: list.length })
        } else {
          out.push({ kind: 'group', projectId: p.id, label: p.name, color, count: list.length, collapsible: true })
          // EXC-1 (M5.1 C): module sub-groups under each project
          const projectModules = (modulesV2 || []).filter(m => m.projectId === p.id && !m.archived)
          // Tasks with moduleId — group under their module
          const moduleTasks = new Map<string, typeof list>()
          const directTasks: typeof list = []
          for (const t of list.sort((a, b) => a.startDate.localeCompare(b.startDate))) {
            const mid = (t as any).moduleId
            if (mid && projectModules.some(m => m.id === mid)) {
              if (!moduleTasks.has(mid)) moduleTasks.set(mid, [])
              moduleTasks.get(mid)!.push(t)
            } else {
              directTasks.push(t)
            }
          }
          // Direct project tasks first
          for (const t of directTasks) out.push({ kind: 'task', task: t })
          // Module sub-groups — Item 3: use moduleGroup kind, retire 'mod-${id}' prefix
          for (const mod of projectModules) {
            const modTasks = moduleTasks.get(mod.id) || []
            if (modTasks.length === 0) continue  // skip empty modules
            if (collapsed.has(`mod-${mod.id}`)) {
              out.push({ kind: 'moduleGroup', moduleId: mod.id, projectId: p.id, label: `↳ ${mod.name}`, color: '#9B89EE', count: modTasks.length })
            } else {
              out.push({ kind: 'moduleGroup', moduleId: mod.id, projectId: p.id, label: `↳ ${mod.name}`, color: '#9B89EE', count: modTasks.length })
              for (const t of modTasks) out.push({ kind: 'task', task: t })
            }
          }
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
        out.push({ kind: 'group', label: m.name, color: m.color, count: list.length, collapsible: false })
        for (const t of list.sort((a, b) => a.startDate.localeCompare(b.startDate))) {
          out.push({ kind: 'task', task: t })
        }
      }
      const unassigned = byMember.get('__unassigned')
      if (unassigned && unassigned.length) {
        out.push({ kind: 'group', label: 'Unassigned', count: unassigned.length, collapsible: false })
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
  }, [filteredTasks, data, groupBy, collapsed, projectsV2, modulesV2])

  const dayMeta = useMemo(() => {
    const out: { x: number; iso: string; isWeekend: boolean; isMonthStart: boolean; isWeekStart: boolean; isHoliday: boolean; holidayName?: string; dow: number }[] = []
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(rangeStart, i)
      const iso = format(d, 'yyyy-MM-dd')
      const dow = getDay(d)
      const holNames = holidayMap.get(iso)
      out.push({
        x: i * dayWidth, iso,
        isWeekend: dow === 0 || dow === 6,
        isMonthStart: format(d, 'd') === '1',
        isWeekStart: dow === 1,
        isHoliday: !!holNames, holidayName: holNames?.[0],
        dow,
      })
    }
    return out
  }, [rangeStart, totalDays, dayWidth, holidayMap])

  const monthBands = useMemo(() => {
    const bands: { x: number; width: number; label: string; year: number; clippedStart: boolean }[] = []
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
          x: startX, width: endX - startX,
          label: format(cursor, 'MMMM').toUpperCase(),
          year: cursor.getFullYear(),
          clippedStart: monthStartOff < 0,
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

  const dayRowTicks = useMemo(() => {
    const out: { x: number; label: string; isWeekend: boolean; dow: number }[] = []
    if (zoom === 'day') {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(rangeStart, i)
        const dow = getDay(d)
        out.push({ x: i * dayWidth, label: format(d, 'd'), isWeekend: dow === 0 || dow === 6, dow })
      }
    } else if (zoom === 'week') {
      const firstWeek = startOfWeek(rangeStart, { weekStartsOn: 1 })
      let i = Math.max(0, differenceInCalendarDays(firstWeek, rangeStart))
      while (i < totalDays) {
        const d = addDays(rangeStart, i)
        out.push({ x: i * dayWidth, label: format(d, 'd'), isWeekend: false, dow: 1 })
        i += 7
      }
    }
    return out
  }, [rangeStart, totalDays, dayWidth, zoom])

  const todayX = useMemo(() => {
    const t = parseISO(today())
    const off = differenceInCalendarDays(t, rangeStart)
    if (off < 0 || off > totalDays) return null
    return off * dayWidth + dayWidth / 2
  }, [rangeStart, totalDays, dayWidth])

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

  const paginate = useCallback((direction: 'prev' | 'next' | 'today') => {
    const scroller = scrollerRef.current
    if (!scroller) return
    if (direction === 'today') {
      if (todayX == null) return
      const target = Math.max(0, todayX - scroller.clientWidth / 2)
      scroller.scrollTo({ left: target, behavior: 'smooth' })
      return
    }
    const centerX = scroller.scrollLeft + scroller.clientWidth / 2
    const dayIndex = Math.floor(centerX / dayWidth)
    const centerDate = addDays(rangeStart, Math.max(0, Math.min(totalDays - 1, dayIndex)))
    const targetMonth = direction === 'next'
      ? startOfMonth(addMonths(centerDate, 1))
      : startOfMonth(addMonths(centerDate, -1))
    const targetDayOff = differenceInCalendarDays(targetMonth, rangeStart)
    const clamped = Math.max(0, Math.min(totalDays - 1, targetDayOff))
    const targetX = clamped * dayWidth
    const target = Math.max(0, targetX - 24)
    scroller.scrollTo({ left: target, behavior: 'smooth' })
  }, [rangeStart, totalDays, dayWidth, todayX])

  // Helper to render a project's current-phase badge in the left column
  const renderPhaseBadge = (projectId: string) => {
    if (!data) return null
    const current = findCurrentPhase(projectId, data.projectPhases, data.phaseTemplates)
    if (!current) return null
    return (
      <span
        className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 max-w-[100px] truncate"
        style={{
          backgroundColor: current.template.color + '22',
          color: current.template.color,
        }}
        title={`Current phase: ${current.template.name}`}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: current.phase.status === 'blocked' ? '#A83D2F' : current.template.color }}
        />
        <span className="truncate">{current.template.name}</span>
      </span>
    )
  }

  if (!data) return null

  if (filteredTasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
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
    <div ref={chartRef} className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-surface-200 bg-white text-[11px] text-ink-600 overflow-x-auto">
        <span className="font-semibold uppercase tracking-wider text-ink-500 shrink-0">Status</span>
        {(Object.keys(STATUS_FILL) as TaskStatus[]).map(s => (
          <span key={s} className="inline-flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: STATUS_FILL[s] }} />
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="w-px h-4 bg-surface-200 shrink-0" />
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <span className="w-3 h-3 rotate-45 bg-ink-900" />
          Milestone
        </span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <span className="w-4 h-0.5 bg-brick-500 rounded" />
          Critical path
        </span>
        {holidayMap.size > 0 && (
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: HOLIDAY_TINT }} />
            Holiday
          </span>
        )}
        <span className="flex-1" />
        {/* Zoom toggle */}
        <div className="flex items-center gap-0.5 shrink-0 bg-surface-100 rounded-lg p-0.5">
          {(['day','week','month'] as const).map(z => (
            <button key={z} onClick={() => setZoom(z)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${zoom === z ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
              {z}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => paginate('prev')} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-ink-600 hover:bg-surface-100 transition-colors text-[11px] font-medium" title="Previous month">
            <ChevronLeft size={14} />
            <span className="hidden sm:inline">Prev</span>
          </button>
          <button onClick={() => paginate('today')} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-ink-600 hover:bg-surface-100 transition-colors text-[11px] font-medium" title="Jump to today (T)">
            <CalendarDays size={13} />
            <span className="hidden sm:inline">Today</span>
          </button>
          <button onClick={() => paginate('next')} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-ink-600 hover:bg-surface-100 transition-colors text-[11px] font-medium" title="Next month">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="shrink-0 border-r border-surface-200 bg-white overflow-hidden flex flex-col" style={{ width: leftColWidth }}>
          <div className="border-b border-surface-200 flex items-end px-3 pb-2" style={{ height: headerHeight }}>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Task</span>
          </div>
          <div className="tibbie-scroll overflow-y-auto" style={{ height: `calc(100% - ${headerHeight}px)` }}>
            <div style={{ height: totalHeight }}>
              {rows.map((r, i) => {
                if (r.kind === 'group') {
                  const canCollapse = r.collapsible && r.projectId
                  return (
                    <div
                      key={`g-${i}`}
                      className={`flex items-center gap-1.5 px-2 border-b border-surface-100 bg-white/80 ${canCollapse ? 'hover:bg-surface-100' : ''} group/group`}
                      style={{ height: rowHeight }}
                    >
                      {canCollapse && (
                        <button onClick={() => toggleCollapse(r.projectId!)} className="text-ink-500 shrink-0 p-0.5 rounded hover:bg-surface-200" aria-label="Collapse project">
                          <ChevronDown size={14} />
                        </button>
                      )}
                      {r.color && <span className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />}
                      {r.projectId ? (
                        <button
                          onClick={() => onOpenV2Project ? onOpenV2Project(r.projectId!) : setActiveProjectId(r.projectId!)}
                          className="font-semibold text-xs text-ink-900 truncate flex-1 text-left hover:text-rust-600 transition-colors"
                          title={`Open ${r.label}`}
                        >
                          {r.label}
                        </button>
                      ) : (
                        <span className="font-semibold text-xs text-ink-900 truncate flex-1" title={r.label}>{r.label}</span>
                      )}
                      {/* Phase B: clientTimeline icon */}
                      {r.projectId && (() => {
                        const proj = projectsV2?.find(p => p.id === r.projectId)
                        return proj?.clientTimeline ? (
                          <span title="Timeline shared with client" className="shrink-0 text-amber-500">
                            <Flag size={11} />
                          </span>
                        ) : null
                      })()}
                      {r.projectId && renderPhaseBadge(r.projectId)}
                      {/* CR-2.4: select-all in group */}
                      {editMode && (() => {
                        const groupTaskIds = filteredTasks.filter(t => t.projectId === r.projectId).map(t => t.id)
                        const allSel = groupTaskIds.every(id => selectedTaskIds.has(id)) && groupTaskIds.length > 0
                        return (
                          <input type="checkbox" checked={allSel} onChange={() => selectTaskGroup(groupTaskIds)}
                            onClick={e => e.stopPropagation()}
                            className="rounded border-surface-300 text-rust-500 focus:ring-rust-400 w-3 h-3 shrink-0"
                            title={allSel ? 'Deselect all' : 'Select all in group'} />
                        )
                      })()}
                      <span className="text-[10px] text-ink-400 shrink-0">{r.count}</span>
                    </div>
                  )
                }
                if (r.kind === 'moduleGroup') {
                  const mod = (modulesV2 || []).find(m => m.id === r.moduleId)
                  const isCollapsed = collapsed.has(`mod-${r.moduleId}`)
                  return (
                    <div key={`mg-${r.moduleId}`}
                      className="flex items-center gap-1.5 pl-6 pr-2 border-b border-surface-100 bg-surface-50/60 hover:bg-surface-100"
                      style={{ height: rowHeight }}>
                      <button onClick={() => toggleCollapse(`mod-${r.moduleId}`)}
                        className="text-ink-500 shrink-0 p-0.5 rounded hover:bg-surface-200">
                        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                      <span className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      <span className="text-xs text-ink-700 truncate flex-1 font-medium">{r.label.replace('↳ ', '')}</span>
                      {/* Item 3: status pill + dept chips; mobile shows count only */}
                      {mod && !isMobile && (
                        <>
                          <StatusPill status={mod.status} kind="feature" className="!text-[9px] !px-1.5 !py-[1px] shrink-0" />
                          {mod.tracks && mod.tracks.length > 0 && <DepartmentChips tracks={mod.tracks} className="shrink-0" />}
                        </>
                      )}
                      {isMobile && mod?.tracks && mod.tracks.length > 0 && (
                        <span className="font-mono text-[10px] text-ink-400 shrink-0">{mod.tracks.length}d</span>
                      )}
                      <span className="text-[10px] text-ink-400 shrink-0">{r.count}</span>
                    </div>
                  )
                }
                if (r.kind === 'project') {
                  return (
                    <div
                      key={`p-${r.projectId}`}
                      className="flex items-center gap-1.5 px-2 border-b border-surface-100 bg-white/80 hover:bg-surface-100 group/group"
                      style={{ height: rowHeight }}
                    >
                      <button onClick={() => toggleCollapse(r.projectId)} className="text-ink-500 shrink-0 p-0.5 rounded hover:bg-surface-200" aria-label="Expand project">
                        <ChevronRight size={14} />
                      </button>
                      <span className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      <button
                        onClick={() => onOpenV2Project ? onOpenV2Project(r.projectId) : setActiveProjectId(r.projectId)}
                        className="font-semibold text-xs text-ink-900 truncate flex-1 text-left hover:text-rust-600 transition-colors"
                        title={`Open ${r.label}`}
                      >
                        {r.label}
                      </button>
                      {/* Phase B: clientTimeline icon on collapsed row */}
                      {(() => {
                        const proj = projectsV2?.find(p => p.id === r.projectId)
                        return proj?.clientTimeline ? (
                          <span title="Timeline shared with client" className="shrink-0 text-amber-500">
                            <Flag size={11} />
                          </span>
                        ) : null
                      })()}
                      {renderPhaseBadge(r.projectId)}
                      <span className="text-[10px] text-ink-400 shrink-0">{r.count}</span>
                    </div>
                  )
                }
                const t = r.task
                const project = projectsV2?.find(p => p.id === t.projectId)
                const overdue = isOverdue(t.endDate, t.status)
                const { overlaps: spansHoliday } = taskOverlapsHoliday(t.startDate, t.endDate, holidayMap)
                function cycleStatus(e: React.MouseEvent) {
                  e.stopPropagation()
                  const idx = STATUS_CYCLE.indexOf(t.status)
                  const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
                  updateTask(t.id, { status: next, percentComplete: next === 'done' ? 100 : t.percentComplete })
                }
                return (
                  <div
                    key={t.id}
                    className={`flex items-center border-b border-surface-100 text-left group ${selectedTaskIds.has(t.id) ? 'bg-rust-50' : 'hover:bg-surface-50'}`}
                    style={{ height: rowHeight }}
                  >
                    {/* CR-2.4: task checkbox */}
                    {editMode && (
                      <div className="pl-1 pr-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 20 }}
                        onClick={e => { e.stopPropagation(); toggleTaskSelect(t.id) }}>
                        <input type="checkbox" checked={selectedTaskIds.has(t.id)} onChange={() => toggleTaskSelect(t.id)}
                          className="rounded border-surface-300 text-rust-500 focus:ring-rust-400 w-3 h-3"
                          style={{ opacity: selectedTaskIds.has(t.id) ? 1 : undefined }}
                        />
                      </div>
                    )}
                    <button onClick={() => onTaskClick(t.id)} className="flex-1 flex items-center gap-2 px-2 min-w-0 h-full" title={t.name}>
                    {editMode ? (
                      <span
                        onClick={cycleStatus}
                        className="w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer hover:scale-125 transition-transform"
                        style={{ backgroundColor: STATUS_FILL[t.status] }}
                        title={`${STATUS_LABEL[t.status]} — click to cycle`}
                      />
                    ) : (
                      project && <span className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: project.color ?? '#8B8680' }} />
                    )}
                    <span className="text-xs text-ink-900 truncate flex-1 group-hover:text-rust-600">{t.name}</span>
                    {spansHoliday && <CalendarOff size={11} className="shrink-0" style={{ color: HOLIDAY_ICON_COLOR }} />}
                    {overdue && <AlertTriangle size={12} className="text-brick-500 shrink-0" />}
                    {t.notes && <StickyNote size={11} className="text-ink-400 shrink-0" />}
                    </button>
                  </div>
                )
              })}
            </div>
            {/* Quick-add after rows — no longer shifts row indices vs SVG */}
            {editMode && (
              <div className="flex items-center border-t border-surface-100 px-2" style={{ height: rowHeight }}>
                <input
                  className="w-full bg-transparent text-xs outline-none placeholder:text-ink-300 text-ink-800"
                  placeholder="+ New task — Enter to create"
                  value={quickAddValue}
                  onChange={e => setQuickAddValue(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && quickAddValue.trim()) {
                      const projectId = filters.projectIds[0] ?? projectsV2?.filter(p => !p.archived)[0]?.id ?? ''
                      if (!projectId) return
                      const t = today()
                      const { name, assigneeIds } = parseQuickAdd(quickAddValue, projectId)
                      await addTask({
                        projectId, name, notes: '',
                        startDate: t, endDate: addDaysISO(t, 5),
                        status: 'not_started', percentComplete: 0,
                        isMilestone: false, assigneeIds, recurring: null,
                      })
                      setQuickAddValue('')
                      ;(e.target as HTMLInputElement).focus()
                    }
                    if (e.key === 'Escape') setQuickAddValue('')
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="flex-1 overflow-auto tibbie-scroll relative"
          tabIndex={0}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={() => setDrag(null)}
          onClick={() => setContextMenu(null)}
        >
          <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-surface-200" style={{ height: headerHeight }}>
              <svg width={totalWidth} height={headerHeight} className="block">
                {dayMeta.map((d, i) => d.isWeekend && (
                  <rect key={`hw-${i}`} x={d.x} y={monthBandHeight} width={dayWidth} height={headerHeight - monthBandHeight} fill="#E8E7E4" opacity={0.7} />
                ))}
                {dayMeta.map((d, i) => d.isHoliday && (
                  <rect key={`hh-${i}`} x={d.x} y={monthBandHeight} width={dayWidth} height={headerHeight - monthBandHeight} fill={HOLIDAY_TINT} opacity={0.55} />
                ))}

                {monthBandsWithYear.map((b, i) => {
                  const labelX = b.clippedStart ? 8 : b.x + 8
                  return (
                    <g key={`mb-${i}`}>
                      <rect x={b.x} y={0} width={b.width} height={monthBandHeight} fill={i % 2 === 0 ? '#E8E7E4' : '#FFFFFF'} />
                      <line x1={b.x} y1={0} x2={b.x} y2={headerHeight} stroke="#A8A29A" strokeWidth={1} />
                      <text x={labelX} y={17} fontSize={11} fill="#2F2A24" fontFamily="Manrope" fontWeight={600} letterSpacing={0.6}>
                        {b.label}
                        {b.showYear && <tspan dx={6} fill="#8B8680" fontWeight={500} fontSize={10}>{b.year}</tspan>}
                      </text>
                    </g>
                  )
                })}
                <line x1={totalWidth} y1={0} x2={totalWidth} y2={headerHeight} stroke="#A8A29A" />

                {showWeekdayRow && dayMeta.map((d, i) => (
                  <text key={`wd-${i}`} x={d.x + dayWidth / 2} y={monthBandHeight + 12} textAnchor="middle" fontSize={9} fontFamily="Manrope" fontWeight={500}
                    fill={d.isHoliday ? HOLIDAY_ICON_COLOR : d.isWeekend ? '#A8A29A' : '#8B8680'} letterSpacing={0.5}>
                    {WEEKDAY_LETTERS[d.dow]}
                  </text>
                ))}

                {dayRowTicks.map((t, i) => {
                  const meta = dayMeta[Math.floor(t.x / dayWidth)]
                  const fillColor = meta?.isHoliday ? HOLIDAY_ICON_COLOR : t.isWeekend ? '#8B8680' : '#2F2A24'
                  return (
                    <text key={`dt-${i}`} x={t.x + (zoom === 'day' ? dayWidth / 2 : 4)} y={monthBandHeight + weekdayBandHeight + 18}
                      textAnchor={zoom === 'day' ? 'middle' : 'start'} fontSize={11} fill={fillColor} fontFamily="Manrope"
                      fontWeight={t.isWeekend ? 400 : 600}>
                      {t.label}
                    </text>
                  )
                })}

                {dayMeta.map((d, i) => d.isMonthStart && (
                  <line key={`mst-${i}`} x1={d.x} y1={monthBandHeight} x2={d.x} y2={headerHeight} stroke="#A8A29A" strokeWidth={1} />
                ))}

                {todayX != null && (() => {
                  const pillY = showWeekdayRow ? monthBandHeight + 1 : monthBandHeight + 4
                  return (
                    <g>
                      <line x1={todayX} y1={monthBandHeight} x2={todayX} y2={headerHeight} stroke="#C65D3B" strokeWidth={1.5} />
                      <rect x={todayX - 22} y={pillY} width={44} height={14} rx={7} fill="#C65D3B" />
                      <text x={todayX} y={pillY + 10} textAnchor="middle" fontSize={9} fill="#FFFFFF" fontFamily="Manrope" fontWeight={700} letterSpacing={0.5}>TODAY</text>
                    </g>
                  )
                })()}
              </svg>
            </div>

            <svg width={totalWidth} height={totalHeight} className="block">
              {dayMeta.map((d, i) => d.isWeekend && (
                <rect key={`wk-${i}`} x={d.x} y={0} width={dayWidth} height={totalHeight} fill="#E8E7E4" opacity={0.6} />
              ))}
              {dayMeta.map((d, i) => d.isHoliday && (
                <g key={`hd-${i}`}>
                  <rect x={d.x} y={0} width={dayWidth} height={totalHeight} fill={HOLIDAY_TINT} opacity={0.5} />
                  <title>{d.holidayName || 'Holiday'}</title>
                </g>
              ))}

              {rows.map((r, i) => (
                <rect key={`bg-${i}`} x={0} y={i * rowHeight} width={totalWidth} height={rowHeight}
                  fill={(r.kind === 'group' || r.kind === 'project' || r.kind === 'moduleGroup') ? 'rgba(244,244,243,0.7)' : (i % 2 === 0 ? 'rgba(250,250,250,0.5)' : 'transparent')} />
              ))}

              {dayMeta.map((d, i) => d.isMonthStart && (
                <line key={`mv-${i}`} x1={d.x} y1={0} x2={d.x} y2={totalHeight} stroke="#A8A29A" strokeWidth={1} />
              ))}
              {zoom === 'day' && dayMeta.map((d, i) => (
                d.isWeekStart && !d.isMonthStart && (
                  <line key={`vw-${i}`} x1={d.x} y1={0} x2={d.x} y2={totalHeight} stroke="#E8E7E4" strokeWidth={1} />
                )
              ))}

              {rows.map((_, i) => (
                <line key={`h-${i}`} x1={0} y1={(i + 1) * rowHeight} x2={totalWidth} y2={(i + 1) * rowHeight} stroke="#E8E7E4" />
              ))}

              {todayX != null && (
                <line x1={todayX} y1={0} x2={todayX} y2={totalHeight} stroke="#C65D3B" strokeWidth={1.5} opacity={0.55} />
              )}

              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#6B655E" />
                </marker>
                <marker id="arrow-crit" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#A83D2F" />
                </marker>
              </defs>
              {arrowPaths.map(a => (
                <path key={a.key} d={a.d} fill="none" stroke={a.critical ? '#A83D2F' : '#6B655E'} strokeWidth={a.critical ? 2.25 : 1.5}
                  markerEnd={`url(#${a.critical ? 'arrow-crit' : 'arrow'})`} opacity={a.critical ? 0.95 : 0.75} />
              ))}

              {rows.map((r, i) => {
                if (r.kind === 'moduleGroup') return null   // no SVG bar for module headers
                if (r.kind === 'project') {
                  const agg = projectAggregates.get(r.projectId)
                  if (!agg) return null
                  const startOff = differenceInCalendarDays(parseISO(agg.startDate), rangeStart)
                  const duration = inclusiveDays(agg.startDate, agg.endDate)
                  const x = startOff * dayWidth
                  const y = i * rowHeight + 6
                  const h = rowHeight - 12
                  const w = duration * dayWidth
                  const total = agg.statusMix.done + agg.statusMix.inProgress + agg.statusMix.atRisk + agg.statusMix.notStarted

                  let segX = x
                  const segments: { fill: string; w: number }[] = []
                  const parts = [
                    { fill: STATUS_FILL.done, count: agg.statusMix.done },
                    { fill: STATUS_FILL.in_progress, count: agg.statusMix.inProgress },
                    { fill: STATUS_FILL.at_risk, count: agg.statusMix.atRisk },
                    { fill: STATUS_FILL.not_started, count: agg.statusMix.notStarted },
                  ]
                  for (const part of parts) {
                    if (part.count === 0) continue
                    segments.push({ fill: part.fill, w: (part.count / total) * w })
                  }
                  const { overlaps: spansHoliday } = taskOverlapsHoliday(agg.startDate, agg.endDate, holidayMap)

                  return (
                    <g key={`pbar-${r.projectId}`} onClick={() => toggleCollapse(r.projectId)} style={{ cursor: 'pointer' }}>
                      <rect x={x} y={y} width={Math.max(w, 4)} height={h} rx={5} fill={r.color} opacity={0.18} stroke={r.color} strokeWidth={1.5} />
                      <g>
                        {segments.map((s, idx) => {
                          const rect = <rect key={idx} x={segX} y={y} width={s.w} height={h} fill={s.fill} opacity={0.75} />
                          segX += s.w
                          return rect
                        })}
                      </g>
                      {agg.hasOverdue && <circle cx={x + w - 6} cy={y + 6} r={3.5} fill="#A83D2F" />}
                      {spansHoliday && (
                        <g transform={`translate(${x + w - (agg.hasOverdue ? 22 : 6) - 6}, ${y + h - 14})`}>
                          <circle cx={6} cy={6} r={7} fill="#FFFFFF" stroke={HOLIDAY_ICON_COLOR} strokeWidth={1} />
                          <text x={6} y={9} textAnchor="middle" fontSize={9} fontWeight={700} fill={HOLIDAY_ICON_COLOR}>H</text>
                        </g>
                      )}
                      {w > 110 && (
                        <text x={x + 8} y={y + h / 2 + 4} fontSize={11} fill="#171512" fontFamily="Manrope" fontWeight={600} style={{ pointerEvents: 'none' }}>
                          {r.label.length > Math.floor(w / 7) ? r.label.slice(0, Math.floor(w / 7)) + '…' : r.label}
                          <tspan dx={6} fontSize={10} fill="#57524C" fontWeight={500}>{r.count} tasks · {agg.avgPercent}%</tspan>
                        </text>
                      )}
                      <title>{`${r.label}\n${agg.startDate} → ${agg.endDate}\n${r.count} tasks · ${agg.avgPercent}% avg complete`}</title>
                    </g>
                  )
                }

                if (r.kind !== 'task') return null

                const t = r.task
                const startOff = differenceInCalendarDays(parseISO(t.startDate), rangeStart)
                const duration = inclusiveDays(t.startDate, t.endDate)
                const x = startOff * dayWidth
                const y = i * rowHeight + 6
                const h = rowHeight - 12
                const w = t.isMilestone ? h + 6 : duration * dayWidth
                const overdue = isOverdue(t.endDate, t.status)
                const dueSoon = isDueSoon(t.endDate, t.status)
                const critical = criticalSet.has(t.id)
                const fill = STATUS_FILL[t.status]
                const { overlaps: spansHoliday, names: holidayNames } = taskOverlapsHoliday(t.startDate, t.endDate, holidayMap)

                if (t.isMilestone) {
                  const cx = x + h / 2
                  const cy = y + h / 2
                  const half = (h + 6) / 2
                  return (
                    <g key={t.id} onClick={() => onTaskClick(t.id)} style={{ cursor: 'pointer' }}>
                      <polygon points={`${cx},${cy - half - 2} ${cx + half + 2},${cy} ${cx},${cy + half + 2} ${cx - half - 2},${cy}`} fill="#FFFFFF" opacity={0.7} />
                      <polygon points={`${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`} fill="#171512" stroke={critical ? '#A83D2F' : '#FFFFFF'} strokeWidth={critical ? 2.5 : 1.5} />
                      <circle cx={cx} cy={cy} r={4} fill={fill} />
                      <title>{`${t.name} (milestone)\n${t.startDate}${spansHoliday ? `\n⚠ Falls on: ${holidayNames.join(', ')}` : ''}`}</title>
                    </g>
                  )
                }

                const assignees = t.assigneeIds.map(id => memberMap.get(id)).filter(Boolean) as Member[]
                const showAvatars = w >= 60 && groupBy !== 'assignee' && assignees.length > 0
                const maxAvatars = w >= 140 ? 3 : w >= 100 ? 2 : 1
                const visibleAvatars = assignees.slice(0, maxAvatars)
                const extraCount = assignees.length - visibleAvatars.length

                // Compute drag preview offset
                const isDragging = drag?.taskId === t.id
                const dragDx = isDragging ? drag!.currentDeltaDays * dayWidth : 0
                const dragDw = isDragging && drag!.type === 'resize-right' ? drag!.currentDeltaDays * dayWidth : 0
                const dragDleft = isDragging && drag!.type === 'resize-left' ? drag!.currentDeltaDays * dayWidth : 0
                const dispX = x + (drag?.type === 'move' ? dragDx : drag?.type === 'resize-left' ? dragDleft : 0)
                const dispW = Math.max(24, w + dragDw - (drag?.type === 'resize-left' ? dragDleft : 0))

                return (
                  <g key={t.id}
                    onClick={e => { if (!drag) { e.stopPropagation(); onTaskClick(t.id) } }}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); if (editMode) setContextMenu({ taskId: t.id, x: e.clientX, y: e.clientY }) }}
                    style={{ cursor: drag ? (drag.type === 'move' ? 'grabbing' : 'ew-resize') : 'pointer' }}
                    opacity={isDragging ? 0.75 : 1}
                  >
                    {/* Main bar — drag-to-move */}
                    <rect x={dispX} y={y} width={dispW} height={h} rx={5} fill={fill} opacity={t.status === 'done' ? 0.7 : 0.92}
                      stroke={critical ? '#A83D2F' : overdue ? '#A83D2F' : 'transparent'} strokeWidth={critical || overdue ? 1.5 : 0}
                      onPointerDown={e => editMode && startDrag(e, t.id, 'move')}
                      style={{ cursor: editMode ? 'grab' : 'pointer' }}
                    />
                    {/* Left resize handle */}
                    {editMode && w >= 20 && (
                      <rect x={dispX} y={y} width={6} height={h} rx={2} fill="transparent"
                        style={{ cursor: 'ew-resize' }} onPointerDown={e => startDrag(e, t.id, 'resize-left')} />
                    )}
                    {/* Right resize handle */}
                    {editMode && w >= 20 && (
                      <rect x={dispX + dispW - 6} y={y} width={6} height={h} rx={2} fill="transparent"
                        style={{ cursor: 'ew-resize' }} onPointerDown={e => startDrag(e, t.id, 'resize-right')} />
                    )}
                    {t.percentComplete > 0 && t.status !== 'done' && (
                      <rect x={dispX} y={y} width={dispW * (t.percentComplete / 100)} height={h} rx={5} fill={fill} opacity={0.45} />
                    )}
                    {dueSoon && !overdue && <circle cx={dispX + dispW - 5} cy={y + 5} r={3.5} fill="#C8932F" />}
                    {spansHoliday && dispW >= 24 && (
                      <g transform={`translate(${dispX + 3}, ${y + 3})`}>
                        <circle cx={6} cy={6} r={6} fill="#FFFFFF" stroke={HOLIDAY_ICON_COLOR} strokeWidth={1} />
                        <text x={6} y={9} textAnchor="middle" fontSize={8} fontWeight={700} fill={HOLIDAY_ICON_COLOR}>H</text>
                      </g>
                    )}
                    {dispW > 80 && (
                      <text x={dispX + (spansHoliday ? 20 : 8)} y={y + h / 2 + 4} fontSize={11} fill="#FFFFFF" fontFamily="Manrope" fontWeight={500} style={{ pointerEvents: 'none' }}>
                        {(() => {
                          const reservedRight = showAvatars ? (visibleAvatars.length * 14 + (extraCount > 0 ? 18 : 0) + 12) : 12
                          const reservedLeft = spansHoliday ? 20 : 8
                          const availableChars = Math.floor((dispW - reservedLeft - reservedRight) / 6.5)
                          if (availableChars <= 4) return ''
                          return t.name.length > availableChars ? t.name.slice(0, availableChars) + '…' : t.name
                        })()}
                      </text>
                    )}
                    {showAvatars && (() => {
                      const dotSize = 16
                      const overlap = 5
                      const totalDotsWidth = visibleAvatars.length * (dotSize - overlap) + overlap
                      const startX = dispX + dispW - totalDotsWidth - 6 - (extraCount > 0 ? 18 : 0)
                      return (
                        <g style={{ pointerEvents: 'none' }}>
                          {visibleAvatars.map((m, idx) => {
                            const dotX = startX + idx * (dotSize - overlap)
                            const dotY = y + h / 2 - dotSize / 2
                            return (
                              <g key={m.id}>
                                <circle cx={dotX + dotSize / 2} cy={dotY + dotSize / 2} r={dotSize / 2} fill={m.color} stroke="#FFFFFF" strokeWidth={1.5} />
                                <text x={dotX + dotSize / 2} y={dotY + dotSize / 2 + 3} textAnchor="middle" fontSize={8} fontWeight={700} fill="#FFFFFF" fontFamily="Manrope">{initials(m.name)}</text>
                              </g>
                            )
                          })}
                          {extraCount > 0 && (
                            <g>
                              <circle cx={dispX + dispW - 12} cy={y + h / 2} r={dotSize / 2} fill="#FFFFFF" stroke="#171512" strokeWidth={1} />
                              <text x={dispX + dispW - 12} y={y + h / 2 + 3} textAnchor="middle" fontSize={8} fontWeight={700} fill="#171512" fontFamily="Manrope">+{extraCount}</text>
                            </g>
                          )}
                        </g>
                      )
                    })()}
                    <title>{`${t.name}\n${t.startDate} → ${t.endDate}${dispW > w ? ` (${duration} day${duration !== 1 ? 's' : ''} — expanded for visibility)` : ''}\n${assignees.map(a => a.name).join(', ') || 'Unassigned'}${spansHoliday ? `\n⚠ Spans: ${holidayNames.join(', ')}` : ''}`}</title>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* ── V1 Bulk ops (CR-2.4) ─────────────────────────────────────── */}
      {editMode && (
        <V1BulkBar
          selectedIds={selectedTaskIds}
          memberOptions={data?.members || []}
          onClear={() => setSelectedTaskIds(new Set())}
          onDelete={bulkDelete}
          onSetStatus={bulkSetStatus}
          onReassign={bulkReassign}
          onShiftDates={bulkShiftDates}
        />
      )}

      {/* ── Right-click context menu ─────────────────────────────────── */}
      {contextMenu && editMode && (() => {
        const ctxTask = data?.tasks.find(t => t.id === contextMenu.taskId)
        return (
          <div
            className="fixed z-50 bg-white border border-surface-200 rounded-xl shadow-float py-1 min-w-[160px] animate-scale-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => ctxCycleStatus(contextMenu.taskId)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-surface-50 transition-colors text-left">
              ↻ Cycle status
              <span className="ml-auto text-[10px] text-ink-400">{ctxTask ? STATUS_LABEL[ctxTask.status] : ''}</span>
            </button>
            <button onClick={() => { onTaskClick(contextMenu.taskId); setContextMenu(null) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-surface-50 transition-colors text-left">
              <User size={13} className="text-ink-400" /> Reassign…
            </button>
            <button onClick={() => ctxDuplicate(contextMenu.taskId)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-surface-50 transition-colors text-left">
              <Copy size={13} className="text-ink-400" /> Duplicate
            </button>
            <div className="border-t border-surface-100 my-1" />
            <button onClick={() => { setDeleteConfirmId(contextMenu.taskId); setContextMenu(null) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-brick-500 hover:bg-brick-50 transition-colors text-left">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )
      })()}

      {/* ── Delete confirm ───────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete task"
        message={`Delete "${data?.tasks.find(t => t.id === deleteConfirmId)?.name}"? This cannot be undone.`}
        danger
        onConfirm={async () => { if (deleteConfirmId) { await deleteTask(deleteConfirmId); setDeleteConfirmId(null) } }}
        onClose={() => setDeleteConfirmId(null)}
      />
    </div>
  )
})
