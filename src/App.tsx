import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, X, UserCircle, CalendarOff, Layers, Download } from 'lucide-react'
import { useApp } from './store/context'
import { Nav, type TopView } from './components/shell/Nav'
import { CleanupModal } from './components/v2/CleanupModal'
import { BackupModal } from './components/v2/BackupModal'
import { OfflineBanner } from './components/shell/OfflineBanner'
import { TaskDetailPanel } from './components/tasks/TaskDetailPanel'
import { ProjectForm } from './components/projects/ProjectForm'
import { MembersPanel } from './components/members/MembersPanel'
import { HolidaysPanel } from './components/holidays/HolidaysPanel'
import { PhaseLibraryPanel } from './components/phases/PhaseLibraryPanel'
import { SearchPalette } from './components/search/SearchPalette'
import { ToastStack } from './components/ui/Toast'
import { Modal } from './components/ui/Modal'
import { exportElementToPDF, exportElementToPNG } from './lib/export'
import { Avatar } from './components/members/Avatar'
import { Workspace, type WorkspaceHandle } from './components/workspace/Workspace'
// V2
import { RoadmapView } from './components/v2/RoadmapView'
import { ArchiveView } from './components/v2/ArchiveView'
import { type V2FilterState, EMPTY_FILTER, filterToParams, paramsToFilter } from './lib/filterV2'
import { ProjectDrawer } from './components/v2/ProjectDrawer'
import { FeatureDrawer } from './components/v2/FeatureDrawer'
import { ModuleDrawer } from './components/v2/ModuleDrawer'
import { QuickAddModal } from './components/v2/QuickAddModal'

export default function App() {
  const {
    data, isLoading, isError, error, refresh, pushToast,
    myTasksMemberId, setMyTasksMemberId,
    searchOpen, setSearchOpen,
    setZoom, editMode,
    activeProjectId, setActiveProjectId,
    isDirty,
    crashDraftOffer, acceptCrashDraft, dismissCrashDraft,
  } = useApp()

  // Phase A: prefix title with bullet when there are unsaved staged mutations
  useEffect(() => {
    document.title = isDirty ? '• Tibbie' : 'Tibbie'
  }, [isDirty])

  const workspaceRef = useRef<WorkspaceHandle>(null)
  const [topView, setTopView] = useState<TopView>('roadmap')

  // V1 timeline panels
  const [taskPanel, setTaskPanel] = useState<{ id: string | null; creating: boolean; defaultProjectId?: string }>({ id: null, creating: false })
  const [projectForm, setProjectForm] = useState<{ id: string | null; creating: boolean }>({ id: null, creating: false })
  const [membersOpen, setMembersOpen] = useState(false)
  const [holidaysOpen, setHolidaysOpen] = useState(false)
  const [phaseLibraryOpen, setPhaseLibraryOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // V2 filter state — URL-synced
  const [v2Filter, setV2FilterRaw] = useState<V2FilterState>(() => {
    try { return paramsToFilter(new URLSearchParams(window.location.search)) } catch { return EMPTY_FILTER }
  })
  function setV2Filter(f: V2FilterState) {
    setV2FilterRaw(f)
    const params = filterToParams(f)
    const url = params.toString() ? `?${params.toString()}` : window.location.pathname
    window.history.replaceState(null, '', url)
  }
  const [quickAddKind, setQuickAddKind] = useState<'project' | 'feature'>('feature')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
  const [openFeatureId, setOpenFeatureId] = useState<string | null>(null)
  const [openModuleId, setOpenModuleId]   = useState<string | null>(null)
  const [featureScrollToRice, setFeatureScrollToRice] = useState(false)
  const { taskPulseId, setTaskPulseId } = useApp()

  function openFeature(id: string, scrollToRice = false) {
    setOpenFeatureId(id)
    setFeatureScrollToRice(scrollToRice)
  }

  function openTaskInGantt(taskId: string) {
    setTopView('timeline')
    setTaskPulseId(taskId)
    setTimeout(() => setTaskPulseId(null), 2000)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setSearchOpen(true); return
      }
      const target = e.target as HTMLElement
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          if (topView === 'roadmap' && editMode) setQuickAddOpen(true)
          else if (topView === 'timeline' && editMode) setTaskPanel({ id: null, creating: true })
          break
        case 't': e.preventDefault(); workspaceRef.current?.scrollToToday(); break
        case '1': if (topView === 'timeline') { e.preventDefault(); setZoom('day') }; break
        case '2': if (topView === 'timeline') { e.preventDefault(); setZoom('week') }; break
        case '3': if (topView === 'timeline') { e.preventDefault(); setZoom('month') }; break
        case '?': e.preventDefault(); setShortcutsOpen(true); break
        case 'escape':
          if (activeProjectId) { e.preventDefault(); setActiveProjectId(null) }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen, setZoom, editMode, activeProjectId, setActiveProjectId, topView])

  async function handleExport(kind: 'pdf' | 'png') {
    const el = workspaceRef.current?.getGanttElement()
    if (!el) { pushToast('error', 'Switch to Timeline to export'); return }
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

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-ink-400" size={24} /></div>
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

  const myMember = myTasksMemberId ? data?.members.find(m => m.id === myTasksMemberId) : null

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Fix 2+3 (R2-C2/R2-H4): persistent offline bar — reactive via useSyncExternalStore */}
      <OfflineBanner />
      {/* Fix 9 (R1-H2): crash-draft recovery offer */}
      {crashDraftOffer && (
        <div className="flex items-center gap-3 bg-amber-500 text-white text-xs px-4 py-2 shrink-0">
          <span className="font-semibold">
            Unsaved changes from {new Date(crashDraftOffer.savedAt).toLocaleTimeString()} found
            (v{crashDraftOffer.version}).
          </span>
          <button onClick={acceptCrashDraft}
            className="underline font-medium hover:no-underline">
            Restore
          </button>
          <button onClick={dismissCrashDraft} className="ml-2 opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}
      <Nav
        topView={topView}
        onNav={v => setTopView(v)}
        onOpenSearch={() => setSearchOpen(true)}
        onNew={() => setQuickAddOpen(true)}
        onOpenMenu={() => setMobileMenuOpen(true)}
        onOpenCleanup={() => setCleanupOpen(true)}
        onOpenBackup={() => setBackupOpen(true)}
        onOpenMembers={() => setMembersOpen(true)}
        onOpenHolidays={() => setHolidaysOpen(true)}
      />

      {/* My tasks banner (V1 Timeline only) */}
      {myMember && topView === 'timeline' && (
        <div className="px-4 sm:px-6 py-2 bg-rust-500/10 border-b border-rust-500/20 flex items-center gap-2 text-sm shrink-0">
          <Avatar member={myMember} size="xs" />
          <span className="text-ink-700">Viewing tasks for <strong>{myMember.name}</strong></span>
          <button onClick={() => setMyTasksMemberId(null)} className="ml-auto text-xs text-ink-600 hover:text-ink-900 inline-flex items-center gap-1">
            Clear <X size={12} />
          </button>
        </div>
      )}

      {/* ── View router ── */}
      {topView === 'roadmap' && (
        <RoadmapView
          onOpenProject={id => setOpenProjectId(id)}
          onOpenModule={id => setOpenModuleId(id)}
          onOpenFeature={id => openFeature(id)}
          onNewProject={() => { setQuickAddKind('project'); setQuickAddOpen(true) }}
          onNewFeature={() => { setQuickAddKind('feature'); setQuickAddOpen(true) }}
          filter={v2Filter}
          onFilterChange={setV2Filter}
        />
      )}

      {topView === 'timeline' && (
        <Workspace
          ref={workspaceRef}
          onTaskClick={id => setTaskPanel({ id, creating: false })}
          onEditProject={id => setProjectForm({ id, creating: false })}
          onNewProject={() => { setQuickAddKind('project'); setQuickAddOpen(true) }}
          onOpenPhaseLibrary={() => setPhaseLibraryOpen(true)}
          onShortcutsOpen={() => setShortcutsOpen(true)}
          onOpenV2Project={id => setOpenProjectId(id)}
          onSwitchToRoadmap={() => setTopView('roadmap')}
        />
      )}

      {topView === 'archive' && (
        <ArchiveView
          onOpenProject={id => setOpenProjectId(id)}
          onOpenFeature={id => openFeature(id)}
          onOpenModule={id => setOpenModuleId(id)}
        />
      )}

      {/* ── V2 Panels ── */}
      <ProjectDrawer
        projectId={openProjectId}
        onClose={() => setOpenProjectId(null)}
        onOpenModule={id => setOpenModuleId(id)}
        onOpenFeature={(id, scrollToRice) => { setOpenFeatureId(id); setFeatureScrollToRice(scrollToRice ?? false) }}
      />      <FeatureDrawer featureId={openFeatureId} onClose={() => { setOpenFeatureId(null); setFeatureScrollToRice(false) }} scrollToRice={featureScrollToRice} />
      <ModuleDrawer
        moduleId={openModuleId}
        onClose={() => setOpenModuleId(null)}
        onOpenFeature={id => setOpenFeatureId(id)}
      />
      <QuickAddModal
        open={quickAddOpen}
        initialKind={quickAddKind}
        onClose={() => setQuickAddOpen(false)}
        onCreated={(kind, id) => {
          if (kind === 'project') setOpenProjectId(id)
          else if (kind === 'module') setOpenModuleId(id)
          else setOpenFeatureId(id)
        }}
      />

      {/* ── V1 Timeline Panels ── */}
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
      <HolidaysPanel open={holidaysOpen} onClose={() => setHolidaysOpen(false)} />
      <PhaseLibraryPanel open={phaseLibraryOpen} onClose={() => setPhaseLibraryOpen(false)} />
      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectTask={id => setTaskPanel({ id, creating: false })}
        onSelectProject={id => setActiveProjectId(id)}
        onSelectMember={id => setMyTasksMemberId(id)}
      />

      {/* Export modal */}
      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export Gantt" size="sm">
        <div className="p-5 space-y-3">
          <p className="text-sm text-ink-600">Export the current Timeline view.</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleExport('png')} className="btn-outline justify-center py-6 flex-col gap-1"><Download size={18} /> <span className="text-sm">PNG</span></button>
            <button onClick={() => handleExport('pdf')} className="btn-outline justify-center py-6 flex-col gap-1"><Download size={18} /> <span className="text-sm">PDF</span></button>
          </div>
        </div>
      </Modal>

      {/* Mobile menu */}
      <Modal open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} title="Menu" size="sm">
        <div className="p-5 flex flex-col gap-1">
          {(['roadmap','timeline','archive'] as TopView[]).map(v => (
            <button key={v} onClick={() => { setTopView(v); setMobileMenuOpen(false) }}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-left ${topView === v ? 'bg-ink-900 text-white' : 'hover:bg-surface-100 text-ink-900'}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
          <div className="border-t border-surface-200 mt-2 pt-2">
            <button onClick={() => { setMembersOpen(true); setMobileMenuOpen(false) }} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-100 text-sm text-ink-900 text-left w-full">
              <UserCircle size={16} className="text-ink-500" /> Members
            </button>
            <button onClick={() => { setPhaseLibraryOpen(true); setMobileMenuOpen(false) }} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-100 text-sm text-ink-900 text-left w-full">
              <Layers size={16} className="text-ink-500" /> Phase library
            </button>
            <button onClick={() => { setHolidaysOpen(true); setMobileMenuOpen(false) }} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-100 text-sm text-ink-900 text-left w-full">
              <CalendarOff size={16} className="text-ink-500" /> Holidays
            </button>
          </div>
        </div>
      </Modal>

      {/* Shortcuts modal */}
      <CleanupModal open={cleanupOpen} onClose={() => setCleanupOpen(false)} />
      <BackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />

      <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="Keyboard shortcuts" size="sm">
        <div className="p-5 space-y-2 text-sm">
          <ShortcutRow keys={['⌘', 'K']} label="Search" />
          <ShortcutRow keys={['N']} label="New project/feature (Roadmap) or task (Timeline)" />
          <ShortcutRow keys={['T']} label="Scroll to today (Timeline)" />
          <ShortcutRow keys={['1']} label="Day zoom (Timeline)" />
          <ShortcutRow keys={['2']} label="Week zoom (Timeline)" />
          <ShortcutRow keys={['3']} label="Month zoom (Timeline)" />
          <ShortcutRow keys={['?']} label="Show this dialog" />
          <ShortcutRow keys={['Esc']} label="Close / back" />
          <p className="text-xs text-ink-400 pt-2">Shortcuts disabled while typing in a field.</p>
        </div>
      </Modal>

      <ToastStack />
    </div>
  )
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-ink-700">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd key={i} className="font-mono text-[11px] px-2 py-0.5 rounded border border-surface-200 bg-surface-50 text-ink-700 min-w-[24px] text-center">{k}</kbd>
        ))}
      </span>
    </div>
  )
}
