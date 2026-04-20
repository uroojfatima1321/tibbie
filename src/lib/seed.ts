import type { TibbieData } from '../types'
import { uid } from './util'
import { today, addDaysISO } from './dates'

export function buildSeedData(): TibbieData {
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
    version: 1,
  }
}
