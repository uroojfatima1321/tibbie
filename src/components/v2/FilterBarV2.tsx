import { useState, useEffect, useRef, useMemo } from 'react'
import { SlidersHorizontal, X, Star, ChevronDown } from 'lucide-react'
import { useApp } from '../../store/context'
import { Avatar } from '../members/Avatar'
import { type V2FilterState, EMPTY_FILTER, filterToParams, paramsToFilter, isFilterEmpty, BUILT_IN_PRESETS, isValidRice, safeRiceScore } from '../../lib/filterV2'

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

const EFFORT_SIZES = ['S', 'M', 'L', 'XL'] as const

export function FilterBarV2({ filter, onChange }: Props) {
  const { projectsV2, featuresV2, data, modulesV2, userPresets, saveUserPreset, deleteUserPreset } = useApp()
  const [statusOpen, setStatusOpen] = useState(false)
  const [portfolioOpen, setPortfolioOpen] = useState(false)
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [quarterOpen, setQuarterOpen] = useState(false)
  const [presetOpen, setPresetOpen] = useState(false)
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  // BUG-1 (A): module dropdown needs proper open/close state — was always-visible when no moduleId set
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false)
  const moduleDropdownRef = useRef<HTMLDivElement>(null)

  // BUG-1 close on outside-click and Esc
  useEffect(() => {
    if (!moduleDropdownOpen) return
    function onPointerDown(e: PointerEvent) {
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(e.target as Node)) {
        setModuleDropdownOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModuleDropdownOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moduleDropdownOpen])

  const members = data?.members || []
  const portfolios = useMemo(() => [...new Set(projectsV2.map(p => p.portfolio))].sort(), [projectsV2])
  const quarters = useMemo(() => {
    const qs = new Set<string>()
    projectsV2.forEach(p => { if (p.targetQuarter) qs.add(p.targetQuarter) })
    return [...qs].sort()
  }, [projectsV2])

  const allScores = [...projectsV2, ...featuresV2].map(i => safeRiceScore(i.rice)).filter((s): s is number => s !== null)
  const maxScore = allScores.length ? Math.ceil(Math.max(...allScores)) : 100

  function set<K extends keyof V2FilterState>(key: K, val: V2FilterState[K]) {
    onChange({ ...filter, [key]: val, preset: key === 'preset' ? (val as string | null) : null })
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
  function toggleEffort(s: typeof EFFORT_SIZES[number]) {
    const next = filter.effortSizes.includes(s) ? filter.effortSizes.filter(x => x !== s) : [...filter.effortSizes, s]
    set('effortSizes', next)
  }
  function toggleFlag(key: keyof V2FilterState['flags']) {
    set('flags', { ...filter.flags, [key]: !filter.flags[key] })
  }
  function applyPreset(name: string) {
    onChange({ ...EMPTY_FILTER, preset: name })
    setPresetOpen(false)
  }
  async function handleSavePreset() {
    if (!presetName.trim()) return
    await saveUserPreset(presetName.trim(), filter as unknown as Record<string, unknown>)
    setSavingPreset(false); setPresetName('')
  }

  const empty = isFilterEmpty(filter)
  const activeCount = [
    filter.statuses.length, filter.portfolios.length, filter.ownerIds.length,
    filter.effortSizes.length, filter.riceMin !== null ? 1 : 0, filter.riceMax !== null ? 1 : 0,
    filter.quarter ? 1 : 0, ...Object.values(filter.flags).map(v => v ? 1 : 0),
    filter.preset ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const builtInNames = Object.keys(BUILT_IN_PRESETS)

  return (
    <div className="border-b border-surface-200 bg-white px-4 sm:px-6 py-2 flex items-center gap-2 flex-wrap shrink-0">
      <SlidersHorizontal size={13} className="text-ink-400 shrink-0" />

      {/* Preset picker */}
      <div className="relative">
        <button onClick={() => setPresetOpen(v => !v)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.preset ? 'bg-rust-50 border-rust-300 text-rust-600' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}>
          <Star size={11} />
          {filter.preset ?? 'Presets'}
          <ChevronDown size={11} />
        </button>
        {presetOpen && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-surface-200 rounded-xl shadow-float z-30 py-1 animate-fade-in">
            <p className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-ink-400">Built-in</p>
            {builtInNames.map(name => (
              <button key={name} onClick={() => applyPreset(name)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 transition-colors ${filter.preset === name ? 'text-rust-600 font-medium' : 'text-ink-700'}`}>
                {name}
              </button>
            ))}
            {userPresets.length > 0 && (
              <>
                <div className="border-t border-surface-100 my-1" />
                <p className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-ink-400">Saved</p>
                {userPresets.map(p => (
                  <div key={p.name} className="flex items-center group">
                    <button onClick={() => { onChange(p.filter as unknown as V2FilterState); setPresetOpen(false) }}
                      className="flex-1 text-left px-3 py-2 text-sm hover:bg-surface-50 text-ink-700 transition-colors truncate">{p.name}</button>
                    <button onClick={() => deleteUserPreset(p.name)} className="pr-2 opacity-0 group-hover:opacity-100 text-ink-400 hover:text-brick-500 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </>
            )}
            <div className="border-t border-surface-100 mt-1 pt-1 px-3 pb-2">
              {savingPreset ? (
                <div className="flex items-center gap-1.5">
                  <input autoFocus className="input flex-1 text-xs !py-1" placeholder="Preset name" value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setSavingPreset(false) }} />
                  <button onClick={handleSavePreset} className="text-xs text-rust-500 font-medium">Save</button>
                </div>
              ) : (
                <button onClick={() => setSavingPreset(true)} className="text-xs text-ink-500 hover:text-ink-800 transition-colors">
                  + Save current filters…
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="relative">
        <button onClick={() => setStatusOpen(v => !v)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.statuses.length ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}>
          Status{filter.statuses.length ? ` (${filter.statuses.length})` : ''}
        </button>
        {statusOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-surface-200 rounded-xl shadow-float z-30 py-2 animate-fade-in max-h-64 overflow-y-auto">
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
          </div>
        )}
      </div>

      {/* Portfolio */}
      {portfolios.length > 1 && (
        <div className="relative">
          <button onClick={() => setPortfolioOpen(v => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.portfolios.length ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}>
            Portfolio{filter.portfolios.length ? ` (${filter.portfolios.length})` : ''}
          </button>
          {portfolioOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-surface-200 rounded-xl shadow-float z-30 py-2 animate-fade-in max-h-64 overflow-y-auto">
              {portfolios.map(p => (
                <label key={p} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-50 cursor-pointer">
                  <input type="checkbox" checked={filter.portfolios.includes(p)}
                    onChange={() => set('portfolios', filter.portfolios.includes(p) ? filter.portfolios.filter(x => x !== p) : [...filter.portfolios, p])}
                    className="rounded border-surface-300 text-rust-500 focus:ring-rust-400" />
                  <span className="text-sm text-ink-700 truncate">{p}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Owner */}
      {members.length > 0 && (
        <div className="relative">
          <button onClick={() => setOwnerOpen(v => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.ownerIds.length ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}>
            Owner{filter.ownerIds.length ? ` (${filter.ownerIds.length})` : ''}
          </button>
          {ownerOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-surface-200 rounded-xl shadow-float z-30 py-2 animate-fade-in">
              {members.map(m => (
                <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-50 cursor-pointer">
                  <input type="checkbox" checked={filter.ownerIds.includes(m.id)} onChange={() => toggleOwner(m.id)}
                    className="rounded border-surface-300 text-rust-500 focus:ring-rust-400" />
                  <Avatar member={m} size="xs" />
                  <span className="text-sm text-ink-700 truncate">{m.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Effort sizes */}
      <div className="flex items-center gap-0.5">
        {EFFORT_SIZES.map(s => (
          <button key={s} onClick={() => toggleEffort(s)}
            className={`font-mono text-xs px-2 py-0.5 rounded border transition-colors ${filter.effortSizes.includes(s) ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-500 hover:border-ink-400'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* RICE range */}
      {allScores.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-ink-500">
          <span className="shrink-0">RICE</span>
          <input type="number" min={0} max={maxScore} step={0.5} placeholder="min"
            className="w-14 font-mono text-xs border border-surface-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-rust-400"
            value={filter.riceMin ?? ''} onChange={e => set('riceMin', e.target.value ? Number(e.target.value) : null)} />
          <span>–</span>
          <input type="number" min={0} max={maxScore} step={0.5} placeholder="max"
            className="w-14 font-mono text-xs border border-surface-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-rust-400"
            value={filter.riceMax ?? ''} onChange={e => set('riceMax', e.target.value ? Number(e.target.value) : null)} />
        </div>
      )}

      {/* Quarter */}
      {quarters.length > 0 && (
        <div className="relative">
          <button onClick={() => setQuarterOpen(v => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.quarter ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}>
            {filter.quarter ?? 'Quarter'}
          </button>
          {quarterOpen && (
            <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-surface-200 rounded-xl shadow-float z-30 py-1 animate-fade-in">
              <button onClick={() => { set('quarter', null); setQuarterOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm text-ink-400 hover:bg-surface-50">All quarters</button>
              {quarters.map(q => (
                <button key={q} onClick={() => { set('quarter', q); setQuarterOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 font-mono ${filter.quarter === q ? 'text-rust-600 font-medium' : 'text-ink-700'}`}>{q}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUG-1 (A): Module dimension filter with proper open/close state */}
      {modulesV2.length > 0 && (
        <div className="relative" ref={moduleDropdownRef}>
          <button
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter.moduleId ? 'bg-ink-900 text-white border-ink-900' : moduleDropdownOpen ? 'bg-surface-100 border-surface-300 text-ink-700' : 'border-surface-200 text-ink-500 hover:border-surface-300'}`}
            onClick={() => {
              if (filter.moduleId) { setModule(null) }
              else setModuleDropdownOpen(v => !v)
            }}
            title={filter.moduleId ? 'Clear module filter (click)' : 'Filter by module'}
          >
            {filter.moduleId
              ? `↳ ${modulesV2.find(m => m.id === filter.moduleId)?.name ?? 'Module'}`
              : 'Module'
            }
          </button>
          {/* Dropdown: only shown when explicitly opened, never auto-renders */}
          {moduleDropdownOpen && !filter.moduleId && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-surface-200 rounded-xl shadow-float z-30 py-1 animate-fade-in">
              {modulesV2.map(m => (
                <button key={m.id} onClick={() => { setModule(m.id); setModuleDropdownOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-50 text-ink-700">
                  ↳ {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Flag chips */}
      {([
        { key: 'unscored' as const, label: 'Unscored', activeClass: 'bg-amber-50 border-amber-300 text-amber-600' },
        { key: 'stale' as const, label: 'Stale score', activeClass: 'bg-amber-50 border-amber-300 text-amber-600' },
        { key: 'onHold' as const, label: 'On hold', activeClass: 'bg-amber-50 border-amber-300 text-amber-600' },
        { key: 'inRework' as const, label: 'In rework', activeClass: 'bg-amber-50 border-amber-300 text-amber-600' },
        { key: 'blockedTracks' as const, label: 'Blocked tracks', activeClass: 'bg-amber-50 border-amber-300 text-amber-600' },
        { key: 'mustDo' as const, label: 'Must-Do', activeClass: 'bg-brick-50 border-brick-300 text-brick-600' },
        { key: 'clientTimeline' as const, label: 'Client timeline', activeClass: 'bg-amber-50 border-amber-300 text-amber-600' },
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
