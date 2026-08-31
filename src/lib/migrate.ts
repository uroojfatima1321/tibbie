/**
 * migrate.ts — canonical data migration pipeline.
 * Pure function: no React, no adapter, no side effects.
 * Imported by context.tsx (runtime) and boot-test.ts (tests).
 *
 * Every step is idempotent. Running migrate() twice produces the same result.
 * schemaVersion guards one-time destructive steps.
 */
import type { TibbieData } from '../types'

export function migrate(data: TibbieData | undefined): TibbieData | undefined {
  if (!data) return data
  const d: any = { ...data }

  // ── Array initialisation ──────────────────────────────────────────────────
  if (!Array.isArray(d.holidays))      d.holidays      = []
  if (!Array.isArray(d.updates))       d.updates       = []
  if (!Array.isArray(d.phaseTemplates))d.phaseTemplates= []
  if (!Array.isArray(d.projectPhases)) d.projectPhases = []
  // V2 arrays — additive only, never touch V1 above
  if (!Array.isArray(d.projectsV2))    d.projectsV2    = []
  if (!Array.isArray(d.featuresV2))    d.featuresV2    = []
  if (!Array.isArray(d.userPresets))   d.userPresets   = []
  if (!Array.isArray(d.deletionLog))   d.deletionLog   = []

  // ── schemaVersion 2: first-time V2 seed from V1 records ──────────────────
  if (!d.schemaVersion) {
    const now = new Date().toISOString()
    d.schemaVersion = 2
    if (d.projectsV2.length === 0 && Array.isArray(d.projects) && d.projects.length > 0) {
      d.projectsV2 = d.projects.map((p: any, i: number) => ({
        id: 'v2-' + p.id, kind: 'project',
        name: p.name, oneLiner: (p.description || '').slice(0, 140),
        portfolio: 'Uncategorized', status: 'intake',
        ownerIds: [], tags: [], milestones: [], featureIds: [],
        tracks: [], statusLog: [], decisionLog: [],
        archived: false, order: i, rice: null,
        createdAt: p.createdAt || now, updatedAt: now,
      }))
    }
  }

  // ── P-3 compat: itemType backfill ────────────────────────────────────────
  d.featuresV2 = (d.featuresV2 as any[]).map((f: any) => 'itemType' in f ? f : { ...f, itemType: 'feature' })

  // ── Phase D: moduleId backfill + modulesV2 ───────────────────────────────
  d.featuresV2 = (d.featuresV2 as any[]).map((f: any) => 'moduleId' in f ? f : { ...f, moduleId: null })
  if (!Array.isArray(d.modulesV2)) d.modulesV2 = []
  d.modulesV2 = (d.modulesV2 as any[]).map((m: any) => 'wsjf' in m ? m : { ...m, wsjf: null })
  // EXC-1 (M5.1 C): backfill ModuleV2 roadmap fields (milestones, tracks; idempotent)
  d.modulesV2 = (d.modulesV2 as any[]).map((m: any) => ({
    ...m,
    milestones: m.milestones ?? [],
    tracks:     m.tracks     ?? [],
  }))
  // EXC-1 (M5.1 C): backfill Task.moduleId (idempotent)
  if (Array.isArray(d.tasks)) {
    d.tasks = (d.tasks as any[]).map((t: any) => 'moduleId' in t ? t : { ...t, moduleId: null })
  }

  // ── Item 6: Activity Log — merge decisionLog + statusLog into activityLog ─
  // Idempotent: entry ID checked; already-merged entries never duplicated.
  // Old decisionLog/statusLog remain readable; writes stop at migration time.
  function mergeActivityLog(entity: any): any {
    if (!entity) return entity
    const existing: any[] = Array.isArray(entity.activityLog) ? entity.activityLog : []
    const existingIds = new Set(existing.map((e: any) => e.id))
    const extra: any[] = []
    for (const d2 of (entity.decisionLog || [])) {
      if (!existingIds.has(d2.id)) {
        extra.push({ id: d2.id, at: d2.at, kind: 'user', text: d2.text, tag: 'Decision', systemEventType: 'migrated' })
      }
    }
    for (const s of (entity.statusLog || [])) {
      if (!existingIds.has(s.id)) {
        extra.push({ id: s.id, at: s.at, kind: 'system', text: `Status: ${s.from || '—'} → ${s.to}${s.note ? ` (${s.note})` : ''}`, systemEventType: 'status_change' })
      }
    }
    if (extra.length === 0) return entity  // idempotent — nothing new to merge
    const merged = [...existing, ...extra].sort((a: any, b: any) => a.at.localeCompare(b.at))
    return { ...entity, activityLog: merged }
  }
  d.projectsV2 = (d.projectsV2 as any[]).map(mergeActivityLog)
  d.featuresV2 = (d.featuresV2 as any[]).map(mergeActivityLog)
  d.modulesV2  = (d.modulesV2  as any[]).map(mergeActivityLog)

  // ── schemaVersion 3: V1 → V2 project unification (destructive, one-time) ─
  if ((d.schemaVersion ?? 0) < 3) {
    const now3 = new Date().toISOString()
    const v1Projects: any[] = Array.isArray(d.projects) ? [...d.projects] : []
    const v2Projects: any[] = [...(d.projectsV2 || [])]
    const idMap = new Map<string, string>()

    for (const v1 of v1Projects) {
      let v2 = v2Projects.find((p: any) => p.id === 'vp-' + v1.id)
             ?? v2Projects.find((p: any) => !p.archived && p.name.toLowerCase() === v1.name.toLowerCase())
      if (!v2) {
        v2 = {
          id: 'vp-' + v1.id, kind: 'project',
          name: v1.name, oneLiner: (v1.description || '').slice(0, 140),
          portfolio: 'Uncategorized', status: 'intake',
          ownerIds: [], tags: [], milestones: [], featureIds: [],
          tracks: [], statusLog: [], decisionLog: [],
          archived: false, order: v2Projects.length, rice: null, wsjf: null,
          createdAt: v1.createdAt ?? now3, updatedAt: now3,
          color: v1.color, ganttStart: v1.startDate, ganttEnd: v1.endDate,
        }
        v2Projects.push(v2)
      } else {
        const needs = (!v2.color && v1.color) || (!v2.ganttStart && v1.startDate) || (!v2.ganttEnd && v1.endDate)
        if (needs) {
          const idx = v2Projects.findIndex((p: any) => p.id === v2.id)
          v2Projects[idx] = {
            ...v2,
            color: v2.color ?? v1.color,
            ganttStart: v2.ganttStart ?? v1.startDate,
            ganttEnd: v2.ganttEnd ?? v1.endDate,
          }
          v2 = v2Projects[idx]
        }
      }
      idMap.set(v1.id, v2.id)
    }

    d.tasks = (Array.isArray(d.tasks) ? d.tasks : []).map((t: any) => ({
      ...t, projectId: idMap.get(t.projectId) ?? t.projectId,
    }))

    // ── Fix 4 (R1-C2): backup V1 projects BEFORE clearing ──────────────────
    // _v1ProjectsBackup is included in this KV write (the first save after migration),
    // providing a recovery path if the migration had edge cases.
    if (v1Projects.length > 0) {
      d._v1ProjectsBackup = v1Projects
    }
    d.projects    = []
    d.projectsV2  = v2Projects
    d.schemaVersion = 3
  }

  // ── schemaVersion 4: Batch A — prune scoring fields (Batch A, Aug 2026) ───
  // Pure subtraction. Explicit allow-list of keys to remove.
  // Idempotent: fields simply won't exist on second run. No-op if already clean.
  // workspaceSettings.framework key removed; container preserved.
  // Owner MUST export backup JSON before deploying this build.
  if ((d.schemaVersion ?? 0) < 4) {
    const PRUNE_ENTITY_KEYS = ['rice', 'wsjf', 'mustDo', 'valueRating', 'effortEstimate']

    let pruneCount = 0

    function pruneEntity(entity: any): any {
      if (!entity || typeof entity !== 'object') return entity
      let changed = false
      const pruned = { ...entity }
      for (const key of PRUNE_ENTITY_KEYS) {
        if (key in pruned) {
          delete pruned[key]
          changed = true
          pruneCount++
        }
      }
      return changed ? pruned : entity
    }

    d.projectsV2 = (d.projectsV2 as any[]).map(pruneEntity)
    d.featuresV2 = (d.featuresV2 as any[]).map(pruneEntity)
    d.modulesV2  = (d.modulesV2  as any[]).map(pruneEntity)

    // Remove framework key from workspaceSettings container (not the container itself)
    if (d.workspaceSettings && typeof d.workspaceSettings === 'object') {
      const ws = { ...(d.workspaceSettings as any) }
      if ('framework' in ws) {
        delete ws.framework
        pruneCount++
        d.workspaceSettings = ws
      }
    }

    // Expose preflight count for in-app diagnostics overlay (not console)
    _v4PruneCount = pruneCount

    d.schemaVersion = 4
  }

  return d as TibbieData
}

// ── Batch A: preflight count exposed for diagnostics overlay ─────────────────
// Read by Nav.tsx diagnostics panel. Reset on hot-reload; persists for session.
let _v4PruneCount = 0
export function getV4PruneCount(): number { return _v4PruneCount }
