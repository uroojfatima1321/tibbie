/**
 * consistency.ts — data integrity validation and self-healing.
 * Pure functions — no React, no adapter.
 * Imported by context.tsx (runs on every load) and boot-test.ts.
 *
 * Rules enforced:
 *   - Module.projectId must reference an existing (non-archived) project
 *   - Feature.moduleId, if set, must reference an existing module
 *   - Feature.projectId must match its module's projectId when moduleId is set
 *   - Orphaned features (projectId → deleted project) get projectId: null
 */
import type { TibbieData, ProjectV2, FeatureV2, ModuleV2 } from '../types'

export interface ConsistencyIssue {
  kind: 'orphan-module' | 'orphan-feature-module' | 'feature-project-mismatch' | 'orphan-feature-project'
  id: string
  detail: string
}

/** Returns list of consistency violations. Empty = clean. */
export function validateConsistency(data: TibbieData): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = []
  const projectsV2: ProjectV2[] = data.projectsV2 || []
  const featuresV2: FeatureV2[] = data.featuresV2 || []
  const modulesV2: ModuleV2[]   = data.modulesV2   || []

  const projectIds  = new Set(projectsV2.map(p => p.id))
  const moduleMap   = new Map(modulesV2.map(m => [m.id, m]))

  for (const mod of modulesV2) {
    if (!projectIds.has(mod.projectId)) {
      issues.push({ kind: 'orphan-module', id: mod.id, detail: `Module "${mod.name}" has invalid projectId "${mod.projectId}"` })
    }
  }

  for (const feat of featuresV2) {
    if (feat.projectId && !projectIds.has(feat.projectId)) {
      issues.push({ kind: 'orphan-feature-project', id: feat.id, detail: `Feature "${feat.name}" has invalid projectId "${feat.projectId}"` })
    }
    if (feat.moduleId) {
      const mod = moduleMap.get(feat.moduleId)
      if (!mod) {
        issues.push({ kind: 'orphan-feature-module', id: feat.id, detail: `Feature "${feat.name}" has invalid moduleId "${feat.moduleId}"` })
      } else if (feat.projectId && feat.projectId !== mod.projectId) {
        issues.push({ kind: 'feature-project-mismatch', id: feat.id, detail: `Feature "${feat.name}" projectId "${feat.projectId}" ≠ module's projectId "${mod.projectId}"` })
      }
    }
  }

  return issues
}

/** Apply fixes for all detected issues. Returns healed data. Idempotent. */
export function selfHeal(data: TibbieData): TibbieData {
  const now = new Date().toISOString()
  const projectIds = new Set((data.projectsV2 || []).map(p => p.id))
  const moduleMap  = new Map((data.modulesV2 || []).map(m => [m.id, m]))

  // Fix modules with invalid projectId: archive them (can't create a project for them)
  const modulesV2 = (data.modulesV2 || []).map(m =>
    projectIds.has(m.projectId) ? m : { ...m, archived: true, updatedAt: now }
  )

  // Valid modules after healing
  const healedModuleMap = new Map(modulesV2.filter(m => !m.archived).map(m => [m.id, m]))

  // Fix features
  const featuresV2 = (data.featuresV2 || []).map(f => {
    let updated = { ...f }
    let changed = false

    // Fix orphaned project reference
    if (f.projectId && !projectIds.has(f.projectId)) {
      updated = { ...updated, projectId: null, moduleId: null, updatedAt: now }
      changed = true
    }

    // Fix orphaned module reference
    if (f.moduleId && !healedModuleMap.has(f.moduleId)) {
      updated = { ...updated, moduleId: null, updatedAt: now }
      changed = true
    }

    // Fix project/module mismatch: derive from module
    if (updated.moduleId) {
      const mod = healedModuleMap.get(updated.moduleId)
      if (mod && updated.projectId !== mod.projectId) {
        updated = { ...updated, projectId: mod.projectId, updatedAt: now }
        changed = true
      }
    }

    return changed ? updated : f
  })

  return { ...data, modulesV2, featuresV2 }
}
