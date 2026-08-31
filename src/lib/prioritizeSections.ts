/**
 * prioritizeSections.ts — Item 4
 * Pure function: no React, no adapters.
 * Imported by PrioritizeTable.tsx (runtime) and boot-test.ts (assertions).
 *
 * Derives 5 sections in fixed order:
 *  1. must-do         — Must-Do tagged items
 *  2. ranked          — scored items in rank order
 *  3. needs-scoring   — eligible but unscored (the to-do list; PROMOTED above In Delivery)
 *  4. in-delivery     — development/in_testing projects (not ranked)
 *  5. live            — beta_production..mvp_live projects (not ranked)
 *
 * showInDelivery=false removes sections 4 + 5 entirely.
 */
import type { ProjectV2, FeatureV2, ModuleV2 } from '../types'
import { isValidRice, isValidWsjf, LIVE_GROUP_STATUSES } from './filterV2'
import { IN_DELIVERY_STATUSES } from './rank'

export type AnyItem = (ProjectV2 | FeatureV2 | ModuleV2) & { kind: 'project' | 'feature' | 'module' }

export type SectionId = 'must-do' | 'ranked' | 'needs-scoring' | 'in-delivery' | 'live'
export type SectionTone = 'brick' | 'rust' | 'amber' | 'steel' | 'forest'

export interface PrioritizeSection {
  id: SectionId
  label: string
  tone: SectionTone
  count: number
  items: AnyItem[]
  defaultCollapsed: boolean
}

export interface DeriveSectionsOptions {
  showInDelivery?: boolean  // when false, in-delivery + live sections are omitted
}

export function deriveSections(
  allItems: AnyItem[],
  framework: 'rice' | 'wsjf',
  rankedItemIds: string[],
  options: DeriveSectionsOptions = {},
): PrioritizeSection[] {
  const { showInDelivery = true } = options

  function hasScore(item: AnyItem): boolean {
    return framework === 'wsjf' ? isValidWsjf(item.wsjf) : isValidRice(item.rice)
  }

  // 1. Must-Do — sorted by tag date (oldest first = highest priority)
  const mustDoItems = allItems
    .filter(i => !!(i as any).mustDo)
    .sort((a, b) => ((a as any).mustDo.at as string).localeCompare((b as any).mustDo.at))

  // Items excluded from competitive pool (Must-Do + all delivery-excluded projects)
  const allDeliveryStatuses = [...IN_DELIVERY_STATUSES, ...LIVE_GROUP_STATUSES]
  const isDeliveryExcluded = (i: AnyItem) =>
    i.kind === 'project' && allDeliveryStatuses.includes((i as ProjectV2).status)

  // Eligible items: not Must-Do, not delivery-excluded
  const eligible = allItems.filter(i => !(i as any).mustDo && !isDeliveryExcluded(i))

  // 2. Ranked — items whose IDs appear in rankedItemIds (preserves rank order)
  const rankedSet = new Set(rankedItemIds)
  const rankedItems = rankedItemIds
    .map(id => eligible.find(i => i.id === id))
    .filter((i): i is AnyItem => i !== undefined)

  // 3. Needs Scoring — eligible but not yet scored in the active framework
  const needsScoringItems = eligible.filter(i => !rankedSet.has(i.id) && !(i as any).mustDo)

  // 4. In Delivery
  const inDeliveryItems = allItems.filter(
    i => !(i as any).mustDo && i.kind === 'project' && IN_DELIVERY_STATUSES.includes((i as ProjectV2).status)
  )

  // 5. Live
  const liveItems = allItems.filter(
    i => !(i as any).mustDo && i.kind === 'project' && LIVE_GROUP_STATUSES.includes((i as ProjectV2).status)
  )

  const sections: PrioritizeSection[] = [
    {
      id: 'must-do',
      label: 'Must-Do',
      tone: 'brick',
      count: mustDoItems.length,
      items: mustDoItems,
      defaultCollapsed: false,
    },
    {
      id: 'ranked',
      label: 'Ranked',
      tone: 'rust',
      count: rankedItems.length,
      items: rankedItems,
      defaultCollapsed: false,
    },
    {
      id: 'needs-scoring',
      label: 'Needs Scoring',
      tone: 'amber',
      count: needsScoringItems.length,
      items: needsScoringItems,
      defaultCollapsed: false,
    },
  ]

  if (showInDelivery) {
    sections.push({
      id: 'in-delivery',
      label: 'In Delivery',
      tone: 'steel',
      count: inDeliveryItems.length,
      items: inDeliveryItems,
      defaultCollapsed: false,
    })
    sections.push({
      id: 'live',
      label: 'Live',
      tone: 'forest',
      count: liveItems.length,
      items: liveItems,
      defaultCollapsed: true,
    })
  }

  return sections
}
