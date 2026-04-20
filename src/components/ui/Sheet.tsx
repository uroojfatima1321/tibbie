import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

/** Right-side panel on desktop, bottom sheet on mobile. */
export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 animate-fade-in">
      <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="
        absolute bg-cream-50 shadow-float overflow-hidden flex flex-col
        inset-x-0 bottom-0 rounded-t-2xl max-h-[92vh] animate-slide-up
        sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:top-0 sm:rounded-none sm:w-[480px] sm:max-h-none sm:animate-fade-in sm:border-l sm:border-cream-300
      ">
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-cream-300 shrink-0">
            <h3 className="font-display font-semibold text-lg text-ink-900 truncate pr-2">{title}</h3>
            <button onClick={onClose} className="btn-ghost !p-1.5 shrink-0" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto tibbie-scroll">
          {children}
        </div>
      </div>
    </div>
  )
}
