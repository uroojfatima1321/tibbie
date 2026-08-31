import { useState, createRef, useMemo } from 'react'
import { Layers } from 'lucide-react'
import { PrioritizeTable, type TypeFilter } from './PrioritizeTable'
import { PrioritizeJumpBar } from './PrioritizeJumpBar'
import { QuadrantView, QuadrantMobileFallback } from './QuadrantView'
import { BulkBar } from './BulkBar'
import { FilterBarV2 } from './FilterBarV2'
import { useApp } from '../../store/context'
import { useLocalStorage } from '../../lib/useLocalStorage'
import type { V2FilterState } from '../../lib/filterV2'
import type { SectionId } from '../../lib/prioritizeSections'

type SubTab = 'table' | 'quadrant'

interface Props {
  onOpenFeature: (id: string, scrollToRice?: boolean) => void
  onOpenProject: (id: string) => void
  filter: V2FilterState
  onFilterChange: (f: V2FilterState) => void
}

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'All', both: 'All', projects: 'Projects', features: 'Features', improvements: 'Improvements', modules: 'Modules',
}

const ALL_SECTION_IDS: SectionId[] = ['must-do', 'ranked', 'needs-scoring', 'in-delivery', 'live']

function readGroupPref(): boolean {
  try { return localStorage.getItem('tibbie-prioritize-group') === '1' } catch { return false }
}

export function PrioritizeView({ onOpenFeature, onOpenProject, filter, onFilterChange }: Props) {
  const { featuresV2 } = useApp()
  const [subTab, setSubTab] = useState<SubTab>('table')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [groupByProject, setGroupByProject] = useState<boolean>(readGroupPref)
  // Item 4: showInDelivery toggle persisted in localStorage
  const [showInDelivery, setShowInDelivery] = useLocalStorage('tibbie.filters.showInDelivery', true)

  // Item 4: stable section refs passed to both JumpBar and PrioritizeTable
  const sectionRefs = useMemo(() =>
    Object.fromEntries(ALL_SECTION_IDS.map(id => [id, createRef<HTMLDivElement>()])) as Record<SectionId, React.RefObject<HTMLDivElement>>
  , [])

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleGroup() {
    setGroupByProject(v => {
      const next = !v
      try { localStorage.setItem('tibbie-prioritize-group', next ? '1' : '0') } catch {}
      return next
    })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <FilterBarV2 filter={filter} onChange={onFilterChange} />

      {/* Controls row */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b border-surface-200 shrink-0 flex-wrap">
        <div className="flex items-center gap-1 bg-surface-100 rounded-lg p-0.5">
          {(['table', 'quadrant'] as SubTab[]).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${subTab === t ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-surface-100 rounded-lg p-0.5">
          {(['all', 'projects', 'features', 'improvements', 'modules'] as TypeFilter[]).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${typeFilter === t ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {subTab === 'table' && (
          <button onClick={toggleGroup} title="Group by project"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${groupByProject ? 'bg-ink-900 text-white' : 'text-ink-500 bg-surface-100 hover:bg-surface-200'}`}>
            <Layers size={12} /> Group
          </button>
        )}

        {/* Item 4: Show in-delivery toggle */}
        {subTab === 'table' && (
          <label className="flex items-center gap-1.5 text-xs text-ink-500 cursor-pointer select-none">
            <input type="checkbox" checked={showInDelivery} onChange={e => setShowInDelivery(e.target.checked)}
              className="rounded border-surface-300 text-rust-500 focus:ring-rust-400" />
            Show in-delivery
          </label>
        )}
      </div>

      {subTab === 'table' ? (
        <>
          {/* Item 4: Jump bar — sits between controls and table */}
          <PrioritizeJumpBar sectionRefs={sectionRefs} />
          <PrioritizeTable
            typeFilter={typeFilter}
            onOpenFeature={onOpenFeature}
            onOpenProject={onOpenProject}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={ids => setSelectedIds(new Set(ids))}
            groupByProject={groupByProject}
            showInDelivery={showInDelivery}
            sectionRefs={sectionRefs}
          />
        </>
      ) : (
        <>
          <div className="hidden lg:flex flex-1 min-h-0">
            <QuadrantView onOpenFeature={onOpenFeature} onOpenProject={onOpenProject} />
          </div>
          <div className="flex flex-col flex-1 lg:hidden">
            <QuadrantMobileFallback onOpenFeature={onOpenFeature} />
          </div>
        </>
      )}

      <BulkBar selectedIds={[...selectedIds]} allFeatures={featuresV2} onClear={() => setSelectedIds(new Set())} />
    </div>
  )
}
