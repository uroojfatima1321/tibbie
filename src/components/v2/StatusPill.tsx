import type { ProjectStatus, FeatureStatus } from '../../types'

type AnyStatus = ProjectStatus | FeatureStatus

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  intake: 'Intake',
  requirement_gathering: 'Req. Gathering',
  requirement_analysis: 'Req. Analysis',
  architecture: 'Architecture & Req.',
  development: 'Development',
  in_testing: 'In Testing',
  beta_production: 'Beta',
  production: 'Production',
  production_monitoring: 'Prod. Monitoring',
  mvp_live: 'MVP Live',
  on_hold: 'On Hold',
  killed: 'Killed',
}

const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  intake: 'Intake',
  tech_review: 'Tech Review',
  refinement: 'Refinement',
  in_dev: 'In Dev',
  code_review: 'Code Review',
  qa: 'QA',
  staging_signoff: 'Staging / Sign-off',
  shipped: 'Shipped',
  rework: 'Rework',
  on_hold: 'On Hold',
  killed: 'Killed',
}

// Returns [bg, text, border] tailwind class string
function pillClasses(status: AnyStatus): string {
  switch (status) {
    case 'intake':                return 'border border-ink-300 text-ink-500 bg-white'
    case 'requirement_gathering': return 'bg-steel-500 text-white'
    case 'requirement_analysis':  return 'bg-steel-600 text-white'
    case 'architecture':          return 'bg-navy-500 text-white'
    case 'development':           return 'bg-steel-500 text-white'
    case 'in_testing':            return 'bg-amber-50 border border-amber-200 text-amber-600'
    case 'code_review':           return 'bg-white border border-amber-500 text-amber-600'
    case 'beta_production':       return 'bg-forest-400 text-white'
    case 'production':            return 'bg-forest-500 text-white'
    case 'production_monitoring': return 'bg-forest-600 text-white'
    case 'mvp_live':              return 'bg-forest-400 text-white'
    case 'tech_review':           return 'bg-steel-500 text-white'
    case 'refinement':            return 'bg-steel-600 text-white'
    case 'in_dev':                return 'bg-steel-500 text-white'
    case 'qa':                    return 'bg-amber-50 border border-amber-200 text-amber-600'
    case 'staging_signoff':       return 'bg-forest-400 text-white'
    case 'shipped':               return 'bg-forest-500 text-white'
    case 'rework':                return 'bg-brick-500 text-white'
    case 'on_hold':               return 'border border-ink-300 text-ink-500 bg-white'
    case 'killed':                return 'bg-brick-600 text-white'
    default:                      return 'bg-surface-100 text-ink-600'
  }
}

// Left-border color for project cards
export function statusBorderColor(status: ProjectStatus): string {
  switch (status) {
    case 'intake':                return '#A8A29A'
    case 'requirement_gathering':
    case 'requirement_analysis': return '#3A6B8A'
    case 'architecture':          return '#232B3A'
    case 'development':           return '#3A6B8A'
    case 'in_testing':            return '#C8932F'
    case 'beta_production':
    case 'mvp_live':              return '#4F7C66'
    case 'production':            return '#2F5743'
    case 'production_monitoring': return '#234433'
    case 'on_hold':               return '#8B8680'
    case 'killed':                return '#8A2F23'
    default:                      return '#8B8680'
  }
}

export function getStatusLabel(status: AnyStatus, kind: 'project' | 'feature' = 'project'): string {
  if (kind === 'feature') return FEATURE_STATUS_LABELS[status as FeatureStatus] ?? status
  return PROJECT_STATUS_LABELS[status as ProjectStatus] ?? status
}

export const ALL_PROJECT_STATUSES = Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]
export const ALL_FEATURE_STATUSES = Object.keys(FEATURE_STATUS_LABELS) as FeatureStatus[]

interface Props {
  status: AnyStatus
  kind?: 'project' | 'feature'
  reworkGate?: string
  className?: string
}

export function StatusPill({ status, kind = 'project', reworkGate, className = '' }: Props) {
  const label = status === 'rework' && reworkGate
    ? `Rework ◂ ${reworkGate}`
    : getStatusLabel(status, kind)
  return (
    <span className={`inline-flex items-center font-sans text-[11px] font-medium px-2.5 py-[3px] rounded-full ${pillClasses(status)} ${className}`}>
      {label}
    </span>
  )
}
