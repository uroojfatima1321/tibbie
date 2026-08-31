/**
 * OfflineBanner — Fix 2 (R2-C2) + Fix 3 (R2-H4)
 * Shown whenever localMode is true (KV unreachable).
 * Persists until the adapter successfully reconnects (localMode → false).
 * Reactive because localMode uses useSyncExternalStore in context.
 */
import { AlertTriangle } from 'lucide-react'
import { useApp } from '../../store/context'

export function OfflineBanner() {
  const { localMode, loadDiagnostic } = useApp()
  if (!localMode) return null

  return (
    <div
      role="alert"
      className="flex items-center gap-2 bg-brick-600 text-white text-xs px-4 py-2 shrink-0"
      aria-live="assertive"
    >
      <AlertTriangle size={13} className="shrink-0" />
      <span className="font-semibold">Working offline — changes are NOT saved to server.</span>
      {loadDiagnostic && (
        <span className="opacity-80 ml-1 truncate hidden sm:block">
          ({loadDiagnostic.message})
        </span>
      )}
      <span className="ml-auto opacity-70 font-normal">Reconnects automatically.</span>
    </div>
  )
}
