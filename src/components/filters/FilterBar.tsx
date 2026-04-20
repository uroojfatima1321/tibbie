import { useMemo, useState } from 'react'
import { SlidersHorizontal, X, ChevronDown, Calendar as CalIcon } from 'lucide-react'
import type { TaskStatus, Filters } from '../../types'
import { useApp } from '../../store/context'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { fmtShort } from '../../lib/dates'

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  at_risk: 'At risk',
  done: 'Done',
}

export function FilterBar() {
  const { filters, setFilters, data, groupBy, setGroupBy, zoom, setZoom } = useApp()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()

  const activeCount =
    filters.projectIds.length +
    filters.statuses.length +
    filters.memberIds.length +
    (filters.dateRange.start || filters.dateRange.end ? 1 : 0)

  const clearAll = () => setFilters({ projectIds: [], statuses: [], memberIds: [], dateRange: { start: null, end: null } })

  const projectChips = useMemo(
    () => filters.projectIds.map(id => data?.projects.find(p => p.id === id)).filter(Boolean),
    [filters.projectIds, data],
  )
  const memberChips = useMemo(
    () => filters.memberIds.map(id => data?.members.find(m => m.id === id)).filter(Boolean),
    [filters.memberIds, data],
  )

  return (
    <>
      <div className="border-b border-cream-300 bg-cream-100/70 backdrop-blur px-4 sm:px-6 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter toggle */}
          <button onClick={() => setDrawerOpen(true)} className="btn-outline">
            <SlidersHorizontal size={14} />
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="ml-1 text-[10px] font-semibold px-1.5 rounded-full bg-rust-500 text-cream-50">{activeCount}</span>
            )}
          </button>

          {/* Active chips */}
          {projectChips.map(p => p && (
            <button key={p.id} onClick={() => setFilters(f => ({ ...f, projectIds: f.projectIds.filter(id => id !== p.id) }))} className="chip hover:bg-cream-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
              <X size={12} />
            </button>
          ))}
          {filters.statuses.map(s => (
            <button key={s} onClick={() => setFilters(f => ({ ...f, statuses: f.statuses.filter(x => x !== s) }))} className="chip hover:bg-cream-300">
              {STATUS_LABELS[s]}
              <X size={12} />
            </button>
          ))}
          {memberChips.map(m => m && (
            <button key={m.id} onClick={() => setFilters(f => ({ ...f, memberIds: f.memberIds.filter(id => id !== m.id) }))} className="chip hover:bg-cream-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              {m.name}
              <X size={12} />
            </button>
          ))}
          {(filters.dateRange.start || filters.dateRange.end) && (
            <button onClick={() => setFilters(f => ({ ...f, dateRange: { start: null, end: null } }))} className="chip hover:bg-cream-300">
              <CalIcon size={12} />
              {filters.dateRange.start ? fmtShort(filters.dateRange.start) : '…'}
              {' – '}
              {filters.dateRange.end ? fmtShort(filters.dateRange.end) : '…'}
              <X size={12} />
            </button>
          )}

          {activeCount > 0 && (
            <button onClick={clearAll} className="text-xs text-ink-500 hover:text-ink-900 ml-1">
              Clear all
            </button>
          )}

          <div className="flex-1" />

          {/* Group by (desktop) */}
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-xs text-ink-500 mr-1">Group</span>
            {(['project', 'assignee', 'none'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${groupBy === g ? 'bg-ink-900 text-cream-50' : 'text-ink-600 hover:bg-cream-200'}`}
              >
                {g === 'none' ? 'None' : g[0].toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-ink-500 mr-1 hidden sm:inline">Zoom</span>
            {(['day', 'week', 'month'] as const).map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${zoom === z ? 'bg-ink-900 text-cream-50' : 'text-ink-600 hover:bg-cream-200'}`}
              >
                {z[0].toUpperCase() + z.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {drawerOpen && <FilterDrawer onClose={() => setDrawerOpen(false)} />}
    </>
  )
}

function FilterDrawer({ onClose }: { onClose: () => void }) {
  const { filters, setFilters, data } = useApp()
  if (!data) return null

  const toggle = <K extends keyof Filters>(key: K, value: string) => {
    setFilters(f => {
      const arr = f[key] as string[]
      return { ...f, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] } as Filters
    })
  }

  return (
    <div className="fixed inset-0 z-40 animate-fade-in">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-96 bg-cream-50 shadow-float flex flex-col animate-slide-up sm:animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-300">
          <h3 className="font-display font-semibold text-lg">Filters</h3>
          <button onClick={onClose} className="btn-ghost !p-1.5"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto tibbie-scroll p-5 space-y-6">
          <FilterSection title="Projects">
            {data.projects.map(p => (
              <Checkbox key={p.id} checked={filters.projectIds.includes(p.id)} onChange={() => toggle('projectIds', p.id)}>
                <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: p.color }} />
                {p.name}
              </Checkbox>
            ))}
            {data.projects.length === 0 && <p className="text-sm text-ink-400">No projects yet</p>}
          </FilterSection>

          <FilterSection title="Status">
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map(s => (
              <Checkbox key={s} checked={filters.statuses.includes(s)} onChange={() => toggle('statuses', s)}>
                {STATUS_LABELS[s]}
              </Checkbox>
            ))}
          </FilterSection>

          <FilterSection title="Members">
            {data.members.map(m => (
              <Checkbox key={m.id} checked={filters.memberIds.includes(m.id)} onChange={() => toggle('memberIds', m.id)}>
                <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: m.color }} />
                {m.name}
              </Checkbox>
            ))}
            {data.members.length === 0 && <p className="text-sm text-ink-400">No members yet</p>}
          </FilterSection>

          <FilterSection title="Date range">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-ink-500 mb-1">From</label>
                <input type="date" className="input" value={filters.dateRange.start || ''} onChange={e => setFilters(f => ({ ...f, dateRange: { ...f.dateRange, start: e.target.value || null } }))} />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">To</label>
                <input type="date" className="input" value={filters.dateRange.end || ''} onChange={e => setFilters(f => ({ ...f, dateRange: { ...f.dateRange, end: e.target.value || null } }))} />
              </div>
            </div>
          </FilterSection>
        </div>
      </div>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm py-1">
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded border-cream-300 text-rust-500 focus:ring-rust-400" />
      <span className="flex items-center">{children}</span>
    </label>
  )
}
