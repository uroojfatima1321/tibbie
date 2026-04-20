import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { useIsMobile } from '../../hooks/useMediaQuery'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sizeClass = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`
          relative w-full ${sizeClass}
          bg-cream-50 shadow-float
          ${isMobile ? 'rounded-t-2xl animate-slide-up max-h-[92vh]' : 'rounded-2xl animate-scale-in mx-4 max-h-[90vh]'}
          flex flex-col overflow-hidden
        `}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-cream-300">
            <h3 className="font-display font-semibold text-lg text-ink-900">{title}</h3>
            <button onClick={onClose} className="btn-ghost !p-1.5" aria-label="Close">
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
