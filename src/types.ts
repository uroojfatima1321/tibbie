// ---- Core data model ----

export type TaskStatus = 'not_started' | 'in_progress' | 'at_risk' | 'done'

export interface Project {
  id: string
  name: string
  description: string
  startDate: string  // ISO date "YYYY-MM-DD"
  endDate: string
  color: string      // hex
  createdAt: string  // ISO timestamp
  updatedAt: string
}

export interface Member {
  id: string
  name: string
  email?: string
  color: string      // hex, for avatar background
  createdAt: string
}

export interface Task {
  id: string
  projectId: string
  name: string
  notes: string
  startDate: string
  endDate: string
  status: TaskStatus
  percentComplete: number  // 0-100
  isMilestone: boolean
  assigneeIds: string[]
  // recurring
  recurring: null | {
    interval: 'daily' | 'weekly' | 'monthly'
    until?: string  // ISO date
  }
  createdAt: string
  updatedAt: string
}

export interface Dependency {
  predecessorId: string
  successorId: string
}

export interface TibbieData {
  projects: Project[]
  members: Member[]
  tasks: Task[]
  dependencies: Dependency[]
  version: number
}

// ---- UI state ----

export type ZoomLevel = 'day' | 'week' | 'month'

export type GroupBy = 'project' | 'assignee' | 'none'

export interface Filters {
  projectIds: string[]
  statuses: TaskStatus[]
  memberIds: string[]
  dateRange: { start: string | null; end: string | null }
}

export interface SearchResult {
  type: 'project' | 'task' | 'member'
  id: string
  label: string
  sublabel?: string
  matchField?: 'name' | 'notes' | 'description' | 'email'
  projectId?: string
}
