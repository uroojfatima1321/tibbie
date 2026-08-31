/**
 * filterV2.ts — V2 filter state, application, and URL serialisation.
 * Scoring (RICE, WSJF, mustDo, effortSize, preset) removed in Batch A.
 * Surviving filters: type, status, portfolio, owner, quarter, module, flags.
 */
import type { ProjectV2, FeatureV2, ModuleV2 } from '../types'

export type FilterType = 'both' | 'projects' | 'features' | 'modules'

export interface V2FilterState {
  type: FilterType
  statuses: string[]
  portfolios: string[]
  ownerIds: string[]
  quarter: string | null
  moduleId: string | null
  flags: {
    onHold: boolean
    inRework: boolean
    blockedTracks: boolean
    clientTimeline: boolean
  }
}

export const EMPTY_FILTER: V2FilterState = {
  type: 'both',
  statuses: [],
  portfolios: [],
  ownerIds: [],
  quarter: null,
  moduleId: null,
  flags: { onHold: false, inRework: false, blockedTracks: false, clientTimeline: false },
}

// ── Live-group statuses (used by status-based display logic) ─────────────────
const LIVE_STATUSES = ['beta_production', 'production', 'production_monitoring', 'mvp_live']
export const LIVE_GROUP_STATUSES: string[] = LIVE_STATUSES

// ── Batch A: In-delivery statuses (kept for ProjectCard/Drawer display logic) ─
// IN_DELIVERY_STATUSES and DELIVERY_EXCLUDED_STATUSES removed — Batch A cleanup.
// Their only job was rank exclusion; ranking is gone. No consumers outside this file.

// ── Helper: check if a filter state is effectively empty ─────────────────────
export function isFilterEmpty(f: V2FilterState): boolean {
  return (
    f.type === 'both' &&
    f.statuses.length === 0 &&
    f.portfolios.length === 0 &&
    f.ownerIds.length === 0 &&
    f.quarter === null &&
    f.moduleId === null &&
    !f.flags.onHold &&
    !f.flags.inRework &&
    !f.flags.blockedTracks &&
    !f.flags.clientTimeline
  )
}

// ── Main filter function ─────────────────────────────────────────────────────
export function applyV2Filter(
  items: (ProjectV2 | FeatureV2 | ModuleV2)[],
  filter: V2FilterState,
): (ProjectV2 | FeatureV2 | ModuleV2)[] {
  let result = [...items]

  // Type filter
  if (filter.type === 'projects') result = result.filter(i => i.kind === 'project')
  if (filter.type === 'features') result = result.filter(i => i.kind === 'feature')
  if (filter.type === 'modules')  result = result.filter(i => i.kind === 'module')

  // Status
  if (filter.statuses.length) result = result.filter(i => filter.statuses.includes(i.status))

  // Portfolio
  if (filter.portfolios.length) {
    result = result.filter(i => {
      if (i.kind === 'project') return filter.portfolios.includes((i as ProjectV2).portfolio)
      const projId = i.kind === 'module' ? (i as ModuleV2).projectId : (i as FeatureV2).projectId
      const proj = items.find(p => p.kind === 'project' && p.id === projId) as ProjectV2 | undefined
      return proj ? filter.portfolios.includes(proj.portfolio) : filter.portfolios.includes('__backlog__')
    })
  }

  // Owner
  if (filter.ownerIds.length) {
    result = result.filter(i => filter.ownerIds.some(o => i.ownerIds.includes(o)))
  }

  // Quarter — projects only
  if (filter.quarter) {
    result = result.filter(i =>
      i.kind === 'project' ? (i as ProjectV2).targetQuarter === filter.quarter : false
    )
  }

  // Module dimension filter — features only
  if (filter.moduleId) {
    result = result.filter(i =>
      i.kind === 'feature' && (i as FeatureV2).moduleId === filter.moduleId
    )
  }

  // Flags
  if (filter.flags.onHold) result = result.filter(i => i.status === 'on_hold')
  if (filter.flags.inRework) result = result.filter(i => i.status === 'rework')
  if (filter.flags.blockedTracks) {
    result = result.filter(i =>
      i.kind === 'project' && (i as ProjectV2).tracks.some(t => t.blocked)
    )
  }
  if (filter.flags.clientTimeline) {
    result = result.filter(i =>
      i.kind === 'project' && !!(i as ProjectV2).clientTimeline
    )
  }

  return result
}

// ── URL serialisation ─────────────────────────────────────────────────────────
export function filterToParams(f: V2FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.type !== 'both') p.set('type', f.type)
  if (f.statuses.length) p.set('statuses', f.statuses.join(','))
  if (f.portfolios.length) p.set('portfolios', f.portfolios.join(','))
  if (f.ownerIds.length) p.set('owners', f.ownerIds.join(','))
  if (f.quarter) p.set('quarter', f.quarter)
  if (f.moduleId) p.set('module', f.moduleId)
  if (f.flags.onHold) p.set('flags', [...p.get('flags')?.split(',') ?? [], 'onHold'].join(','))
  if (f.flags.inRework) p.set('flags', [...p.get('flags')?.split(',') ?? [], 'inRework'].join(','))
  if (f.flags.blockedTracks) p.set('flags', [...p.get('flags')?.split(',') ?? [], 'blockedTracks'].join(','))
  if (f.flags.clientTimeline) p.set('flags', [...p.get('flags')?.split(',') ?? [], 'clientTimeline'].join(','))
  return p
}

export function paramsToFilter(params: URLSearchParams): V2FilterState {
  const f: V2FilterState = { ...EMPTY_FILTER }
  try {
    const type = params.get('type')
    if (type && ['both','projects','features','modules'].includes(type)) f.type = type as FilterType
    const statuses = params.get('statuses'); if (statuses) f.statuses = statuses.split(',').filter(Boolean)
    const portfolios = params.get('portfolios'); if (portfolios) f.portfolios = portfolios.split(',').filter(Boolean)
    const owners = params.get('owners'); if (owners) f.ownerIds = owners.split(',').filter(Boolean)
    const quarter = params.get('quarter'); if (quarter) f.quarter = quarter
    const moduleId = params.get('module'); if (moduleId) f.moduleId = moduleId
    const flags = params.get('flags')?.split(',') ?? []
    if (flags.includes('onHold')) f.flags.onHold = true
    if (flags.includes('inRework')) f.flags.inRework = true
    if (flags.includes('blockedTracks')) f.flags.blockedTracks = true
    if (flags.includes('clientTimeline')) f.flags.clientTimeline = true
    // A4.3: unknown keys from old presets (effortSizes, riceMin, riceMax, mustDo, etc.)
    // are silently ignored — no throw, no crash.
  } catch { /* malformed URL params — return empty filter */ }
  return f
}
