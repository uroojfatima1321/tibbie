import { useRef, useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  maxWidth?: 'lg' | '2xl'
  children: React.ReactNode
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Centered modal dialog container.
 * - Backdrop click → onClose
 * - Esc → onClose
 * - Focus trapped inside
 * - Focus returns to trigger element on close
 * - Mobile: full-screen (inset-0, no radius)
 * - sm+: max-w-{size} centered, max-h-[85dvh], rounded-2xl
 *
 * The CALLER is responsible for wrapping onClose with dirty-state guard.
 *
 * CRITICAL: onClose is kept in a ref so this effect ONLY runs when `open`
 * changes — NOT on every render. If onClose were in the dependency array and
 * callers pass an inline function (handleClose defined inside the modal), the
 * effect would re-run on every keystroke: cleanup would fire originRef.focus()
 * (stealing focus back to the opener) and the RAF body would focus the first
 * modal element — causing a focus-loss write-storm on every character typed.
 */
export function ModalDialog({ open, onClose, maxWidth = '2xl', children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const originRef = useRef<HTMLElement | null>(null)

  // Always-current reference to onClose — lets the Esc handler call the
  // latest version WITHOUT making onClose a useEffect dependency.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose   // sync on every render, no effect needed

  useEffect(() => {
    if (!open) return

    // Capture origin element for focus return on close
    originRef.current = document.activeElement as HTMLElement

    // Focus first focusable element after paint
    const frame = requestAnimationFrame(() => {
      const els = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      els?.[0]?.focus()
    })

    // Trap focus inside modal
    function onTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const els = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => !el.closest('[aria-hidden="true"]'))
      if (els.length === 0) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()   // always the latest callback
    }

    document.addEventListener('keydown', onTab)
    document.addEventListener('keydown', onEsc)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onTab)
      document.removeEventListener('keydown', onEsc)
      // Return focus to origin on close
      originRef.current?.focus?.()
    }
  }, [open])   // ← NOT [open, onClose]: onClose lives in onCloseRef

  if (!open) return null

  const widthClass = maxWidth === '2xl' ? 'sm:max-w-2xl' : 'sm:max-w-lg'

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/40 animate-fade-in
                 sm:flex sm:items-center sm:justify-center sm:p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={panelRef}
        className={`
          w-full h-full bg-white flex flex-col overflow-hidden
          sm:h-auto sm:max-h-[85dvh] sm:rounded-2xl sm:shadow-2xl sm:animate-scale-in
          ${widthClass}
        `}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
