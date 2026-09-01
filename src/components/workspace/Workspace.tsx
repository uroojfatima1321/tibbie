import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import { BarChart2, Map, Layers, FolderOpen, Keyboard, Plus, PanelRight } from 'lucide-react'
import { GanttView, type GanttHandle } from '../gantt/GanttView'
import { RoadmapView } from '../views/RoadmapView'
import { ProjectDashboard } from '../projects/ProjectDashboard'
import { FilterBar } from '../filters/FilterBar'
import { StatsStrip } from '../shell/StatsStrip'
import { RightSidebar, SidebarBody } from './RightSidebar'
import { Sheet } from '../ui/Sheet'
import { useApp } from '../../store/context'
import type { Project, Task } from '../../types'

export type WorkspaceView = 'gantt' | 'roadmap' | 'projects'

export interface WorkspaceHandle {
  scrollToToday: () => void
  getGanttElement: () => HTMLDivElement | null
}

interface Props {
  onTaskClick: (id: string) => void
  onEditProject: (id: string) => void
  onNewProject: () => void
  onOpenPhaseLibrary: () => void
  onShortcutsOpen: () => void
  onOpenV2Project: (id: string) => void
  onSwitchToRoadmap?: () => void
}

export const Workspace = forwardRef<WorkspaceHandle, Props>(function Workspace(
  { onTaskClick, onEditProject, onNewProject, onOpenPhaseLibrary, onShortcutsOpen, onOpenV2Project, onSwitchToRoadmap },
  ref,
) {
  const { data, activeProjectId, setActiveProjectId, seed, editMode, projectsV2 } = useApp()
  const [view, setView] = useState<WorkspaceView>('gantt')
  const [sidebarSheetOpen, setSidebarSheetOpen] = useState(false)
  const ganttRef = useRef<GanttHandle>(null)

  useImperativeHandle(ref, () => ({
    scrollToToday,
    getGanttElement: () => ganttRef.current?.getChartElement() ?? null,
  }))

  // Auto-switch to Projects tab whenever a project is activated from anywhere
  useEffect(() => {
    if (activeProjectId) setView('projects')
  }, [activeProjectId])

  function scrollToToday() {
    const el = ganttRef.current?.getChartElement()
    if (!el) return
    const scroller = el.querySelector('.tibbie-scroll.overflow-auto') as HTMLElement | null
    const todayLine = el.querySelector('line[stroke="#C65D3B"]') as SVGLineElement | null
    if (scroller && todayLine) {
      const x = parseFloat(todayLine.getAttribute('x1') || '0')
      scroller.scrollTo({ left: Math.max(0, x - scroller.clientWidth / 2), behavior: 'smooth' })
    }
  }

  function switchTab(v: WorkspaceView) {
    if (v !== 'projects') setActiveProjectId(null)
    setView(v)
  }

  const TABS: { id: WorkspaceView; label: string; icon: React.ReactNode }[] = [
    { id: 'gantt',    label: 'Timeline', icon: <BarChart2 size={13} /> },
    { id: 'roadmap',  label: 'Roadmap',  icon: <Map size={13} /> },
    { id: 'projects', label: 'Projects', icon: <FolderOpen size={13} /> },
  ]

  const hasData = (projectsV2?.length || 0) > 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Stats strip — only on Timeline */}
      {view === 'gantt' && <StatsStrip onShowTask={onTaskClick} />}

      {/* Tab bar */}
      <div className="border-b border-surface-200 px-3 sm:px-6 py-1.5 flex items-center gap-0.5 bg-white min-w-0 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0 ${
              view === tab.id
                ? 'bg-ink-900 text-white'
                : 'text-ink-600 hover:bg-surface-100'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
        <div className="flex-1" />
        {/* Mobile: project info trigger — only when a project is active */}
        {activeProjectId && (
          <button
            onClick={() => setSidebarSheetOpen(true)}
            className="lg:hidden inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-ink-500 hover:bg-surface-100 hover:text-ink-800 transition-colors shrink-0"
            title="Project phases & resources"
          >
            <PanelRight size={13} />
            <span className="hidden sm:inline">Info</span>
          </button>
        )}
        <button
          onClick={onShortcutsOpen}
          className="hidden md:inline-flex items-center gap-1.5 text-[10px] text-ink-400 hover:text-ink-700 px-2 py-1 rounded-md hover:bg-surface-100 transition-colors shrink-0"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={12} />
          Shortcuts
        </button>
      </div>

      {/* Filter bar — only on Timeline */}
      {view === 'gantt' && <FilterBar />}

      {/* Empty state */}
      {!hasData ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="font-display text-4xl italic text-ink-900 mb-2">
              tibbie<span className="text-rust-500">.</span>
            </div>
            <p className="text-ink-500 mb-6">
              Free, browser-based project timeline. Data lives in Cloudflare KV — no SaaS fees, PIN-gated edits.
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => seed()} className="btn-primary">Load sample data</button>
              <button onClick={onNewProject} className="btn-outline">
                <Plus size={16} /> Start empty
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Content area: tab views + right sidebar */
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Tab content — all 4 stay mounted; hidden via CSS to preserve scroll + state */}
          <div className="flex-1 min-w-0 flex flex-col relative">
            <div className={`absolute inset-0 flex flex-col ${view === 'gantt' ? '' : 'hidden'}`}>
              <GanttView ref={ganttRef} onTaskClick={onTaskClick} onOpenV2Project={onOpenV2Project} />
            </div>
            <div className={`absolute inset-0 flex flex-col ${view === 'roadmap' ? '' : 'hidden'}`}>
              <RoadmapView onMilestoneClick={onTaskClick} />
            </div>
            <div className={`absolute inset-0 flex flex-col ${view === 'projects' ? '' : 'hidden'}`}>
              {activeProjectId ? (
                <ProjectDashboard
                  projectId={activeProjectId}
                  onClose={() => setActiveProjectId(null)}
                  onTaskClick={onTaskClick}
                  onEditProject={onEditProject}
                  onOpenPhaseLibrary={onOpenPhaseLibrary}
                />
              ) : (
                <ProjectsListView
                  projects={projectsV2 || []}
                  tasks={data?.tasks || []}
                  onSelectProject={onOpenV2Project}
                  onNewProject={onNewProject}
                  onSwitchToRoadmap={onSwitchToRoadmap}
                />
              )}
            </div>
          </div>

          {/* Right sidebar — lg+ only */}
          <RightSidebar
            onOpenPhaseLibrary={onOpenPhaseLibrary}
          />
        </div>
      )}

      {/* Mobile bottom sheet — project phases + resources (< lg) */}
      <Sheet
        open={sidebarSheetOpen}
        onClose={() => setSidebarSheetOpen(false)}
        title="Project info"
      >
        <SidebarBody onOpenPhaseLibrary={onOpenPhaseLibrary} />
      </Sheet>
    </div>
  )
})

// ─── Projects list view ───────────────────────────────────────────────────────

interface ProjectsListViewProps {
  projects: import('../../types').ProjectV2[]   // unified: these are ALL ProjectV2 now
  tasks: Task[]
  onSelectProject: (id: string) => void
  onNewProject: () => void
  onSwitchToRoadmap?: () => void
}

function ProjectsListView({ projects, tasks, onSelectProject, onNewProject, onSwitchToRoadmap }: ProjectsListViewProps) {
  const todayISO = new Date().toISOString().slice(0, 10)
  const activeProjects = projects.filter(p => !p.archived)

  if (activeProjects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <FolderOpen size={40} className="mx-auto mb-3 text-ink-300" />
          <p className="text-ink-500 mb-4">No projects yet.</p>
          <button onClick={onNewProject} className="btn-primary">
            <Plus size={15} /> New project
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto tibbie-scroll p-4 sm:p-6">
      {/* B5: Projects-moved banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl">
        {activeProjects.map(project => {
          const pts = tasks.filter(t => t.projectId === project.id)
          const done = pts.filter(t => t.status === 'done').length
          const total = pts.length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          const overdue = pts.filter(t => t.status !== 'done' && t.endDate < todayISO).length

          return (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="text-left p-4 rounded-xl border border-surface-200 bg-white hover:border-ink-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: project.color ?? '#8B8680' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-ink-900 truncate group-hover:text-rust-600 transition-colors">
                    {project.name}
                  </div>
                  {project.oneLiner && (
                    <div className="text-xs text-ink-400 mt-0.5 line-clamp-2">{project.oneLiner}</div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-ink-500">
                  <span>{done} / {total} tasks done</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-forest-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {overdue > 0 && (
                  <p className="text-[11px] text-brick-500">{overdue} overdue</p>
                )}
              </div>
            </button>
          )
        })}


        <button
          onClick={onNewProject}
          className="text-left p-4 rounded-xl border border-dashed border-surface-300 hover:border-ink-400 hover:bg-white transition-all flex items-center gap-2 text-ink-400 hover:text-ink-700 min-h-[96px]"
        >
          <Plus size={16} />
          <span className="text-sm">New project</span>
        </button>
      </div>
    </div>
  )
}
