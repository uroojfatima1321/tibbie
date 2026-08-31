import type { PhaseTemplate } from '../types'
import { uid } from './util'

/**
 * Default phase library — common phases across PM workflows.
 * Users can load these as a starting point and then edit, add, or remove.
 * Colors chosen to be distinct but harmonize with the rust/cream/forest palette.
 */
export function buildPhasePresets(): PhaseTemplate[] {
  const now = new Date().toISOString()
  const mk = (name: string, description: string, color: string): PhaseTemplate => ({
    id: uid('pht'), name, description, color, createdAt: now,
  })

  return [
    mk('Discovery',         'Research, user interviews, problem validation',           '#7B4A6E'),
    mk('Requirements',      'Gather and document functional requirements',             '#3A6B8A'),
    mk('Architecture',      'System design, technical decisions, integration plan',    '#2F5743'),
    mk('UX Design',         'Wireframes, user flows, design reviews',                  '#C65D3B'),
    mk('UI Design',         'Visual design, prototypes, design system updates',        '#D88752'),
    mk('Build',             'Engineering implementation',                              '#4A6E8B'),
    mk('QA',                'Quality assurance, regression testing, bug fixing',       '#C8932F'),
    mk('UAT',               'User acceptance testing with stakeholders',               '#A8763D'),
    mk('Release',           'Production deployment, rollout, monitoring',              '#5A7A4A'),
    mk('Post-Launch',       'Monitor, gather feedback, iterate',                       '#8B8680'),
  ]
}
