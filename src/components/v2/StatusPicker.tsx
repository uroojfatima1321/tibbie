/**
 * StatusPicker — Item 1
 *
 * Floating status popover. Replaces the inline block that displaced drawer body content.
 *
 * Positioning: position:fixed + getBoundingClientRect on the trigger button.
 * Chosen over createPortal for simplicity — no portal root needed; fixed positioning
 * achieves the same z-index escape from the modal stack.
 *
 * Scroll behaviour: CLOSE (not reposition). Reopening is instant and always correct;
 * repositioning requires a scroll listener that adds jitter with no UX gain.
 *
 * Z-index: z-[70] — above drawer overlay (z-50) and below system modals.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import type { ProjectStatus, FeatureStatus } from '../../types'
import { StatusPill, ALL_PROJECT_STATUSES, ALL_FEATURE_STATUSES, getStatusLabel } from './StatusPill'
import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { useEscapeKey } from '../../hooks/useEscapeKey'

type AnyStatus = ProjectStatus | FeatureStatus

interface Props {
  status: AnyStatus
  kind: 'project' | 'feature'
  editMode: boolean
  onSelect: (s: AnyStatus) => void
}

interface Pos { top: number; left: number }

export function StatusPicker({ status, kind, editMode, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState<Pos | null>(null)
  const triggerRef  = useRef<HTMLButtonElement>(null)
  const popoverRef  = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useOnClickOutside(popoverRef, close, open)
  useEscapeKey(close, open)

  // Close on scroll of any ancestor (scroll container moves; popover must close)
  useEffect(() => {
    if (!open) return
    const onScroll = () => close()
    window.addEventListener('scroll', onScroll, true)   // capture phase catches nested scrolls
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [open, close])

  function toggle() {
    if (!editMode) return
    if (open) { close(); return }
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    // Position below pill with 4px gap; clamp to viewport right edge
    const left = Math.min(rect.left, window.innerWidth - 256 - 8)
    setPos({ top: rect.bottom + 4, left: Math.max(8, left) })
    setOpen(true)
  }

  function select(s: AnyStatus) {
    close()
    onSelect(s)
  }

  const statuses = kind === 'project' ? ALL_PROJECT_STATUSES : ALL_FEATURE_STATUSES

  return (
    <>
      {/* Trigger pill — existing focus ring kept */}
      <button
        ref={triggerRef}
        onClick={toggle}
        className={`focus:outline-none focus:ring-2 focus:ring-rust-200 rounded-full ${editMode ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
        title={editMode ? 'Click to change status' : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <StatusPill status={status} kind={kind} />
      </button>

      {/* Floating popover — rendered at document root via fixed positioning */}
      {open && pos && (
        <div
          ref={popoverRef}
          role="listbox"
          aria-label="Change status"
          className="fixed z-[70] w-56 bg-white border border-surface-200 rounded-xl shadow-float overflow-hidden animate-scale-in"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="py-1 max-h-72 overflow-y-auto">
            {statuses.map(s => (
              <button
                key={s}
                role="option"
                aria-selected={s === status}
                onClick={() => select(s as AnyStatus)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-surface-50 transition-colors ${s === status ? 'bg-surface-100' : ''}`}
              >
                <StatusPill status={s} kind={kind} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
