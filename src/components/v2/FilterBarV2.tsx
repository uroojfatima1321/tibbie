import { useState, useRef, useMemo } from 'react'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { useApp } from '../../store/context'
import { Avatar } from '../members/Avatar'
import { type V2FilterState, EMPTY_FILTER, isFilterEmpty, filterToParams, paramsToFilter } from '../../lib/filterV2'
import { Popover } from '../ui/Popover'

interface Props {
  filter: V2FilterState
  onChange: (f: V2FilterState) => void
}

const STATUS_GROUPS: { label: string; statuses: string[] }[] = [
  { label: 'Pre-dev', statuses: ['intake', 'requirement_gathering', 'requirement_analysis', 'architecture'] },
  { label: 'Dev', statuses: ['development', 'in_testing', 'in_dev', 'code_review', 'qa', 'staging_signoff', 'tech_review', 'refinement'] },
  { label: 'Live', statuses: ['beta_production', 'production', 'production_monitoring', 'mvp_live', 'shipped'] },
  { label: 'Paused', statuses: ['on_hold', 'rework', 'killed'] },
]

const STATUS_LABELS: Record<string, string> = {
  intake: 'Intake', requirement_gathering: 'Req. Gathering', requirement_analysis: 'Req. Analysis',
  architecture: 'Architecture', development: 'Development', in_testing: 'In Testing',
  in_dev: 'In Dev', code_review: 'Code Review', qa: 'QA', staging_signoff: 'Staging',
  tech_review: 'Tech Review', refinement: 'Refinement', beta_production: 'Beta',
  production: 'Production', production_monitoring: 'Prod. Monitor', mvp_live: 'MVP Live',
  shipped: 'Shipped', on_hold: 'On Hold', rework: 'Rework', killed: 'Killed',
}


export function FilterBarV2({ filter, onChange }: Props) {
  const { projectsV2, featuresV2, data, modulesV2, userPresets, saveUserPreset, deleteUserPreset } = useApp()
  const [statusOpen, setStatusOpen] = useState(false)
  const [portfolioOpen, setPortfolioOpen] = useState(false)
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [quarterOpen, setQuarterOpen] = useState(false)
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false)
  // B2 commit 2: Popover trigger refs for each dropdown (one per filter dimension)
  const statusRef    = useRef<HTMLButtonElement>(null)
  const portfolioRef = useRef<HTMLButtonElement>(null)
  const ownerRef     = useRef<HTMLButtonElement>(null)
  const quarterRef   = useRef<HTMLButtonElement>(null)
  const moduleRef    = useRef<HTMLButtonElement>(null)

  const members = data?.members || []
  const portfolios = useMemo(() => [...new Set(projectsV2.map(p => p.portfolio))].sort(), [projectsV2])
  const quarters = useMemo(() => {
    const qs = new Set<string>()
    projectsV2.forEach(p => { if (p.targetQuarter) qs.add(p.targetQuarter) })
    return [...qs].sort()
  }, [projectsV2])


  function set<K extends keyof V2FilterState>(key: K, val: V2FilterState[K]) {
    onChange({ ...filter, [key]: val })
  }
  function setModule(id: string | null) { set('moduleId', id) }
  function toggleStatus(s: string) {
    const next = filter.statuses.includes(s) ? filter.statuses.filter(x => x !== s) : [...filter.statuses, s]
    set('statuses', next)
  }
  function toggleOwner(id: string) {
    const next = filter.ownerIds.includes(id) ? filter.ownerIds.filter(x => x !== id) : [...filter.ownerIds, id]
    set('ownerIds', next)
  }
  function toggleFlag(key: keyof V2FilterState['flags']) {
    set('flags', { ...filter.flags, [key]: !filter.flags[key] })
  }

  const empty = isFilterEmpty(filter)
  const activeCount = [
    filter.statuses.length, filter.portfolios.length, filter.ownerIds.length,
    filter.quarter ? 1 : 0, filter.moduleId ? 1 : 0,
    ...Object.values(filter.flags).map(v => v ? 1 : 0),
  ].reduce((a, b) => a + b, 0)

  return (
    <div className="border-b border-surface-200 bg-white px-4 sm:px-6 py-2 flex items-center gap-2 flex-wrap shrink-0">
      <SlidersHorizontal size={13} className="text-ink-400 shrink-0" />

      {/* Status — B2 commit 2: Popover primitive */}
      <div>
        <button ref={statusRef} onClick={() => setStatusOpen(v => !v)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.statuses.length ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}>
          Status{filter.statuses.length ? ` (${filter.statuses.length})` : ''}
        </button>
        <Popover triggerRef={statusRef} open={statusOpen} onOpenChange={setStatusOpen} placement="bottom-start" className="w-56 py-2">
          {STATUS_GROUPS.map(g => (
            <div key={g.label}>
              <p className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-ink-400">{g.label}</p>
              {g.statuses.map(s => (
                <label key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-50 cursor-pointer">
                  <input type="checkbox" checked={filter.statuses.includes(s)} onChange={() => toggleStatus(s)}
                    className="rounded border-surface-300 text-rust-500 focus:ring-rust-400" />
                  <span className="text-sm text-ink-700">{STATUS_LABELS[s] ?? s}</span>
                </label>
              ))}
            </div>
          ))}
        </Popover>
      </div>

      {/* Portfolio — B2 commit 2 */}
      {portfolios.length > 1 && (
        <div>
          <button ref={portfolioRef} onClick={() => setPortfolioOpen(v => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.portfolios.length ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}>
            Portfolio{filter.portfolios.length ? ` (${filter.portfolios.length})` : ''}
          </button>
          <Popover triggerRef={portfolioRef} open={portfolioOpen} onOpenChange={setPortfolioOpen} placement="bottom-start" className="w-56 py-2">
            {portfolios.map(p => (
              <label key={p} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-50 cursor-pointer">
                <input type="checkbox" checked={filter.portfolios.includes(p)}
                  onChange={() => set('portfolios', filter.portfolios.includes(p) ? filter.portfolios.filter(x => x !== p) : [...filter.portfolios, p])}
                  className="rounded border-surface-300 text-rust-500 focus:ring-rust-400" />
                <span className="text-sm text-ink-700 truncate">{p}</span>
              </label>
            ))}
          </Popover>
        </div>
      )}

      {/* Owner — B2 commit 2 */}
      {members.length > 0 && (
        <div>
          <button ref={ownerRef} onClick={() => setOwnerOpen(v => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.ownerIds.length ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}>
            Owner{filter.ownerIds.length ? ` (${filter.ownerIds.length})` : ''}
          </button>
          <Popover triggerRef={ownerRef} open={ownerOpen} onOpenChange={setOwnerOpen} placement="bottom-start" className="w-48 py-2">
            {members.map(m => (
              <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-50 cursor-pointer">
                <input type="checkbox" checked={filter.ownerIds.includes(m.id)} onChange={() => toggleOwner(m.id)}
                  className="rounded border-surface-300 text-rust-500 focus:ring-rust-400" />
                <Avatar member={m} size="xs" />
                <span className="text-sm text-ink-700 truncate">{m.name}</span>
              </label>
            ))}
          </Popover>
        </div>
      )}
      {/* Quarter — B2 commit 2 */}
      {quarters.length > 0 && (
        <div>
          <button ref={quarterRef} onClick={() => setQuarterOpen(v => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.quarter ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}>
            {filter.quarter ?? 'Quarter'}
          </button>
          <Popover triggerRef={quarterRef} open={quarterOpen} onOpenChange={setQuarterOpen} placement="bottom-start" className="w-36 py-1">
            <button onClick={() => { set('quarter', null); setQuarterOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-ink-400 hover:bg-surface-50">All quarters</button>
            {quarters.map(q => (
              <button key={q} onClick={() => { set('quarter', q); setQuarterOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 font-mono ${filter.quarter === q ? 'text-rust-600 font-medium' : 'text-ink-700'}`}>{q}</button>
            ))}
          </Popover>
        </div>
      )}

      {/* Module — B2 commit 2: Popover primitive */}
      {modulesV2.length > 0 && (
        <div>
          <button ref={moduleRef}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.moduleId ? 'bg-ink-900 text-white border-ink-900' : moduleDropdownOpen ? 'bg-surface-100 border-surface-300 text-ink-700' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}
            onClick={() => { if (filter.moduleId) setModule(null); else setModuleDropdownOpen(v => !v) }}
            title={filter.moduleId ? 'Clear module filter (click)' : 'Filter by module'}
          >
            {filter.moduleId ? `↳ ${modulesV2.find(m => m.id === filter.moduleId)?.name ?? 'Module'}` : 'Module'}
          </button>
          <Popover triggerRef={moduleRef} open={moduleDropdownOpen && !filter.moduleId} onOpenChange={setModuleDropdownOpen} placement="bottom-start" className="w-52 py-1">
            {modulesV2.map(m => (
              <button key={m.id} onClick={() => { setModule(m.id); setModuleDropdownOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-50 text-ink-700">
                ↳ {m.name}
              </button>
            ))}
          </Popover>
        </div>
      )}

      {/* Flag chips */}
      {([        { key: 'onHold' as const, label: 'On hold', activeClass: 'bg-amber-50 border-amber-300 text-amber-600' },
        { key: 'inRework' as const, label: 'In rework', activeClass: 'bg-amber-50 border-amber-300 text-amber-600' },
        { key: 'blockedTracks' as const, label: 'Blocked tracks', activeClass: 'bg-amber-50 border-amber-300 text-amber-600' },        { key: 'clientTimeline' as const, label: 'Client timeline', activeClass: 'bg-amber-50 border-amber-300 text-amber-600' },
      ] as const).map(({ key, label, activeClass }) => (
        <button key={key} onClick={() => toggleFlag(key)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.flags[key] ? activeClass : 'border-surface-200 text-ink-400 hover:border-surface-300'}`}>
          {label}
        </button>
      ))}

      {/* Clear */}
      {!empty && (
        <button onClick={() => onChange(EMPTY_FILTER)}
          className="flex items-center gap-1 text-xs text-brick-500 hover:text-brick-600 transition-colors ml-auto shrink-0">
          <X size={12} /> Clear {activeCount > 0 ? `(${activeCount})` : ''}
        </button>
      )}
    </div>
  )
}
