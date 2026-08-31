import type { ProjectV2, FeatureV2, ModuleV2, RiceScore } from '../types'

export interface V2FilterState {
  type: 'both' | 'projects' | 'features' | 'modules'
  statuses: string[]
  portfolios: string[]
  ownerIds: string[]
  effortSizes: ('S' | 'M' | 'L' | 'XL')[]
  riceMin: number | null
  riceMax: number | null
  quarter: string | null
  moduleId: string | null     // Phase D: filter to a specific module
  flags: {
    unscored: boolean
    stale: boolean
    onHold: boolean
    inRework: boolean
    blockedTracks: boolean
    mustDo: boolean
    clientTimeline: boolean
  }
  preset: string | null
}

export const EMPTY_FILTER: V2FilterState = {
  type: 'both',
  statuses: [],
  portfolios: [],
  ownerIds: [],
  effortSizes: [],
  riceMin: null,
  riceMax: null,
  quarter: null,
  moduleId: null,
  flags: { unscored: false, stale: false, onHold: false, inRework: false, blockedTracks: false, mustDo: false, clientTimeline: false },
  preset: null,
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const STALE_DAYS = 90
const LIVE_STATUSES = ['beta_production', 'production', 'production_monitoring', 'mvp_live']
// Exported so ProjectCard/Drawer can import without duplicating
export const LIVE_GROUP_STATUSES: string[] = LIVE_STATUSES

function riceScore(item: ProjectV2 | FeatureV2): number | null {
  if (!item.rice) return null
  return (item.rice.reach * item.rice.impact * (item.rice.confidence / 100)) / item.rice.effort
}

function isStale(item: ProjectV2 | FeatureV2): boolean {
  if (!item.rice) return false
  return (Date.now() - new Date(item.rice.scoredAt).getTime()) > STALE_DAYS * 86_400_000
}

function currentQuarter(): string {
  const now = new Date()
  const q = Math.ceil((now.getMonth() + 1) / 3)
  return `Q${q} ${now.getFullYear()}`
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// ── Presets ──────────────────────────────────────────────────────────────────
export const BUILT_IN_PRESETS: Record<string, (items: (ProjectV2 | FeatureV2)[], all: (ProjectV2 | FeatureV2)[]) => boolean> = {
  'Quick Wins': (_, all) => false,   // Per-item logic below
  'At Risk': (_, all) => false,
  'This Quarter': (_, all) => false,
  'Unscored': (_, all) => false,
  'Kill candidates': (_, all) => false,
  'Launch risk': (_, all) => false,
  'Live & iterating': (_, all) => false,  // Per-item logic below
}

export function applyPreset(
  presetName: string,
  item: ProjectV2 | FeatureV2,
  allItems: (ProjectV2 | FeatureV2)[],
): boolean {
  const scored = allItems.filter(i => i.rice !== null).map(i => riceScore(i)!).sort((a, b) => a - b)
  const p75 = scored.length ? scored[Math.floor(scored.length * 0.75)] : 0
  const p25 = scored.length ? scored[Math.floor(scored.length * 0.25)] : 0

  switch (presetName) {
    case 'Quick Wins': {
      const score = riceScore(item)
      const effort = item.effortEstimate
      return score !== null && score >= p75 && (effort === 'S' || effort === 'M')
    }
    case 'At Risk': {
      const inRework = item.status === 'rework' || item.status === 'on_hold'
      const missedMs = item.kind === 'project'
        ? (item as ProjectV2).milestones.some(m => m.status === 'missed')
        : false
      return inRework || missedMs
    }
    case 'This Quarter': {
      const q = item.kind === 'project' ? (item as ProjectV2).targetQuarter : null
      return q === currentQuarter()
    }
    case 'Unscored':
      return item.rice === null
    case 'Kill candidates': {
      const score = riceScore(item)
      const ageDays = daysSince(item.createdAt)
      return ageDays > 180 && (score === null || score <= p25)
    }
    case 'Launch risk': {
      if (item.kind !== 'project') return false
      const p = item as ProjectV2
      const isLive = LIVE_STATUSES.includes(p.status)
      if (!isLive) return false
      const hasUntrackedOrBlocked = p.tracks.some(t => t.status === 'not_started' || t.blocked)
      return hasUntrackedOrBlocked
    }
    case 'Live & iterating': {
      // P-5: Live-group project with ≥1 active (non-terminal, non-archived) child feature/improvement
      if (item.kind !== 'project') return false
      const p = item as ProjectV2
      if (!LIVE_STATUSES.includes(p.status)) return false
      const TERMINAL = ['shipped', 'killed']
      const activeChildren = allItems.filter(i =>
        i.kind === 'feature' &&
        (i as FeatureV2).projectId === p.id &&
        !TERMINAL.includes(i.status) &&
        !(i as FeatureV2).archived
      )
      return activeChildren.length > 0
    }
    default:
      return true
  }
}

// ── Main filter function ──────────────────────────────────────────────────────
export function applyV2Filter(
  items: (ProjectV2 | FeatureV2 | ModuleV2)[],
  filter: V2FilterState,
): (ProjectV2 | FeatureV2 | ModuleV2)[] {
  let result = [...items]

  // Type filter — Phase D adds modules
  if (filter.type === 'projects') result = result.filter(i => i.kind === 'project')
  if (filter.type === 'features') result = result.filter(i => i.kind === 'feature')
  if (filter.type === 'modules')  result = result.filter(i => i.kind === 'module')

  // Preset — modules don't have preset logic, filter only projects/features
  if (filter.preset && BUILT_IN_PRESETS[filter.preset] !== undefined) {
    result = result.filter(i =>
      i.kind === 'module' ? false : applyPreset(filter.preset!, i as ProjectV2 | FeatureV2, items as (ProjectV2 | FeatureV2)[])
    )
  }

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

  // Effort sizes — modules don't have effortEstimate, skip them
  if (filter.effortSizes.length) {
    result = result.filter(i => {
      if (i.kind === 'module') return false
      const ef = (i as ProjectV2 | FeatureV2).effortEstimate
      return ef && filter.effortSizes.includes(ef)
    })
  }

  // RICE range
  if (filter.riceMin !== null || filter.riceMax !== null) {
    result = result.filter(i => {
      const s = riceScore(i as ProjectV2 | FeatureV2)
      if (s === null) return false
      if (filter.riceMin !== null && s < filter.riceMin) return false
      if (filter.riceMax !== null && s > filter.riceMax) return false
      return true
    })
  }

  // Quarter — projects only
  if (filter.quarter) {
    result = result.filter(i =>
      i.kind === 'project' ? (i as ProjectV2).targetQuarter === filter.quarter : false
    )
  }

  // Flags
  if (filter.flags.unscored) result = result.filter(i => i.rice === null)
  if (filter.flags.stale) result = result.filter(i => isStale(i as ProjectV2 | FeatureV2))
  if (filter.flags.onHold) result = result.filter(i => i.status === 'on_hold')
  if (filter.flags.inRework) result = result.filter(i => i.status === 'rework')
  if (filter.flags.blockedTracks) {
    result = result.filter(i =>
      i.kind === 'project' && (i as ProjectV2).tracks.some(t => t.blocked)
    )
  }
  // Phase B new flags
  if (filter.flags.mustDo) result = result.filter(i => !!i.mustDo)
  if (filter.flags.clientTimeline) result = result.filter(i =>
    i.kind === 'project' && !!(i as ProjectV2).clientTimeline
  )

  // Phase D: module dimension filter
  if (filter.moduleId) {
    result = result.filter(i =>
      i.kind === 'feature' && (i as FeatureV2).moduleId === filter.moduleId
    )
  }

  return result
}

// ── URL serialization ─────────────────────────────────────────────────────────
export function filterToParams(f: V2FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.type !== 'both') p.set('type', f.type)
  if (f.statuses.length) p.set('status', f.statuses.join(','))
  if (f.portfolios.length) p.set('portfolio', f.portfolios.join('|'))
  if (f.ownerIds.length) p.set('owner', f.ownerIds.join(','))
  if (f.effortSizes.length) p.set('effort', f.effortSizes.join(','))
  if (f.riceMin !== null) p.set('riceMin', String(f.riceMin))
  if (f.riceMax !== null) p.set('riceMax', String(f.riceMax))
  if (f.quarter) p.set('quarter', f.quarter)
  const activeFlags = Object.entries(f.flags).filter(([, v]) => v).map(([k]) => k)
  if (activeFlags.length) p.set('flags', activeFlags.join(','))
  if (f.preset) p.set('preset', f.preset)
  return p
}

export function paramsToFilter(params: URLSearchParams): V2FilterState {
  const f = { ...EMPTY_FILTER, flags: { ...EMPTY_FILTER.flags } }
  try {
    const type = params.get('type')
    if (type === 'projects' || type === 'features') f.type = type
    const status = params.get('status'); if (status) f.statuses = status.split(',').filter(Boolean)
    const portfolio = params.get('portfolio'); if (portfolio) f.portfolios = portfolio.split('|').filter(Boolean)
    const owner = params.get('owner'); if (owner) f.ownerIds = owner.split(',').filter(Boolean)
    const effort = params.get('effort'); if (effort) f.effortSizes = effort.split(',').filter(s => ['S','M','L','XL'].includes(s)) as V2FilterState['effortSizes']
    const riceMin = params.get('riceMin'); if (riceMin) { const n = Number(riceMin); if (!isNaN(n)) f.riceMin = n }
    const riceMax = params.get('riceMax'); if (riceMax) { const n = Number(riceMax); if (!isNaN(n)) f.riceMax = n }
    const quarter = params.get('quarter'); if (quarter) f.quarter = quarter
    const flags = params.get('flags')
    if (flags) {
      const fs = flags.split(',')
      if (fs.includes('unscored')) f.flags.unscored = true
      if (fs.includes('stale')) f.flags.stale = true
      if (fs.includes('onHold')) f.flags.onHold = true
      if (fs.includes('inRework')) f.flags.inRework = true
      if (fs.includes('blockedTracks')) f.flags.blockedTracks = true
      if (fs.includes('mustDo')) f.flags.mustDo = true
      if (fs.includes('clientTimeline')) f.flags.clientTimeline = true
    }
    const preset = params.get('preset'); if (preset) f.preset = preset
  } catch {}
  return f
}

export function isFilterEmpty(f: V2FilterState): boolean {
  return (
    f.type === 'both' && !f.statuses.length && !f.portfolios.length &&
    !f.ownerIds.length && !f.effortSizes.length &&
    f.riceMin === null && f.riceMax === null && !f.quarter &&
    !Object.values(f.flags).some(Boolean) && !f.preset
  )
}

// ── WSJF score helpers (Phase C) ──────────────────────────────────────────────
import type { WsjfScore } from '../types'

export function isValidWsjf(w: WsjfScore | null | undefined): w is WsjfScore {
  if (w == null) return false
  return w.businessValue >= 1 && w.timeCriticality >= 1 && w.riskOpportunity >= 1 && w.jobSize >= 1 &&
         w.businessValue <= 10 && w.timeCriticality <= 10 && w.riskOpportunity <= 10 && w.jobSize <= 10
}

export function safeWsjfScore(w: WsjfScore | null | undefined): number | null {
  if (!isValidWsjf(w)) return null
  return (w.businessValue + w.timeCriticality + w.riskOpportunity) / w.jobSize
}

// ── Shared rice validity guard (use everywhere before accessing rice fields) ──
/** Returns true only when all 4 RICE fields are present and in valid range.
 *  Guards against null, undefined, and partial fills (CR-1.3). */
export function isValidRice(r: RiceScore | null | undefined): r is RiceScore {
  if (r == null) return false
  if (typeof r !== 'object') return false
  return (
    r.reach != null && r.impact != null &&
    r.confidence != null && r.confidence >= 0 && r.confidence <= 100 &&
    r.effort != null && r.effort >= 0.5
  )
}

export function safeRiceScore(r: RiceScore | null | undefined): number | null {
  if (!isValidRice(r)) return null
  return (r.reach * r.impact * (r.confidence / 100)) / r.effort
}
