import { AlertTriangle, Flag } from 'lucide-react'
import { useMemo } from 'react'
import { useApp } from '../../store/context'
import { isOverdue, isDueSoon } from '../../lib/dates'

export function StatusBanner({ onShowTask }: { onShowTask: (id: string) => void }) {
  const { data } = useApp()

  const { overdue, dueSoon } = useMemo(() => {
    if (!data) return { overdue: [], dueSoon: [] }
    return {
      overdue: data.tasks.filter(t => isOverdue(t.endDate, t.status)),
      dueSoon: data.tasks.filter(t => isDueSoon(t.endDate, t.status) && !isOverdue(t.endDate, t.status)),
    }
  }, [data])

  if (overdue.length === 0 && dueSoon.length === 0) return null

  return (
    <div className="px-4 sm:px-6 py-2 bg-cream-100/60 border-b border-cream-300 flex items-center gap-4 flex-wrap text-xs">
      {overdue.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brick-500/10 text-brick-500 font-semibold">
            <AlertTriangle size={12} />
            {overdue.length} overdue
          </span>
          <span className="text-ink-500 hidden sm:inline">
            {overdue.slice(0, 3).map((t, i) => (
              <span key={t.id}>
                {i > 0 && ', '}
                <button onClick={() => onShowTask(t.id)} className="hover:text-ink-900 underline-offset-2 hover:underline">{t.name}</button>
              </span>
            ))}
            {overdue.length > 3 && ` +${overdue.length - 3} more`}
          </span>
        </div>
      )}
      {dueSoon.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-semibold">
            <Flag size={12} />
            {dueSoon.length} due this week
          </span>
        </div>
      )}
    </div>
  )
}
