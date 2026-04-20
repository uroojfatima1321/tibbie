import { useState } from 'react'
import { Search, Lock, LockOpen, Plus, Users, FolderKanban, Download, Menu } from 'lucide-react'
import { Logo } from './Logo'
import { PinGate } from './PinGate'
import { useApp } from '../../store/context'

interface Props {
  onOpenSearch: () => void
  onNewProject: () => void
  onNewTask: () => void
  onNewMember: () => void
  onOpenMembers: () => void
  onExport: () => void
  onOpenMenu: () => void
}

export function Nav({ onOpenSearch, onNewProject, onNewTask, onNewMember, onOpenMembers, onExport, onOpenMenu }: Props) {
  const { editMode, pinConfigured } = useApp()
  const [gateOpen, setGateOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-30 bg-cream-100/90 backdrop-blur border-b border-cream-300">
        <div className="flex items-center gap-2 px-4 sm:px-6 h-14">
          {/* Mobile menu */}
          <button onClick={onOpenMenu} className="btn-ghost !p-2 sm:hidden" aria-label="Menu">
            <Menu size={18} />
          </button>

          <Logo size="md" />

          <div className="flex-1" />

          {/* Search */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cream-300 bg-white/60 hover:bg-white text-ink-500 hover:text-ink-700 transition-colors"
            aria-label="Search (Ctrl/Cmd+K)"
          >
            <Search size={16} />
            <span className="hidden md:inline text-sm">Search…</span>
            <kbd className="hidden md:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-cream-200 text-ink-500">⌘K</kbd>
          </button>

          {/* Desktop-only quick actions */}
          {editMode && (
            <div className="hidden sm:flex items-center gap-1 ml-1">
              <button onClick={onNewTask} className="btn-ghost" title="New task">
                <Plus size={16} /> Task
              </button>
              <button onClick={onNewProject} className="btn-ghost" title="New project">
                <FolderKanban size={16} />
              </button>
              <button onClick={onOpenMembers} className="btn-ghost" title="Members">
                <Users size={16} />
              </button>
              <button onClick={onExport} className="btn-ghost" title="Export">
                <Download size={16} />
              </button>
            </div>
          )}

          {/* Edit mode toggle */}
          <button
            onClick={() => setGateOpen(true)}
            className={`btn-ghost ${editMode ? '!text-forest-500' : ''}`}
            title={editMode ? 'Edit mode on' : pinConfigured === false ? 'Set edit PIN' : 'Unlock edit'}
            aria-label="Edit mode"
          >
            {editMode ? <LockOpen size={16} /> : <Lock size={16} />}
            <span className="hidden sm:inline text-xs">{editMode ? 'Edit' : 'View'}</span>
          </button>
        </div>
      </header>
      <PinGate open={gateOpen} onClose={() => setGateOpen(false)} />
    </>
  )
}
