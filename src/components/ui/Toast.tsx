import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useApp } from '../../store/context'

export function ToastStack() {
  const { toasts, dismissToast } = useApp()
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info
        const tone = t.kind === 'success' ? 'text-forest-500' : t.kind === 'error' ? 'text-brick-500' : 'text-steel-500'
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-xl bg-ink-900 text-cream-50 shadow-float animate-scale-in min-w-[260px] max-w-[90vw]"
          >
            <Icon size={16} className={tone} />
            <span className="text-sm flex-1">{t.text}</span>
            <button onClick={() => dismissToast(t.id)} className="p-1 rounded hover:bg-white/10" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
