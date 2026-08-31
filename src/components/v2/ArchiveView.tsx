import { useState } from 'react'
import { ArchiveRestore, Trash2 } from 'lucide-react'
import { useApp } from '../../store/context'
import type { ProjectV2, FeatureV2, ModuleV2 } from '../../types'
import { StatusPill } from './StatusPill'
import { ConfirmDialog as Confirm } from '../ui/Confirm'

type ArchiveFilter = 'all' | 'shipped' | 'killed'

const SHIPPED_STATUSES = ['production', 'production_monitoring', 'mvp_live', 'shipped']
const KILLED_STATUSES  = ['killed']

interface Props {
  onOpenProject: (id: string) => void
  onOpenFeature: (id: string) => void
  onOpenModule?: (id: string) => void
}

export function ArchiveView({ onOpenProject, onOpenFeature, onOpenModule }: Props) {
  const {
    data, restoreProjectV2, restoreFeatureV2, restoreModuleV2,
    permanentDeleteProjectV2, permanentDeleteFeatureV2, permanentDeleteMany, permanentDeleteModuleV2,
    archivedProjectsV2, archivedFeaturesV2, archivedModulesV2,
  } = useApp()
  const [filter, setFilter] = useState<ArchiveFilter>('all')
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; kind: 'project' | 'feature' | 'module'; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget]   = useState<{ id: string; kind: 'project' | 'feature' | 'module'; name: string; featureCount?: number } | null>(null)
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  const archivedProjects = archivedProjectsV2 || []
  const archivedFeatures = archivedFeaturesV2 || []
  const archivedModules  = archivedModulesV2  || []

  function filterItems<T extends { status: string }>(items: T[]): T[] {
    if (filter === 'shipped') return items.filter(i => SHIPPED_STATUSES.includes(i.status))
    if (filter === 'killed') return items.filter(i => KILLED_STATUSES.includes(i.status))
    return items
  }

  const visibleProjects = filterItems(archivedProjects)
  const visibleFeatures = filterItems(archivedFeatures)
  const visibleModules  = filterItems(archivedModules)
  const total = visibleProjects.length + visibleFeatures.length + visibleModules.length

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function doRestore() {
    if (!restoreTarget) return
    if (restoreTarget.kind === 'project') await restoreProjectV2(restoreTarget.id)
    else if (restoreTarget.kind === 'feature') await restoreFeatureV2(restoreTarget.id)
    else await restoreModuleV2(restoreTarget.id)
    setRestoreTarget(null)
  }

  async function doDelete() {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'project') await permanentDeleteProjectV2(deleteTarget.id)
    else if (deleteTarget.kind === 'feature') await permanentDeleteFeatureV2(deleteTarget.id)
    else await permanentDeleteModuleV2(deleteTarget.id)
    setDeleteTarget(null)
  }

  async function doBulkDelete() {
    const projectIds = [...selectedIds].filter(id => archivedProjects.some(p => p.id === id))
    const featureIds = [...selectedIds].filter(id => archivedFeatures.some(f => f.id === id))
    // Modules: delete one by one (detaches their features)
    const moduleIds = [...selectedIds].filter(id => archivedModules.some(m => m.id === id))
    await permanentDeleteMany(projectIds, featureIds)
    for (const mid of moduleIds) await permanentDeleteModuleV2(mid)
    setSelectedIds(new Set())
    setBulkDeleteConfirm(false)
  }

  function projectDeleteMsg(name: string) {
    return `Permanently deletes "${name}". Features in this project move to Backlog. Cannot be undone.`
  }
  function moduleDeleteMsg(name: string, featureCount: number) {
    return `Permanently deletes "${name}". Its ${featureCount} feature${featureCount !== 1 ? 's' : ''} are detached to project level (not deleted). Cannot be undone.`
  }
  function featureDeleteMsg(name: string) {
    return `Permanently deletes "${name}" and all its data. Cannot be undone.`
  }

  if (archivedProjects.length === 0 && archivedFeatures.length === 0 && archivedModules.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center">
        <div>
          <p className="font-display text-2xl text-ink-900 mb-2">Archive is empty.</p>
          <p className="text-sm text-ink-500">Shipped and killed items will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Filter chips + bulk controls */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 border-b border-surface-200 shrink-0 flex-wrap">
        {(['all', 'shipped', 'killed'] as ArchiveFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors capitalize ${filter === f ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-500 hover:border-ink-400'}`}>
            {f}
          </button>
        ))}
        <span className="font-mono text-xs text-ink-400">{total} item{total !== 1 ? 's' : ''}</span>
        {selectedIds.size > 0 && (
          <button onClick={() => setBulkDeleteConfirm(true)}
            className="ml-auto flex items-center gap-1.5 text-xs text-brick-500 hover:text-brick-600 font-medium transition-colors">
            <Trash2 size={12} /> Delete {selectedIds.size} permanently
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto tibbie-scroll p-4 sm:p-6">
        {total === 0 ? (
          <p className="text-sm text-ink-400 text-center py-8">No {filter} items in archive.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl">
            {visibleProjects.map(p => (
              <ArchivedCard key={p.id}
                name={p.name} status={p.status} kind="project"
                subtitle={p.portfolio}
                killReason={p.status === 'killed' ? p.killReason : undefined}
                oneLiner={p.oneLiner}
                selected={selectedIds.has(p.id)} onToggle={() => toggleSelect(p.id)}
                onOpen={() => onOpenProject(p.id)}
                onRestore={() => setRestoreTarget({ id: p.id, kind: 'project', name: p.name })}
                onDelete={() => setDeleteTarget({ id: p.id, kind: 'project', name: p.name })}
              />
            ))}
            {visibleModules.map(m => {
              const parent = (data?.projectsV2 || []).find(p => p.id === m.projectId)
              const featureCount = (data?.featuresV2 || []).filter(f => f.moduleId === m.id).length
              return (
                <ArchivedCard key={m.id}
                  name={m.name} status={m.status} kind="feature"
                  subtitle={parent ? `Module ↳ ${parent.name}` : 'Module'}
                  killReason={m.status === 'killed' ? m.killReason : undefined}
                  oneLiner={m.oneLiner}
                  selected={selectedIds.has(m.id)} onToggle={() => toggleSelect(m.id)}
                  onOpen={() => onOpenModule?.(m.id)}
                  onRestore={() => setRestoreTarget({ id: m.id, kind: 'module', name: m.name })}
                  onDelete={() => setDeleteTarget({ id: m.id, kind: 'module', name: m.name, featureCount })}
                />
              )
            })}
            {visibleFeatures.map(f => {
              const parent = (data?.projectsV2 || []).find(p => p.id === f.projectId)
              const mod = (data?.modulesV2 || []).find(m => m.id === f.moduleId)
              const subtitle = mod ? `↳ ${parent?.name ?? ''} · ${mod.name}` : parent ? `↳ ${parent.name}` : 'Backlog'
              return (
                <ArchivedCard key={f.id}
                  name={f.name} status={f.status} kind="feature"
                  subtitle={subtitle}
                  killReason={f.status === 'killed' ? f.killReason : undefined}
                  oneLiner={f.oneLiner}
                  selected={selectedIds.has(f.id)} onToggle={() => toggleSelect(f.id)}
                  onOpen={() => onOpenFeature(f.id)}
                  onRestore={() => setRestoreTarget({ id: f.id, kind: 'feature', name: f.name })}
                  onDelete={() => setDeleteTarget({ id: f.id, kind: 'feature', name: f.name })}
                />
              )
            })}
          </div>
        )}
      </div>

      <Confirm
        open={restoreTarget !== null}
        title={`Restore "${restoreTarget?.name}"`}
        message="Restores this item to its previous status. A 'Restored' entry will be added to its history."
        onConfirm={doRestore}
        onClose={() => setRestoreTarget(null)}
      />

      <Confirm
        open={deleteTarget !== null}
        title="Delete permanently?"
        message={deleteTarget
          ? deleteTarget.kind === 'project' ? projectDeleteMsg(deleteTarget.name)
          : deleteTarget.kind === 'module' ? moduleDeleteMsg(deleteTarget.name, deleteTarget.featureCount ?? 0)
          : featureDeleteMsg(deleteTarget.name)
          : ''}
        confirmLabel="Delete permanently"
        danger
        onConfirm={doDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <Confirm
        open={bulkDeleteConfirm}
        title={`Delete ${selectedIds.size} items permanently?`}
        message={`Permanently deletes ${selectedIds.size} selected item${selectedIds.size > 1 ? 's' : ''}. Features in deleted projects/modules move to project level. Cannot be undone.`}
        confirmLabel="Delete all permanently"
        danger
        onConfirm={doBulkDelete}
        onClose={() => setBulkDeleteConfirm(false)}
      />
    </div>
  )
}

function ArchivedCard({ name, status, kind, subtitle, killReason, oneLiner, selected, onToggle, onOpen, onRestore, onDelete }: {
  name: string; status: string; kind: 'project' | 'feature'
  subtitle?: string; killReason?: string; oneLiner?: string
  selected: boolean; onToggle: () => void
  onOpen: () => void; onRestore: () => void; onDelete: () => void
}) {
  return (
    <article
      className={`relative opacity-60 hover:opacity-80 transition-opacity bg-white border rounded-xl shadow-card overflow-hidden cursor-pointer group ${selected ? 'border-rust-300 opacity-90' : 'border-surface-200'}`}
      style={kind === 'feature' ? { borderStyle: 'dashed', background: '#FAFAFA' } : {}}
      onClick={onOpen} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen()}
    >
      <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle}
          className="rounded border-surface-300 text-rust-500 focus:ring-rust-400 opacity-0 group-hover:opacity-100 data-[checked]:opacity-100 transition-opacity"
          data-checked={selected ? '' : undefined} />
      </div>
      <div className="p-4 space-y-2 pl-8">
        <div className="flex items-start gap-2">
          <span className="font-sans font-semibold text-sm text-ink-900 flex-1 min-w-0 truncate">{name}</span>
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={onRestore} className="p-1.5 rounded-lg text-ink-400 hover:text-forest-600 hover:bg-forest-50 transition-colors" title="Restore"><ArchiveRestore size={14} /></button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-ink-400 hover:text-brick-600 hover:bg-brick-50 transition-colors" title="Delete permanently"><Trash2 size={14} /></button>
          </div>
        </div>
        <StatusPill status={status as any} kind={kind} />
        {killReason && <p className="text-xs text-brick-600 bg-brick-50 px-2 py-1 rounded-lg">{killReason}</p>}
        {oneLiner && <p className="text-xs text-ink-500 line-clamp-2">{oneLiner}</p>}
        {subtitle && <p className="text-[10px] font-mono text-ink-400">{subtitle}</p>}
      </div>
    </article>
  )
}
