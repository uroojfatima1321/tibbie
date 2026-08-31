/**
 * ModulesSection — Phase D
 * Replaces the old "Features" section in ProjectDrawer.
 * Shows: modules first (each expandable → features inside + inline add),
 * then direct features (moduleId === null), then a "+ New module" input.
 * All inputs at module scope (input registry compliance).
 */
import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Plus, Tag, Wrench } from 'lucide-react'
import type { ProjectV2, FeatureV2, ModuleV2 } from '../../types'
import { useApp } from '../../store/context'
import { StatusPill } from './StatusPill'

// ── Module-scope input components (input registry) ────────────────────────────

interface InlineAddFeatureProps {
  moduleId: string
  projectId: string
  onCreated: () => void
}
function InlineAddFeature({ moduleId, projectId, onCreated }: InlineAddFeatureProps) {
  const { addFeatureV2, editMode } = useApp()
  const [val, setVal] = useState('')

  if (!editMode) return null
  return (
    <input
      className="w-full bg-transparent text-xs outline-none placeholder:text-ink-300 text-ink-700 px-2 py-1.5 border-t border-surface-100"
      placeholder="+ Add feature to module — Enter"
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={async e => {
        if (e.key === 'Enter' && val.trim()) {
          await addFeatureV2({ name: val.trim(), projectId, moduleId })
          setVal('')
          onCreated()
        }
      }}
    />
  )
}

interface NewModuleInputProps {
  projectId: string
  onCreated: (id: string) => void
}
function NewModuleInput({ projectId, onCreated }: NewModuleInputProps) {
  const { addModuleV2, editMode } = useApp()
  const [val, setVal] = useState('')

  if (!editMode) return null
  return (
    <input
      className="w-full bg-transparent text-xs outline-none placeholder:text-ink-300 text-ink-700 px-2 py-1.5 border-t border-surface-100"
      placeholder="+ New module — Enter"
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={async e => {
        if (e.key === 'Enter' && val.trim()) {
          const m = await addModuleV2({ name: val.trim(), projectId })
          setVal('')
          onCreated(m.id)
        }
      }}
    />
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  project: ProjectV2
  onOpenModule?: (id: string) => void
  onOpenFeature?: (id: string, scrollToRice?: boolean) => void
}

export function ModulesSection({ project, onOpenModule, onOpenFeature }: Props) {
  const { modulesV2, featuresV2 } = useApp()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const projectModules = modulesV2.filter(m => m.projectId === project.id)
  const directFeatures = featuresV2.filter(f => f.projectId === project.id && !f.moduleId)
  const allFeatures    = featuresV2.filter(f => f.projectId === project.id)

  const toggle = useCallback((mid: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(mid) ? next.delete(mid) : next.add(mid)
      return next
    })
  }, [])

  function featureRow(f: FeatureV2, indent = false) {
    const isImprovement = f.itemType === 'improvement'
    return (
      <button key={f.id}
        onClick={() => onOpenFeature?.(f.id)}
        className={`flex items-center gap-2 py-1.5 rounded-lg hover:bg-surface-50 text-sm w-full text-left ${indent ? 'pl-8 pr-2' : 'px-2'}`}
      >
        {isImprovement
          ? <Wrench size={11} className="text-blue-400 shrink-0" />
          : <Tag size={11} className="text-ink-400 shrink-0" />
        }
        <span className="flex-1 text-ink-800 truncate">{f.name}</span>
        <StatusPill status={f.status} kind="feature" className="!text-[10px]" />
      </button>
    )
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-2">
        Modules & Features ({allFeatures.length})
      </p>

      {/* ── Modules first ────────────────────────────────────────────────── */}
      {projectModules.length > 0 && (
        <div className="space-y-1 mb-2">
          {projectModules.map(mod => {
            const modFeatures = featuresV2.filter(f => f.moduleId === mod.id)
            const isOpen = !collapsed.has(mod.id)

            return (
              <div key={mod.id} className="border border-surface-200 rounded-xl overflow-hidden">
                {/* Module row */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-surface-50 hover:bg-surface-100 transition-colors">
                  <button onClick={() => toggle(mod.id)} className="shrink-0 p-0.5 text-ink-400 hover:text-ink-700">
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                  <button
                    onClick={() => onOpenModule?.(mod.id)}
                    className="flex-1 text-left text-sm font-medium text-ink-900 hover:text-rust-600 transition-colors truncate"
                  >
                    {mod.name}
                  </button>
                  <StatusPill status={mod.status} kind="feature" className="!text-[10px] shrink-0" />
                  <span className="font-mono text-[10px] text-ink-400 shrink-0">{modFeatures.length}</span>
                </div>

                {/* Expanded: features inside module + inline add */}
                {isOpen && (
                  <div>
                    {modFeatures.length === 0 ? (
                      <p className="text-xs text-ink-400 px-8 py-1.5">No features in this module.</p>
                    ) : (
                      <div className="divide-y divide-surface-100">
                        {modFeatures.map(f => featureRow(f, true))}
                      </div>
                    )}
                    <InlineAddFeature
                      moduleId={mod.id}
                      projectId={project.id}
                      onCreated={() => {/* features list auto-updates via context */}}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Direct features (no module) ────────────────────────────────── */}
      {directFeatures.length > 0 && (
        <div className="mb-1">
          {projectModules.length > 0 && (
            <p className="text-[10px] text-ink-400 uppercase tracking-wider font-medium mb-1 px-1">
              Direct features
            </p>
          )}
          <div className="space-y-0.5">
            {directFeatures.map(f => featureRow(f, false))}
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {projectModules.length === 0 && allFeatures.length === 0 && (
        <p className="text-xs text-ink-400">No modules or features yet.</p>
      )}

      {/* ── New module input ─────────────────────────────────────────────── */}
      <NewModuleInput
        projectId={project.id}
        onCreated={id => onOpenModule?.(id)}
      />
    </div>
  )
}
