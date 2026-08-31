/**
 * RoadmapView — EXC-1 (M5.1 C)
 * Restructured to THREE type-wise sections:
 *   1. Products (projectsV2), grouped by portfolio
 *   2. Modules (modulesV2), grouped by portfolio (inherited if absent)
 *   3. Features / Improvements (featuresV2), grouped by parent project's portfolio
 */
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useApp } from '../../store/context'
import type { ProjectV2, FeatureV2, ModuleV2 } from '../../types'
import { ProjectCard } from './ProjectCard'
import { ModuleCard } from './ModuleCard'
import { FeatureCard } from './FeatureCard'
import { InfoTip } from './InfoTip'
import { isValidRice, safeRiceScore } from '../../lib/filterV2'
import { FilterBarV2 } from './FilterBarV2'
import { ExportButton } from './ExportModal'
import { RoadmapExportLayout } from './RoadmapExportLayout'
import { applyV2Filter, type V2FilterState } from '../../lib/filterV2'
import { RoadmapBulkBar } from './RoadmapBulkBar'
import { RoadmapKebabMenu, type KebabTarget } from './RoadmapKebabMenu'

interface Props {
  onOpenProject: (id: string) => void
  onOpenModule: (id: string) => void
  onOpenFeature: (id: string) => void
  onNewProject: () => void
  onNewFeature: (projectId?: string) => void
  filter: V2FilterState
  onFilterChange: (f: V2FilterState) => void
}

function computeTopRice(features: FeatureV2[]): number | null {
  const scores = features.map(f => safeRiceScore(f.rice)).filter((s): s is number => s !== null)
  return scores.length > 0 ? Math.max(...scores) : null
}

export function RoadmapView({ onOpenProject, onOpenModule, onOpenFeature, onNewProject, onNewFeature, filter, onFilterChange }: Props) {
  const { projectsV2, featuresV2, modulesV2, data, rankedItemIds, editMode, localMode, loadDemoData } = useApp()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [kebab, setKebab] = useState<KebabTarget | null>(null)

  function openKebab(e: React.MouseEvent, id: string, kind: 'project' | 'feature', currentStatus: string) {
    e.stopPropagation()
    setKebab({ id, kind, x: e.clientX, y: e.clientY, currentStatus })
  }
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function clearSelection() { setSelectedIds(new Set()) }

  // Apply filter to all item types
  const allItems = [...projectsV2, ...featuresV2, ...(modulesV2 as any[])]
  const filtered = applyV2Filter(allItems, filter)
  const filteredProjectIds = new Set(filtered.filter(i => i.kind === 'project').map(i => i.id))
  const filteredFeatureIds  = new Set(filtered.filter(i => i.kind === 'feature').map(i => i.id))
  const filteredModuleIds   = new Set(filtered.filter(i => i.kind === 'module').map(i => i.id))

  const members = data?.members || []

  function rankOf(id: string): number | null {
    const i = rankedItemIds.indexOf(id); return i >= 0 ? i + 1 : null
  }

  // ── Section 1: Products ───────────────────────────────────────────────────
  const productPortfolios = useMemo(() => {
    const names = [...new Set(projectsV2.map(p => p.portfolio))].sort()
    return names.map(name => {
      const projects = projectsV2.filter(p => p.portfolio === name && filteredProjectIds.has(p.id)).sort((a, b) => a.order - b.order)
      return { name, projects }
    }).filter(s => s.projects.length > 0)
  }, [projectsV2, filteredProjectIds])

  const featuresByProject = useMemo(() => {
    const map: Record<string, FeatureV2[]> = {}
    for (const f of featuresV2) if (f.projectId) { if (!map[f.projectId]) map[f.projectId] = []; map[f.projectId].push(f) }
    return map
  }, [featuresV2])

  // ── Section 2: Modules ────────────────────────────────────────────────────
  const modulePortfolios = useMemo(() => {
    // Portfolio: module's own portfolio, or inherit from parent project
    const projectPortfolioMap = new Map(projectsV2.map(p => [p.id, p.portfolio]))
    function modulePortfolio(m: ModuleV2): string {
      return m.portfolio ?? projectPortfolioMap.get(m.projectId) ?? 'Other'
    }
    const mods = modulesV2.filter(m => filteredModuleIds.has(m.id))
    const names = [...new Set(mods.map(modulePortfolio))].sort()
    return names.map(name => {
      const modules_ = mods.filter(m => modulePortfolio(m) === name)
      return { name, modules: modules_ }
    }).filter(s => s.modules.length > 0)
  }, [modulesV2, projectsV2, filteredModuleIds])

  const featuresByModule = useMemo(() => {
    const map: Record<string, FeatureV2[]> = {}
    for (const f of featuresV2) if (f.moduleId) { if (!map[f.moduleId]) map[f.moduleId] = []; map[f.moduleId].push(f) }
    return map
  }, [featuresV2])

  // ── Section 3: Features/Improvements ──────────────────────────────────────
  const featurePortfolios = useMemo(() => {
    const projectPortfolioMap = new Map(projectsV2.map(p => [p.id, p.portfolio]))
    const allFeatsByPortfolio = new Map<string, FeatureV2[]>()
    for (const f of featuresV2.filter(f => filteredFeatureIds.has(f.id))) {
      const portfolio = f.projectId ? (projectPortfolioMap.get(f.projectId) ?? 'Backlog') : 'Backlog'
      if (!allFeatsByPortfolio.has(portfolio)) allFeatsByPortfolio.set(portfolio, [])
      allFeatsByPortfolio.get(portfolio)!.push(f)
    }
    return [...allFeatsByPortfolio.entries()].map(([name, features]) => ({ name, features }))
      .sort((a, b) => (a.name === 'Backlog' ? 1 : 0) - (b.name === 'Backlog' ? 1 : 0) || a.name.localeCompare(b.name))
  }, [featuresV2, projectsV2, filteredFeatureIds])

  // For export
  const exportPortfolios = useMemo(() => {
    const names = [...new Set(projectsV2.map(p => p.portfolio))].sort()
    return names.map(name => ({ name, projects: projectsV2.filter(p => p.portfolio === name) }))
  }, [projectsV2])

  const hasContent = projectsV2.length > 0 || featuresV2.length > 0 || modulesV2.length > 0

  if (!hasContent) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="max-w-sm text-center space-y-3">
          {localMode ? (
            <>
              <p className="font-display text-2xl text-ink-900">Local sandbox</p>
              <p className="text-sm text-ink-500">Nothing saved here — changes stay in this tab only.</p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button onClick={onNewProject} className="btn-outline focus:outline-none focus:ring-2 focus:ring-rust-200"><Plus size={15} /> New project</button>
                <button onClick={() => loadDemoData()} className="text-sm text-ink-400 hover:text-ink-700 transition-colors">[Load demo data]</button>
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-2xl text-ink-900">Your roadmap is empty.</p>
              <p className="text-sm text-ink-500">Add your first project to get started.</p>
              <button onClick={onNewProject} className="btn-primary focus:outline-none focus:ring-2 focus:ring-rust-200"><Plus size={15} /> New project</button>
            </>
          )}
        </div>
      </div>
    )
  }

  function SectionHeader({ label, count, sectionKey }: { label: string; count: number; sectionKey: string }) {
    const isCollapsed = !!collapsed[sectionKey]
    return (
      <button onClick={() => setCollapsed(c => ({ ...c, [sectionKey]: !c[sectionKey] }))}
        className="flex items-center gap-2 group mb-4" aria-expanded={!isCollapsed}>
        {isCollapsed ? <ChevronRight size={16} className="text-ink-400 group-hover:text-ink-700 transition-colors" />
          : <ChevronDown size={16} className="text-ink-400 group-hover:text-ink-700 transition-colors" />}
        <h2 className="font-display text-[18px] font-semibold text-ink-900">{label}</h2>
        <span className="font-mono text-xs text-ink-400 bg-surface-100 px-2 py-0.5 rounded-full">{count}</span>
      </button>
    )
  }

  function PortfolioGroup({ name, sectionKey, children }: { name: string; sectionKey: string; children: React.ReactNode }) {
    const key = `${sectionKey}-${name}`
    const isCollapsed = !!collapsed[key]
    return (
      <section key={name}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900 transition-colors">
            {isCollapsed ? <ChevronRight size={13} className="text-ink-400" /> : <ChevronDown size={13} className="text-ink-400" />}
            {name}
          </button>
        </div>
        {!isCollapsed && children}
      </section>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <FilterBarV2 filter={filter} onChange={onFilterChange} />
      <div className="flex items-center justify-end px-4 sm:px-6 py-2 border-b border-surface-100 shrink-0">
        <ExportButton portfolios={exportPortfolios} />
      </div>

      <div className="flex-1 overflow-y-auto tibbie-scroll">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-10">

          {/* ── Section 1: Products ── */}
          {productPortfolios.length > 0 && (
            <div>
              <SectionHeader label="Products" count={productPortfolios.reduce((s, p) => s + p.projects.length, 0)} sectionKey="products" />
              {!collapsed['products'] && (
                <div className="space-y-8">
                  {productPortfolios.map(({ name, projects }) => (
                    <PortfolioGroup key={name} name={name} sectionKey="products">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {projects.map((project, i) => {
                          const pFeatures = featuresByProject[project.id] || []
                          const topRice = computeTopRice(pFeatures)
                          return (
                            <ProjectCard key={project.id} project={project} index={i}
                              rank={rankOf(project.id)} totalScored={rankedItemIds.length}
                              features={pFeatures} members={members} topRiceScore={topRice}
                              onOpen={() => onOpenProject(project.id)}
                              onKebab={e => openKebab(e, project.id, 'project', project.status)} />
                          )
                        })}
                      </div>
                    </PortfolioGroup>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Section 2: Modules ── */}
          {modulePortfolios.length > 0 && (
            <div>
              <SectionHeader label="Modules" count={modulePortfolios.reduce((s, p) => s + p.modules.length, 0)} sectionKey="modules" />
              {!collapsed['modules'] && (
                <div className="space-y-8">
                  {modulePortfolios.map(({ name, modules }) => (
                    <PortfolioGroup key={name} name={name} sectionKey="modules">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {modules.map(mod => {
                          const mFeatures = featuresByModule[mod.id] || []
                          const modParent = projectsV2.find(p => p.id === mod.projectId) ?? null
                          return (
                            <ModuleCard key={mod.id} module_={mod}
                              rank={rankOf(mod.id)} totalScored={rankedItemIds.length}
                              childFeatures={mFeatures} members={members}
                              parentProject={modParent}
                              onOpen={() => onOpenModule(mod.id)}
                              onKebab={e => { e.stopPropagation(); /* TODO: module kebab */ }} />
                          )
                        })}
                      </div>
                    </PortfolioGroup>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Section 3: Features / Improvements ── */}
          {featurePortfolios.length > 0 && (
            <div>
              <SectionHeader label="Features & Improvements" count={featurePortfolios.reduce((s, p) => s + p.features.length, 0)} sectionKey="features" />
              {!collapsed['features'] && (
                <div className="space-y-8">
                  {featurePortfolios.map(({ name, features }) => (
                    <PortfolioGroup key={name} name={name} sectionKey="features">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {features.map(f => {
                          const fMod = f.moduleId ? modulesV2.find(m => m.id === f.moduleId) : null
                          const parentProject = f.projectId ? projectsV2.find(p => p.id === f.projectId) ?? null : null
                          return (
                            <FeatureCard key={f.id} feature={f}
                              rank={rankOf(f.id)} totalScored={rankedItemIds.length}
                              parentProject={parentProject}
                              parentModule={fMod ? { id: fMod.id, name: fMod.name } : null}
                              onOpen={() => onOpenFeature(f.id)}
                              onOpenParent={parentProject ? () => onOpenProject(parentProject.id) : undefined}
                              onKebab={e => openKebab(e, f.id, 'feature', f.status)} />
                          )
                        })}
                      </div>
                    </PortfolioGroup>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <RoadmapKebabMenu target={kebab} onClose={() => setKebab(null)}
        onOpenItem={(id, kind) => { if (kind === 'project') onOpenProject(id); else onOpenFeature(id) }} />
      {editMode && (
        <RoadmapBulkBar selectedIds={selectedIds} allProjects={projectsV2} allFeatures={featuresV2}
          portfolios={[...new Set(projectsV2.map(p => p.portfolio))]}
          onClear={clearSelection} />
      )}
      <RoadmapExportLayout portfolios={exportPortfolios} features={featuresV2} members={members} />
    </div>
  )
}
