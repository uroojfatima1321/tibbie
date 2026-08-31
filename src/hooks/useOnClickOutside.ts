import { useEffect, type RefObject } from 'react'

/**
 * Fires handler when a mousedown occurs outside the given ref element.
 * active=false skips wiring entirely (no listener added).
 */
export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: () => void,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      handler()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, handler, active])
}
