/**
 * PrioritizeSection — Item 4
 * Owns the sticky header, count chip, and collapse toggle.
 * tone drives the header accent color.
 */
import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { SectionId, SectionTone } from '../../lib/prioritizeSections'

const TONE_CLASSES: Record<SectionTone, string> = {
  brick: 'border-brick-200 bg-brick-50 text-brick-700',
  rust:  'border-rust-200 bg-rust-50 text-rust-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  steel: 'border-steel-200 bg-steel-50/40 text-steel-700',
  forest:'border-forest-200 bg-forest-50/40 text-forest-700',
}

const COUNT_TONE: Record<SectionTone, string> = {
  brick: 'bg-brick-100 text-brick-600',
  rust:  'bg-rust-100 text-rust-600',
  amber: 'bg-amber-100 text-amber-700',
  steel: 'bg-steel-100 text-steel-600',
  forest:'bg-forest-100 text-forest-600',
}

interface Props {
  id: SectionId
  label: string
  count: number
  tone: SectionTone
  sticky?: boolean    // true = sticky top-0 z-10
  collapsed: boolean
  onToggle: () => void
  sectionRef?: React.RefObject<HTMLDivElement>
  children: React.ReactNode
}

export function PrioritizeSection({ id, label, count, tone, sticky, collapsed, onToggle, sectionRef, children }: Props) {
  return (
    <div ref={sectionRef} data-section={id}>
      {/* Sticky header */}
      <div
        className={`flex items-center gap-2 px-4 py-2 border-t-2 cursor-pointer select-none ${TONE_CLASSES[tone]} ${sticky ? 'sticky top-0 z-10' : ''}`}
        onClick={onToggle}
      >
        {collapsed
          ? <ChevronRight size={13} className="shrink-0" />
          : <ChevronDown size={13} className="shrink-0" />
        }
        <span className="text-[11px] uppercase tracking-wider font-semibold flex-1">{label}</span>
        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${COUNT_TONE[tone]}`}>{count}</span>
      </div>
      {!collapsed && children}
    </div>
  )
}
