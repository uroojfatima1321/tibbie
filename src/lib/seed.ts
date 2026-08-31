import type { TibbieData } from '../types'
import { uid } from './util'
import { today, addDaysISO } from './dates'

// ── Private: raw demo data (no prefixes) ─────────────────────────────────────
function buildDemoDataRaw(): TibbieData {
  const now = new Date().toISOString()
  const t = today()

  const m1 = { id: uid('mem'), name: 'Ayesha Khan',   color: '#C65D3B', createdAt: now }
  const m2 = { id: uid('mem'), name: 'Rohan Mehta',   color: '#2F5743', createdAt: now }
  const m3 = { id: uid('mem'), name: 'Sara Ahmed',    color: '#3A6B8A', createdAt: now }
  const m4 = { id: uid('mem'), name: 'Daniyal Iqbal', color: '#7B4A6E', createdAt: now }

  const p1 = {
    id: uid('prj'),
    name: 'Mobile App v2 Launch',
    description: 'Redesign and release v2 of the customer mobile app.',
    startDate: addDaysISO(t, -7),
    endDate: addDaysISO(t, 35),
    color: '#C65D3B',
    createdAt: now, updatedAt: now,
  }
  const p2 = {
    id: uid('prj'),
    name: 'Q2 Marketing Site Refresh',
    description: 'Refresh the public marketing website for the Q2 campaign.',
    startDate: addDaysISO(t, -3),
    endDate: addDaysISO(t, 21),
    color: '#2F5743',
    createdAt: now, updatedAt: now,
  }

  const mk = (
    projectId: string, name: string, offsetStart: number, duration: number,
    assignees: string[], status: 'not_started'|'in_progress'|'at_risk'|'done',
    percent: number, notes = '', milestone = false,
  ) => ({
    id: uid('tsk'), projectId, name, notes,
    startDate: addDaysISO(t, offsetStart),
    endDate: addDaysISO(t, offsetStart + duration),
    status, percentComplete: percent,
    isMilestone: milestone, assigneeIds: assignees,
    recurring: null, createdAt: now, updatedAt: now,
  })

  const tasks = [
    mk(p1.id, 'Design system audit',       -7, 5,  [m1.id],        'done', 100),
    mk(p1.id, 'New onboarding flow',       -2, 8,  [m1.id, m3.id], 'in_progress', 45, 'Blocked on copy review'),
    mk(p1.id, 'API contract review',        1, 4,  [m2.id],        'not_started', 0),
    mk(p1.id, 'Checkout redesign',          4, 10, [m1.id],        'not_started', 0),
    mk(p1.id, 'QA regression pass',        18, 6,  [m3.id, m4.id], 'not_started', 0),
    mk(p1.id, 'v2 release milestone',      35, 0,  [],             'not_started', 0, 'Public launch date', true),
    mk(p2.id, 'Copy & messaging',          -3, 6,  [m2.id],        'at_risk', 30, 'Awaiting brand sign-off'),
    mk(p2.id, 'Hero section rebuild',       3, 7,  [m1.id, m2.id], 'not_started', 0),
    mk(p2.id, 'Case study content',         5, 10, [m4.id],        'not_started', 0),
    mk(p2.id, 'Launch on staging',         21, 0,  [],             'not_started', 0, 'Soft launch gate', true),
  ]

  return {
    projects: [p1, p2],
    members: [m1, m2, m3, m4],
    tasks,
    dependencies: [
      { predecessorId: tasks[0].id, successorId: tasks[1].id },
      { predecessorId: tasks[1].id, successorId: tasks[3].id },
      { predecessorId: tasks[3].id, successorId: tasks[4].id },
      { predecessorId: tasks[4].id, successorId: tasks[5].id },
      { predecessorId: tasks[6].id, successorId: tasks[7].id },
      { predecessorId: tasks[7].id, successorId: tasks[9].id },
    ],
    holidays: [],
    updates: [],
    phaseTemplates: [],
    projectPhases: [],
    version: 3,
    schemaVersion: 2,
    // ── V2 seed data ────────────────────────────────────────────────────────
    projectsV2: (() => {
      const staleDate = new Date(Date.now() - 105 * 86_400_000).toISOString().slice(0, 10)
      const vp1 = { id: uid('vp'), kind: 'project' as const, name: 'IntelliDesk Mobile App', oneLiner: 'Native iOS/Android app for field agents — replaces the web portal for on-site work.', portfolio: 'Intellicon Platform', status: 'in_testing' as const, ownerIds: [m1.id, m2.id], targetQuarter: 'Q3 2026', tags: [], milestones: [{ id: uid('ms'), name: 'Beta launch', date: addDaysISO(t, 14), status: 'upcoming' as const }], featureIds: [], tracks: [], statusLog: [], decisionLog: [], archived: false, order: 0 as const, createdAt: now, updatedAt: now }
      const vp2 = { id: uid('vp'), kind: 'project' as const, name: 'Data Warehouse v2', oneLiner: 'Migrate reporting from legacy SQL to BigQuery. Unblocks analytics team.', portfolio: 'Intellicon Platform', status: 'architecture' as const, ownerIds: [m2.id], targetQuarter: 'Q4 2026', tags: [], milestones: [], featureIds: [], tracks: [], statusLog: [], decisionLog: [], archived: false, order: 1 as const, createdAt: now, updatedAt: now }
      const vp3 = { id: uid('vp'), kind: 'project' as const, name: 'AIVA — AI Voice Assistant', oneLiner: 'Conversational AI layer for IntelliDesk. Phase 1: FAQ bot; Phase 2: ticket routing.', portfolio: 'New Products & SaaS', status: 'requirement_gathering' as const, ownerIds: [m3.id], targetQuarter: 'Q1 2027', tags: ['ai', 'voice'], milestones: [], featureIds: [], tracks: [], statusLog: [], decisionLog: [], archived: false, order: 0 as const, createdAt: now, updatedAt: now }
      return [vp1, vp2, vp3]
    })(),
    featuresV2: (() => {
      const staleDate = new Date(Date.now() - 105 * 86_400_000).toISOString().slice(0, 10)
      const vf1 = { id: uid('vf'), kind: 'feature' as const, name: 'Push notification support', oneLiner: 'Real-time alerts for job assignments and status updates.', projectId: null, moduleId: null, status: 'in_dev' as const, ownerIds: [m1.id], tags: [], statusLog: [], decisionLog: [], archived: false, order: 0, createdAt: now, updatedAt: now }
      const vf2 = { id: uid('vf'), kind: 'feature' as const, name: 'Offline mode — field sync', oneLiner: 'Allow agents to complete jobs offline and sync when back in coverage.', projectId: null, moduleId: null, status: 'refinement' as const, ownerIds: [m2.id, m3.id], tags: [], statusLog: [], decisionLog: [], archived: false, order: 1, createdAt: now, updatedAt: now }
      const vf3 = { id: uid('vf'), kind: 'feature' as const, name: 'Dark mode', oneLiner: 'System-aware dark theme across all screens.', projectId: null, moduleId: null, status: 'intake' as const, ownerIds: [], tags: [], statusLog: [], decisionLog: [], archived: false, order: 2, createdAt: now, updatedAt: now }
      const vf4 = { id: uid('vf'), kind: 'feature' as const, name: 'Bulk export to CSV', oneLiner: 'Let managers export job lists and audit logs to CSV.', projectId: null, moduleId: null, status: 'intake' as const, ownerIds: [], tags: [], statusLog: [], decisionLog: [], archived: false, order: 3, createdAt: now, updatedAt: now }
      const vf5 = { id: uid('vf'), kind: 'feature' as const, name: 'Multi-tenant support', oneLiner: 'Isolate data per client organisation inside a single deployment.', projectId: null, moduleId: null, status: 'tech_review' as const, ownerIds: [m2.id], tags: [], statusLog: [], decisionLog: [], archived: false, order: 4, createdAt: now, updatedAt: now }
      // Regression seed: partial rice (2 of 4 fields via CR-1.3 inline edit, not yet committed)
      // rice object present but incomplete — must be treated as unscored everywhere
      const vf6 = { id: uid('vf'), kind: 'feature' as const, name: 'API rate limiting', oneLiner: 'Throttle requests per tenant to protect shared infrastructure.', projectId: null, moduleId: null, status: 'intake' as const, ownerIds: [], tags: [], statusLog: [], decisionLog: [], archived: false, order: 5, createdAt: now, updatedAt: now }
      return [vf1, vf2, vf3, vf4, vf5, vf6]
    })(),
    modulesV2: [],
  }
}

// ── Public exports ────────────────────────────────────────────────────────────

/** Returns an empty data store — used to initialize local (offline) mode.
 *  Local mode must never show demo content as if it were real data. */
export function buildSeedData(): TibbieData {
  return {
    projects: [],
    tasks: [],
    members: [],
    dependencies: [],
    holidays: [],
    updates: [],
    phaseTemplates: [],
    projectPhases: [],
    version: 1,
  }
}

/** Returns the demo dataset with every item name prefixed with [DEMO].
 *  Used only when the user explicitly clicks "Load demo data" in local mode. */
export function buildDemoData(): TibbieData {
  const raw = buildDemoDataRaw()
  return {
    ...raw,
    projects:   raw.projects.map(p => ({ ...p, name: `[DEMO] ${p.name}` })),
    tasks:      raw.tasks.map(t => ({ ...t, name: `[DEMO] ${t.name}` })),
    members:    raw.members.map(m => ({ ...m, name: `[DEMO] ${m.name}` })),
    projectsV2: (raw.projectsV2 ?? []).map(p => ({ ...p, name: `[DEMO] ${p.name}` })),
    featuresV2: (raw.featuresV2 ?? []).map(f => ({ ...f, name: `[DEMO] ${f.name}` })),
  }
}
