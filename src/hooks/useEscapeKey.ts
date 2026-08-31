import { useEffect } from 'react'

/**
 * Fires handler when Escape is pressed.
 * active=false skips wiring entirely (no listener added).
 */
export function useEscapeKey(handler: () => void, active: boolean): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [handler, active])
}
