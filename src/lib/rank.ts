/**
 * rank.ts — unified rank pool derivation.
 * Pure function: no React, no adapter.
 * Imported by context.tsx and boot-test.ts.
 *
 * Must-Do items and Live-group projects are excluded from the competitive pool.
 * Modules compete alongside projects and features.
 */
import type { ProjectV2, FeatureV2, ModuleV2, RiceScore, WsjfScore } from '../types'
import { isValidRice, safeRiceScore, isValidWsjf, safeWsjfScore, LIVE_GROUP_STATUSES } from './filterV2'

// Re-export so consumers can import from one place
export { LIVE_GROUP_STATUSES } from './filterV2'

// EXC-3 (M5.1 F): Projects in development or later are excluded from the rank pool.
// Build decision is made — score their features and improvements instead.
export const IN_DELIVERY_STATUSES: string[] = ['development', 'in_testing']

// Combined set: in-delivery (F new) + live (Phase B existing)
export const DELIVERY_EXCLUDED_STATUSES: string[] = [...IN_DELIVERY_STATUSES, ...LIVE_GROUP_STATUSES]

export type Rankable = ProjectV2 | FeatureV2 | ModuleV2

/** Build the ordered rank pool from all scoreable items under the active framework.
 *  Returns item IDs in rank order (highest score first). */
export function buildRankedIds(
  items: Rankable[],
  framework: 'rice' | 'wsjf',
): string[] {
  const eligible = items.filter(i => {
    if ((i as any).mustDo) return false                                    // Phase B: Must-Do excluded
    if (i.kind === 'project' && DELIVERY_EXCLUDED_STATUSES.includes((i as ProjectV2).status)) return false  // F: all delivery-or-later excluded
    return true
  })

  if (framework === 'wsjf') {
    return eligible
      .filter(i => isValidWsjf(i.wsjf))
      .sort((a, b) => (safeWsjfScore(b.wsjf) ?? 0) - (safeWsjfScore(a.wsjf) ?? 0))
      .map(i => i.id)
  }

  // RICE: (Reach × Impact × Confidence%) ÷ Effort
  // Ties broken: confidence desc → effort asc → scoredAt asc (seniority)
  return eligible
    .filter(i => isValidRice(i.rice))
    .sort((a, b) => {
      const ra = a.rice as RiceScore, rb = b.rice as RiceScore
      const sd = (safeRiceScore(rb) ?? 0) - (safeRiceScore(ra) ?? 0)
      if (sd !== 0) return sd
      const cd = rb.confidence - ra.confidence
      if (cd !== 0) return cd
      const ed = ra.effort - rb.effort
      if (ed !== 0) return ed
      return new Date(ra.scoredAt).getTime() - new Date(rb.scoredAt).getTime()
    })
    .map(i => i.id)
}
