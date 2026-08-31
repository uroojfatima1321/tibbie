/**
 * PrioritizeJumpBar — Item 4
 * 5 buttons that scroll matching PrioritizeSection into view.
 * Last-active section persisted in localStorage.
 */
import { useEffect } from 'react'
import type { SectionId } from '../../lib/prioritizeSections'
import { useLocalStorage } from '../../lib/useLocalStorage'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'must-do',       label: 'Must-Do' },
  { id: 'ranked',        label: 'Ranked' },
  { id: 'needs-scoring', label: 'Needs Scoring' },
  { id: 'in-delivery',   label: 'In Delivery' },
  { id: 'live',          label: 'Live' },
]

interface Props {
  sectionRefs: Partial<Record<SectionId, React.RefObject<HTMLDivElement>>>
}

export function PrioritizeJumpBar({ sectionRefs }: Props) {
  const [lastActive, setLastActive] = useLocalStorage<SectionId | null>('tibbie.prioritize.jumpTo', null)

  // On mount: silently scroll to the last-active section
  useEffect(() => {
    if (!lastActive) return
    const ref = sectionRefs[lastActive]
    if (ref?.current) {
      // Delay so the table has finished rendering
      const t = setTimeout(() => {
        ref.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
      }, 200)
      return () => clearTimeout(t)
    }
  }, [])   // intentionally empty — fires once on mount

  function jump(id: SectionId) {
    const ref = sectionRefs[id]
    if (ref?.current) {
      ref.current.scrollIntoView({ block: 'start', behavior: 'smooth' })
      setLastActive(id)
    }
  }

  const hasAny = Object.values(sectionRefs).some(r => r?.current)

  if (!hasAny) return null

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-surface-100 bg-surface-50 overflow-x-auto">
      <span className="text-[10px] text-ink-400 font-medium shrink-0 mr-1">Jump:</span>
      {SECTIONS.filter(s => sectionRefs[s.id]?.current).map(s => (
        <button
          key={s.id}
          onClick={() => jump(s.id)}
          className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors shrink-0 ${
            lastActive === s.id
              ? 'bg-ink-900 text-white border-ink-900'
              : 'border-surface-200 text-ink-500 hover:border-surface-300 hover:text-ink-700'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
