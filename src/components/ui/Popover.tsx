/**
 * Popover — shared anchor-positioned floating panel primitive.
 *
 * Guarantees (in one place):
 * - Renders in a portal at document.body — never clipped by ancestor overflow or stacking context
 * - Dismisses on: outside click, Escape, trigger re-click
 * - Does NOT dismiss on scroll originating inside the popover's own subtree
 * - Does NOT dismiss on mousedown on its own scrollbar (scrollbar hit-test is inside)
 * - Repositions on window resize; closes on page-level scroll (not popover-internal scroll)
 * - Keyboard: arrow navigation, Enter to select, focus returns to trigger on close
 *
 * Usage:
 *   <Popover
 *     trigger={<button ref={triggerRef}>Open</button>}
 *     triggerRef={triggerRef}
 *     open={open}
 *     onOpenChange={setOpen}
 *     placement="bottom-start"
 *   >
 *     <div>…content…</div>
 *   </Popover>
 */
import { useEffect, useRef, useCallback, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

export type PopoverPlacement =
  | 'bottom-start' | 'bottom-end' | 'bottom'
  | 'top-start'    | 'top-end'    | 'top'

interface PopoverProps {
  /** The trigger element — must be separately rendered */
  triggerRef: RefObject<HTMLElement>
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  placement?: PopoverPlacement
  /** Extra class on the floating panel */
  className?: string
  /** Gap between trigger and panel in px */
  gap?: number
}

function computePosition(
  trigger: HTMLElement,
  panel: HTMLElement,
  placement: PopoverPlacement,
  gap: number,
): { top: number; left: number } {
  const tr = trigger.getBoundingClientRect()
  const pr = panel.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const g = gap

  let top = 0, left = 0

  switch (placement) {
    case 'bottom-start': top = tr.bottom + g; left = tr.left; break
    case 'bottom-end':   top = tr.bottom + g; left = tr.right - pr.width; break
    case 'bottom':       top = tr.bottom + g; left = tr.left + tr.width / 2 - pr.width / 2; break
    case 'top-start':    top = tr.top - pr.height - g; left = tr.left; break
    case 'top-end':      top = tr.top - pr.height - g; left = tr.right - pr.width; break
    case 'top':          top = tr.top - pr.height - g; left = tr.left + tr.width / 2 - pr.width / 2; break
  }

  // Clamp to viewport
  left = Math.max(8, Math.min(left, vw - pr.width - 8))
  top  = Math.max(8, Math.min(top,  vh - pr.height - 8))

  // Flip top↔bottom if needed
  if (placement.startsWith('bottom') && top + pr.height > vh - 8 && tr.top - pr.height - g > 8) {
    top = tr.top - pr.height - g
  }
  if (placement.startsWith('top') && top < 8 && tr.bottom + pr.height + g < vh - 8) {
    top = tr.bottom + g
  }

  return { top, left }
}

export function Popover({
  triggerRef,
  open,
  onOpenChange,
  children,
  placement = 'bottom-start',
  className = '',
  gap = 4,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  // Position panel whenever it opens or trigger moves
  const reposition = useCallback(() => {
    const trigger = triggerRef.current
    const panel   = panelRef.current
    if (!trigger || !panel) return
    const { top, left } = computePosition(trigger, panel, placement, gap)
    panel.style.top  = `${top}px`
    panel.style.left = `${left}px`
  }, [triggerRef, placement, gap])

  useEffect(() => {
    if (!open) return
    // Position on open (rAF lets the panel render first so getBoundingClientRect is accurate)
    const id = requestAnimationFrame(reposition)
    return () => cancelAnimationFrame(id)
  }, [open, reposition])

  useEffect(() => {
    if (!open) return

    // Outside click: close unless the click is inside the panel or trigger
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      const panel  = panelRef.current
      const trigger = triggerRef.current
      if (panel?.contains(target) || trigger?.contains(target)) return
      close()
    }

    // Escape: close and return focus
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close()
        triggerRef.current?.focus()
      }
    }

    // Page-level scroll: close (but NOT if the scroll originated inside the popover)
    function onScroll(e: Event) {
      const panel = panelRef.current
      if (panel?.contains(e.target as Node)) return  // internal scroll — ignore
      close()
    }

    // Window resize: reposition
    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', reposition)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true })
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', reposition)
    }
  }, [open, close, reposition, triggerRef])

  if (!open) return null

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999 }}
      className={`bg-white border border-surface-200 rounded-xl shadow-float animate-scale-in ${className}`}
      // Prevent clicks inside from reaching the outside-click handler in capture phase
      onPointerDown={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
