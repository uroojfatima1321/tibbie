import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface InfoTipProps {
  content: React.ReactNode
  className?: string
  side?: 'top' | 'bottom'
}

/**
 * Reusable ⓘ info tooltip.
 * F-2 fix: renders via portal to document.body so it's never clipped by
 * table overflow or any ancestor overflow context.
 * Viewport-aware: flips side if tooltip would bleed off screen.
 */
export function InfoTip({ content, className = '' }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0, above: true })
  const btnRef = useRef<HTMLButtonElement>(null)

  const reposition = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const TOOLTIP_H = 60   // approximate max height
    const above = r.top > TOOLTIP_H + 16
    setPos({
      x: r.left + r.width / 2,
      y: above ? r.top - 8 : r.bottom + 8,
      above,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    reposition()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() } }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, reposition])

  const tooltip = open ? createPortal(
    <span
      role="tooltip"
      className="fixed z-[9999] w-max max-w-[240px] bg-ink-900 text-white text-[11px] font-sans rounded-lg px-3 py-2 shadow-float pointer-events-none"
      style={{
        left: pos.x,
        top: pos.above ? undefined : pos.y,
        bottom: pos.above ? `calc(100vh - ${pos.y}px)` : undefined,
        transform: 'translateX(-50%)',
      }}
    >
      {content}
      <span className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${pos.above ? 'top-full border-t-ink-900' : 'bottom-full border-b-ink-900'}`} />
    </span>,
    document.body
  ) : null

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        ref={btnRef}
        type="button"
        tabIndex={0}
        aria-label="More information"
        aria-expanded={open}
        onMouseEnter={() => { reposition(); setOpen(true) }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => { reposition(); setOpen(true) }}
        onBlur={() => setOpen(false)}
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="text-[11px] text-ink-400 hover:text-ink-700 focus:outline-none focus:ring-1 focus:ring-rust-200 rounded leading-none cursor-help"
      >
        ⓘ
      </button>
      {tooltip}
    </span>
  )
}
