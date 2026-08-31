import { useState, useRef, useEffect } from 'react'
import { Search, Lock, LockOpen, Plus, Menu, ChevronDown, Trash2, Download, Users, CalendarOff, Save, Loader2 } from 'lucide-react'
import { Logo } from './Logo'
import { PinGate } from './PinGate'
import { getV4PruneCount } from '../../lib/migrate'
import { useApp } from '../../store/context'

export type TopView = 'roadmap' | 'timeline' | 'archive'

interface Props {
  topView: TopView
  onNav: (v: TopView) => void
  onOpenSearch: () => void
  onNew: () => void
  onOpenMenu: () => void
  onOpenCleanup: () => void
  onOpenBackup: () => void
  onOpenMembers: () => void
  onOpenHolidays: () => void
}

const NAV_ITEMS: { id: TopView; label: string }[] = [
  { id: 'roadmap',  label: 'Roadmap' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'archive',  label: 'Archive' },
]

export function Nav({ topView, onNav, onOpenSearch, onNew, onOpenMenu, onOpenCleanup, onOpenBackup, onOpenMembers, onOpenHolidays }: Props) {
  const { editMode, pinConfigured, localMode, loadDiagnostic, isDirty, stagedCount, isSaving, saveNow } = useApp()
  const [gateOpen, setGateOpen] = useState(false)
  const [diagOpen, setDiagOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-surface-200">
        <div className="flex items-center gap-3 px-3 sm:px-6 h-14">
          {/* Mobile hamburger */}
          <button onClick={onOpenMenu} className="btn-ghost !p-2 sm:hidden shrink-0" aria-label="Menu">
            <Menu size={18} />
          </button>

          <Logo size="md" />

          {/* Local mode badge — clickable diagnostic overlay */}
          {localMode && (
            <button
              onClick={() => setDiagOpen(true)}
              className="shrink-0 font-sans text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap hover:bg-amber-100 transition-colors cursor-pointer"
              title="Click to see why Local mode is active"
            >
              Local mode — changes not saved ⓘ
            </button>
          )}

          {/* Primary nav — hidden on mobile */}
          <nav className="hidden sm:flex items-center gap-0.5 ml-2">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  topView === item.id
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-600 hover:bg-surface-100 hover:text-ink-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Search */}
          <button
            onClick={onOpenSearch}
            className="shrink-0 hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-ink-500 hover:text-ink-700 transition-colors text-sm"
            aria-label="Search"
            title="Search (Ctrl/Cmd+K)"
          >
            <Search size={15} />
            <span className="hidden lg:inline text-sm">Search…</span>
            <kbd className="hidden lg:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-ink-500">⌘K</kbd>
          </button>
          <button onClick={onOpenSearch} className="shrink-0 sm:hidden btn-ghost !p-2" aria-label="Search">
            <Search size={16} />
          </button>

          {/* + New */}
          {editMode && (
            <button
              onClick={onNew}
              className="shrink-0 btn-primary !py-1.5 !px-3 hidden sm:inline-flex"
              title="New project or feature (N)"
            >
              <Plus size={15} />
              <span className="hidden md:inline">New</span>
            </button>
          )}

          {/* Members & Holidays — always accessible on desktop */}
          <button onClick={onOpenMembers} title="Team members"
            className="shrink-0 hidden md:inline-flex btn-ghost !p-2 text-xs gap-1 items-center text-ink-500">
            <Users size={13} /> Members
          </button>
          <button onClick={onOpenHolidays} title="Holidays"
            className="shrink-0 hidden md:inline-flex btn-ghost !p-2 text-xs gap-1 items-center text-ink-500">
            <CalendarOff size={13} /> Holidays
          </button>

          {/* Diagnostics — always openable (not gated by localMode) so Batch A prune count is visible post-deploy */}
          {(localMode || getV4PruneCount() > 0) && (
            <button onClick={() => setDiagOpen(true)} title="System diagnostics"
              className={`shrink-0 hidden md:inline-flex btn-ghost !p-2 text-xs gap-1 items-center ${localMode ? 'text-amber-600' : 'text-forest-600'}`}>
              ⓘ Diagnostics
            </button>
          )}

          {/* Cleanup + Backup */}
          {editMode && (
            <>
              <button onClick={onOpenCleanup} title="Clean up migrated items"
                className="shrink-0 hidden md:inline-flex btn-ghost !p-2 text-xs gap-1 items-center text-ink-500">
                <Trash2 size={13} /> Clean up
              </button>
              <button onClick={onOpenBackup} title="Export / Import data"
                className="shrink-0 hidden md:inline-flex btn-ghost !p-2 text-xs gap-1 items-center text-ink-500">
                <Download size={13} /> Backup
              </button>
            </>
          )}

          {/* Save button — visible whenever there are staged (unsaved) mutations */}
          {isDirty && (
            <button
              onClick={saveNow}
              disabled={isSaving}
              className="shrink-0 relative btn-primary !py-1.5 !px-3"
              title={isSaving ? 'Saving…' : `Save ${stagedCount} staged change${stagedCount !== 1 ? 's' : ''} to server`}
            >
              {/* Amber unsaved-indicator dot */}
              {!isSaving && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white" aria-hidden="true" />
              )}
              {isSaving
                ? <Loader2 size={14} className="animate-spin" />
                : <Save size={14} />
              }
              <span className="hidden sm:inline">
                {isSaving ? 'Saving…' : `Save · ${stagedCount}`}
              </span>
            </button>
          )}

          {/* Lock/Unlock */}
          <button
            onClick={() => setGateOpen(true)}
            className={`shrink-0 btn-ghost !px-2 !py-1.5 ${editMode ? '!text-forest-500' : ''}`}
            title={editMode ? 'Edit mode — click to lock' : pinConfigured === false ? 'Set edit PIN' : 'Unlock edit'}
          >
            {editMode ? <LockOpen size={15} /> : <Lock size={15} />}
            <span className="hidden sm:inline text-xs ml-0.5">{editMode ? 'Editing' : 'View'}</span>
          </button>
        </div>
      </header>
      <PinGate open={gateOpen} onClose={() => setGateOpen(false)} />

      {/* Diagnostic overlay — openable from Diagnostics button or Local mode badge */}
      {diagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDiagOpen(false)}>
          <div className="bg-white rounded-2xl shadow-float max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink-900">System diagnostics</h2>
              <button onClick={() => setDiagOpen(false)} className="text-ink-400 hover:text-ink-700 p-1 rounded-lg hover:bg-surface-100 transition-colors">✕</button>
            </div>

            {/* Batch A migration preflight — shown whenever overlay is open, regardless of localMode */}
            {getV4PruneCount() > 0 ? (
              <div className="bg-forest-50 border border-forest-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-forest-800">Batch A migration ran this session</p>
                <p className="text-xs font-mono text-forest-700">
                  Pruned {getV4PruneCount()} scoring field(s) from KV records (schemaVersion 4).
                  Export a fresh backup to verify — rice, wsjf, mustDo, valueRating, effortEstimate
                  should be absent from all projectsV2 / featuresV2 / modulesV2 entries.
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-400">Batch A migration: not run this session (data already at schemaVersion 4).</p>
            )}

            {localMode && (
              <>
                <p className="text-sm text-ink-600">
                  The app couldn't reach the remote data API. Changes you make are held in memory only and <strong>will be lost on refresh</strong>.
                  The app will automatically retry on the next data refresh — if the API recovers, Local mode will clear on its own.
                </p>
                {loadDiagnostic ? (
                  <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-2 font-mono text-xs">
                    <div className="flex gap-3">
                      <span className="text-ink-400 shrink-0 w-20">URL</span>
                      <span className="text-ink-900">{loadDiagnostic.url}</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-ink-400 shrink-0 w-20">Status</span>
                      <span className={loadDiagnostic.status ? 'text-brick-600' : 'text-amber-600'}>
                        {loadDiagnostic.status ?? 'Network error (no HTTP response)'}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-ink-400 shrink-0 w-20">Error</span>
                      <span className="text-brick-700 break-all">{loadDiagnostic.message}</span>
                    </div>
                    {loadDiagnostic.responseSnippet && (
                      <div className="flex gap-3">
                        <span className="text-ink-400 shrink-0 w-20">Response</span>
                        <span className="text-ink-600 break-all">{loadDiagnostic.responseSnippet}</span>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <span className="text-ink-400 shrink-0 w-20">Time</span>
                      <span className="text-ink-500">{new Date(loadDiagnostic.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-ink-400 font-mono">No diagnostic data captured — failure may have occurred before diagnostic tracking initialized.</p>
                )}
              </>
            )}

            <div className="flex justify-end">
              {localMode && <p className="text-xs text-ink-400 mr-auto">Changes not saved · Refresh to retry immediately</p>}
              <button onClick={() => setDiagOpen(false)} className="btn-outline !py-1.5 !text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
