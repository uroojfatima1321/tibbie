/**
 * StatusPicker — migrated to Popover primitive (B2b fix).
 *
 * Root cause of B2b: the old implementation attached window.addEventListener('scroll', close, capture:true)
 * which fired on ANY scroll including scroll inside the status list itself, dismissing the picker before
 * the user could reach lower options. Fixed by Popover's scroll handler which checks contains() first.
 *
 * Sizing: max-h-none — all statuses visible without internal scroll.
 */
import { useRef } from 'react'
import type { ProjectStatus, FeatureStatus } from '../../types'
import { StatusPill, ALL_PROJECT_STATUSES, ALL_FEATURE_STATUSES } from './StatusPill'
import { Popover } from '../ui/Popover'

type AnyStatus = ProjectStatus | FeatureStatus

interface Props {
  status: AnyStatus
  kind: 'project' | 'feature'
  editMode: boolean
  onSelect: (s: AnyStatus) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StatusPicker({ status, kind, editMode, onSelect, open, onOpenChange }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  const statuses = kind === 'project' ? ALL_PROJECT_STATUSES : ALL_FEATURE_STATUSES

  function toggle() {
    if (!editMode) return
    onOpenChange(!open)
  }

  function select(s: AnyStatus) {
    onOpenChange(false)
    onSelect(s)
  }

  return (
    <>
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

      <Popover
        triggerRef={triggerRef}
        open={open}
        onOpenChange={onOpenChange}
        placement="bottom-start"
        className="w-56"
      >
        <div role="listbox" aria-label="Change status" className="py-1">
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
      </Popover>
    </>
  )
}
