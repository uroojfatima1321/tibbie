import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { useApp } from '../../store/context'
import { today, addDaysISO } from '../../lib/dates'

// Phase D: added 'module' kind
type EntityKind = 'project' | 'feature' | 'improvement' | 'task' | 'module'

interface Props {
  open: boolean
  initialKind?: EntityKind
  defaultProjectId?: string | null
  onClose: () => void
  onCreated?: (kind: EntityKind, id: string) => void
}

export function QuickAddModal({ open, initialKind = 'feature', defaultProjectId, onClose, onCreated }: Props) {
  const { projectsV2, addProjectV2, addFeatureV2, addModuleV2, addTask, data, filters, pushToast, editMode } = useApp()
  const [kind, setKind]       = useState<EntityKind>(initialKind)
  const [name, setName]       = useState('')
  const [expanded, setExpanded] = useState(false)
  const [oneLiner, setOneLiner] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const portfolios = [...new Set(projectsV2.map(p => p.portfolio))]

  useEffect(() => {
    if (open) {
      setKind(initialKind)
      setName('')
      setExpanded(false)
      setOneLiner('')
      setProjectId(defaultProjectId ?? null)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open, initialKind, defaultProjectId])

  // Keyboard: P/F/I/T/M toggle
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.target !== inputRef.current) {
        if (e.key === 'p' || e.key === 'P') setKind('project')
        if (e.key === 'f' || e.key === 'F') setKind('feature')
        if (e.key === 'i' || e.key === 'I') setKind('improvement')
        if (e.key === 't' || e.key === 'T') setKind('task')
        if (e.key === 'm' || e.key === 'M') setKind('module')
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleCreate() {
    if (!name.trim()) return
    // Modules require a parent project
    if (kind === 'module' && !projectId) {
      pushToast('error', 'Module requires a parent project')
      setExpanded(true)
      return
    }
    setLoading(true)
    try {
      if (kind === 'project') {
        const p = await addProjectV2({ name: name.trim(), portfolio: portfolio || portfolios[0] || 'Uncategorized', oneLiner: oneLiner || undefined })
        onCreated?.('project', p.id)
      } else if (kind === 'module') {
        const m = await addModuleV2({ name: name.trim(), projectId: projectId!, oneLiner: oneLiner || undefined })
        onCreated?.('module', m.id)
      } else if (kind === 'improvement') {
        const f = await addFeatureV2({ name: name.trim(), projectId: projectId || null, oneLiner: oneLiner || undefined, itemType: 'improvement' })
        onCreated?.('feature', f.id)
      } else if (kind === 'task') {
        const tid = filters.projectIds[0] ?? (projectsV2 || []).filter(p => !p.archived)[0]?.id ?? ''
        const t = today()
        await addTask({
          projectId: tid, name: name.trim(), notes: '',
          startDate: t, endDate: addDaysISO(t, 5),
          status: 'not_started', percentComplete: 0,
          isMilestone: false, assigneeIds: [], recurring: null,
        })
        onCreated?.('task', '')
      } else {
        const f = await addFeatureV2({ name: name.trim(), projectId: projectId || null, oneLiner: oneLiner || undefined })
        onCreated?.('feature', f.id)
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const placeholder =
    kind === 'project' ? 'Project name…' :
    kind === 'module'  ? 'Module name…' :
    kind === 'task'    ? 'Task name…' :
    kind === 'improvement' ? 'Improvement name…' :
    'Feature name…'

  const createLabel =
    kind === 'task'    ? 'Create task' :
    kind === 'module'  ? 'Create module' :
    kind === 'improvement' ? 'Create improvement' :
    `Create ${kind}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[min(480px,92vw)] bg-white rounded-2xl shadow-float border border-surface-200 overflow-hidden animate-scale-in">
        {/* Kind toggle */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-2 flex-wrap">
          {(['project', 'feature', 'improvement', 'module', 'task'] as EntityKind[]).map(k => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${kind === k ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-surface-100'}`}
            >
              {k === 'project'     ? 'Project (P)'     :
               k === 'feature'     ? 'Feature (F)'     :
               k === 'improvement' ? 'Improvement (I)' :
               k === 'module'      ? 'Module (M)'      :
               'Task (T)'}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={onClose} className="p-1 text-ink-400 hover:text-ink-700 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Main input */}
        <div className="px-4 pb-2">
          <input
            ref={inputRef}
            className="w-full font-sans text-base text-ink-900 bg-transparent outline-none placeholder:text-ink-300 py-2"
            placeholder={placeholder}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate() } }}
          />
        </div>

        {/* More options */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-ink-400 hover:text-ink-700 transition-colors flex items-center gap-1"
          >
            <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            More options
          </button>

          {expanded && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Description (optional)</label>
                <input className="input w-full text-sm" placeholder="One-liner ≤140 chars" maxLength={140}
                  value={oneLiner} onChange={e => setOneLiner(e.target.value)} />
              </div>
              {kind === 'project' && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Portfolio</label>
                  <input className="input w-full text-sm" placeholder="e.g. Intellicon Platform"
                    value={portfolio} onChange={e => setPortfolio(e.target.value)} list="portfolio-list" />
                  <datalist id="portfolio-list">
                    {portfolios.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
              )}
              {(kind === 'feature' || kind === 'improvement') && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">Project (optional)</label>
                  <select className="input w-full text-sm" value={projectId || ''} onChange={e => setProjectId(e.target.value || null)}>
                    <option value="">Backlog (unassigned)</option>
                    {projectsV2.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {/* Module requires parent project (required) */}
              {kind === 'module' && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1">
                    Parent project <span className="text-brick-500">*</span>
                  </label>
                  <select className="input w-full text-sm" value={projectId || ''} onChange={e => setProjectId(e.target.value || null)}>
                    <option value="">— select a project —</option>
                    {projectsV2.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <p className="text-[10px] text-ink-400 mt-0.5">Modules always belong to a project.</p>
                </div>
              )}
            </div>
          )}
          {/* Auto-expand More options for Module if no project selected */}
          {kind === 'module' && !expanded && (
            <button onClick={() => setExpanded(true)} className="mt-2 text-xs text-amber-600 hover:text-amber-700 transition-colors">
              ⚠ Select a parent project first →
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-surface-100 flex items-center justify-between bg-surface-50">
          <span className="text-xs text-ink-400">Enter to create</span>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading || (kind === 'module' && !projectId)}
            className="btn-primary !py-1.5 text-sm disabled:opacity-50"
          >
            {loading ? 'Creating…' : createLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
