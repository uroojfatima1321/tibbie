import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Download, X, UserCircle } from 'lucide-react'
import { useApp } from './store/context'
import { Nav } from './components/shell/Nav'
import { StatusBanner } from './components/shell/StatusBanner'
import { FilterBar } from './components/filters/FilterBar'
import { GanttView, type GanttHandle } from './components/gantt/GanttView'
import { TaskDetailPanel } from './components/tasks/TaskDetailPanel'
import { ProjectForm } from './components/projects/ProjectForm'
import { MembersPanel } from './components/members/MembersPanel'
import { SearchPalette } from './components/search/SearchPalette'
import { HeatmapView } from './components/views/HeatmapView'
import { ToastStack } from './components/ui/Toast'
import { Modal } from './components/ui/Modal'
import { exportElementToPDF, exportElementToPNG } from './lib/export'
import { Avatar } from './components/members/Avatar'

type View = 'gantt' | 'heatmap'

export default function App() {
  const { data, isLoading, isError, error, refresh, pushToast, myTasksMemberId, setMyTasksMemberId, seed, searchOpen, setSearchOpen } = useApp()
  const [view, setView] = useState<View>('gantt')
  const [taskPanel, setTaskPanel] = useState<{ id: string | null; creating: boolean; defaultProjectId?: string }>({ id: null, creating: false })
  const [projectForm, setProjectForm] = useState<{ id: string | null; creating: boolean }>({ id: null, creating: false })
  const [membersOpen, setMembersOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const ganttRef = useRef<GanttHandle>(null)

  // Cmd+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-ink-400" size={24} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h2 className="font-display text-xl text-ink-900 mb-2">Could not load data</h2>
          <p className="text-sm text-ink-500 mb-4">{error?.message || 'Unknown error'}</p>
          <button onClick={refresh} className="btn-primary">Retry</button>
        </div>
      </div>
    )
  }

  async function handleExport(kind: 'pdf' | 'png') {
    const el = ganttRef.current?.getChartElement()
    if (!el) { pushToast('error', 'Nothing to export'); return }
    try {
      const filename = `tibbie-gantt-${new Date().toISOString().slice(0, 10)}`
      if (kind === 'pdf') await exportElementToPDF(el, filename)
      else await exportElementToPNG(el, filename)
      setExportOpen(false)
      pushToast('success', `Exported ${kind.toUpperCase()}`)
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Export failed')
    }
  }

  const myMember = myTasksMemberId ? data?.members.find(m => m.id === myTasksMemberId) : null
  const hasData = (data?.projects.length || 0) > 0

  return (
    <div className="h-full flex flex-col">
      <Nav
        onOpenSearch={() => setSearchOpen(true)}
        onNewProject={() => setProjectForm({ id: null, creating: true })}
        onNewTask={() => setTaskPanel({ id: null, creating: true })}
        onNewMember={() => setMembersOpen(true)}
        onOpenMembers={() => setMembersOpen(true)}
        onExport={() => setExportOpen(true)}
        onOpenMenu={() => setMobileMenuOpen(true)}
      />

      {/* "My tasks" active banner */}
      {myMember && (
        <div className="px-4 sm:px-6 py-2 bg-rust-500/10 border-b border-rust-500/20 flex items-center gap-2 text-sm">
          <Avatar member={myMember} size="xs" />
          <span className="text-ink-700">Viewing tasks for <strong>{myMember.name}</strong></span>
          <button onClick={() => setMyTasksMemberId(null)} className="ml-auto text-xs text-ink-600 hover:text-ink-900 inline-flex items-center gap-1">
            Clear <X size={12} />
          </button>
        </div>
      )}

      <StatusBanner onShowTask={id => setTaskPanel({ id, creating: false })} />

      {/* View toggle */}
      <div className="border-b border-cream-300 px-4 sm:px-6 py-1.5 flex items-center gap-1 bg-cream-50">
        {(['gantt', 'heatmap'] as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === v ? 'bg-ink-900 text-cream-50' : 'text-ink-600 hover:bg-cream-200'}`}
          >
            {v === 'gantt' ? 'Timeline' : 'Workload'}
          </button>
        ))}
      </div>

      {view === 'gantt' && <FilterBar />}

      {/* First-run empty state */}
      {!hasData ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="font-display text-4xl italic text-ink-900 mb-2">tibbie<span className="text-rust-500">.</span></div>
            <p className="text-ink-500 mb-6">Free, browser-based project timeline. Your data lives in Netlify Blobs; no one pays a SaaS fee, and edits are PIN-gated.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => seed()} className="btn-primary">
                Load sample data
              </button>
              <button onClick={() => setProjectForm({ id: null, creating: true })} className="btn-outline">
                <Plus size={16} /> Start empty
              </button>
            </div>
          </div>
        </div>
      ) : view === 'gantt' ? (
        <GanttView ref={ganttRef} onTaskClick={id => setTaskPanel({ id, creating: false })} />
      ) : (
        <HeatmapView onClose={() => setView('gantt')} />
      )}

      {/* Panels / modals */}
      <TaskDetailPanel
        taskId={taskPanel.id}
        creating={taskPanel.creating}
        defaultProjectId={taskPanel.defaultProjectId}
        onClose={() => setTaskPanel({ id: null, creating: false })}
      />
      <ProjectForm
        projectId={projectForm.id}
        creating={projectForm.creating}
        onClose={() => setProjectForm({ id: null, creating: false })}
      />
      <MembersPanel open={membersOpen} onClose={() => setMembersOpen(false)} />
      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectTask={id => setTaskPanel({ id, creating: false })}
        onSelectProject={id => setProjectForm({ id, creating: false })}
        onSelectMember={id => { setMyTasksMemberId(id) }}
      />

      {/* Export dialog */}
      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export Gantt" size="sm">
        <div className="p-5 space-y-3">
          <p className="text-sm text-ink-600">Export the current timeline view (with active filters and zoom applied).</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleExport('png')} className="btn-outline justify-center py-6 flex-col gap-1">
              <Download size={18} /> <span className="text-sm">PNG</span>
            </button>
            <button onClick={() => handleExport('pdf')} className="btn-outline justify-center py-6 flex-col gap-1">
              <Download size={18} /> <span className="text-sm">PDF</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Mobile drawer menu */}
      <Modal open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} title="Menu" size="sm">
        <div className="p-5 flex flex-col gap-1">
          <MobileMenuItem icon={<Plus size={16} />} label="New task" onClick={() => { setTaskPanel({ id: null, creating: true }); setMobileMenuOpen(false) }} />
          <MobileMenuItem icon={<Plus size={16} />} label="New project" onClick={() => { setProjectForm({ id: null, creating: true }); setMobileMenuOpen(false) }} />
          <MobileMenuItem icon={<UserCircle size={16} />} label="Members" onClick={() => { setMembersOpen(true); setMobileMenuOpen(false) }} />
          <MobileMenuItem icon={<Download size={16} />} label="Export Gantt" onClick={() => { setExportOpen(true); setMobileMenuOpen(false) }} />
        </div>
      </Modal>

      <ToastStack />
    </div>
  )
}

function MobileMenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-cream-100 text-sm text-ink-900 text-left">
      <span className="text-ink-500">{icon}</span>
      {label}
    </button>
  )
}
