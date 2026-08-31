/**
 * TasksSection — Item 5
 * Displays tasks for a project (optionally filtered to a module).
 * Inline add: Enter-to-submit, same registry pattern as other inline adds.
 * Row click → triggers Gantt jump: switch to timeline view + pulse highlight.
 *
 * All inputs at module scope (input registry compliance).
 */
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Flag, CheckCircle, Circle, AlertCircle } from 'lucide-react'
import { useApp } from '../../store/context'
import { today, addDaysISO } from '../../lib/dates'

interface TaskRowProps {
  taskId: string
  name: string
  status: string
  endDate?: string
  assigneeIds: string[]
  isMilestone: boolean
  onOpen: () => void
}

// Module-scope TaskRow (input registry: no inline component definitions)
function TaskRow({ taskId, name, status, endDate, assigneeIds, isMilestone, onOpen }: TaskRowProps) {
  const { data } = useApp()
  const members = data?.members || []
  const assignees = members.filter(m => assigneeIds.includes(m.id))
  const isOverdue = endDate && new Date(endDate) < new Date() && status !== 'done'

  function statusIcon() {
    if (status === 'done')        return <CheckCircle size={11} className="text-forest-500 shrink-0" />
    if (status === 'in_progress') return <Circle size={11} className="text-steel-500 shrink-0" />
    if (status === 'blocked')     return <AlertCircle size={11} className="text-brick-500 shrink-0" />
    return <Circle size={11} className="text-ink-300 shrink-0" />
  }

  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-50 text-sm w-full text-left transition-colors"
    >
      {statusIcon()}
      {isMilestone && <Flag size={10} className="text-amber-500 shrink-0" />}
      <span className={`flex-1 truncate text-ink-800 ${status === 'done' ? 'line-through text-ink-400' : ''}`}>
        {name}
      </span>
      {endDate && (
        <span className={`font-mono text-[10px] shrink-0 ${isOverdue ? 'text-brick-500' : 'text-ink-400'}`}>
          {format(parseISO(endDate), 'MMM d')}
        </span>
      )}
      {assignees.slice(0, 2).map(m => (
        <span key={m.id}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
          style={{ backgroundColor: m.color }}
          title={m.name}>
          {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </span>
      ))}
    </button>
  )
}

// Module-scope inline add input (input registry compliance)
interface InlineAddTaskProps {
  projectId: string
  moduleId?: string | null
  onAdded: () => void
}

function InlineAddTask({ projectId, moduleId, onAdded }: InlineAddTaskProps) {
  const { addTask, editMode } = useApp()
  const [val, setVal] = useState('')

  if (!editMode) return null

  return (
    <input
      className="w-full bg-transparent text-xs outline-none placeholder:text-ink-300 text-ink-700 px-2 py-1.5 border-t border-surface-100"
      placeholder="+ Add task — Enter"
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={async e => {
        if (e.key === 'Enter' && val.trim()) {
          const t = today()
          await addTask({
            projectId,
            moduleId: moduleId ?? null,
            name: val.trim(),
            notes: '',
            startDate: t,
            endDate: addDaysISO(t, 5),
            status: 'not_started',
            percentComplete: 0,
            isMilestone: false,
            assigneeIds: [],
            recurring: null,
          })
          setVal('')
          onAdded()
        }
      }}
    />
  )
}

// ── Main component ──────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  moduleId?: string | null
  onOpenTaskInGantt: (taskId: string) => void
}

export function TasksSection({ projectId, moduleId, onOpenTaskInGantt }: Props) {
  const { data } = useApp()
  const allTasks = data?.tasks || []

  const tasks = allTasks.filter(t => {
    if (t.projectId !== projectId) return false
    if (moduleId !== undefined) return (t as any).moduleId === (moduleId ?? null)
    return true
  }).sort((a, b) => a.startDate.localeCompare(b.startDate))

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1">
        Tasks ({tasks.length})
      </p>
      <div className="space-y-0.5">
        {tasks.length === 0 ? (
          <p className="text-xs text-ink-400 px-2">No tasks yet.</p>
        ) : (
          tasks.map(t => (
            <TaskRow
              key={t.id}
              taskId={t.id}
              name={t.name}
              status={t.status}
              endDate={t.endDate}
              assigneeIds={t.assigneeIds}
              isMilestone={t.isMilestone}
              onOpen={() => onOpenTaskInGantt(t.id)}
            />
          ))
        )}
      </div>
      <InlineAddTask
        projectId={projectId}
        moduleId={moduleId}
        onAdded={() => {/* tasks list re-renders via context */}}
      />
    </div>
  )
}
