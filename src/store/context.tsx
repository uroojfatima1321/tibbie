import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, useSyncExternalStore } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  TibbieData, Project, Task, Member, Holiday, ProjectUpdate, UpdateSignal,
  PhaseTemplate, ProjectPhase, PhaseStatus,
  Filters, GroupBy, ZoomLevel,
  ProjectV2, FeatureV2, ModuleV2, ProjectStatus, FeatureStatus, StatusLogEntry, DecisionEntry, Milestone, DepartmentTrack, TrackKind, RiceScore, WsjfScore, MustDoTag,
  DeletionLogEntry, ActivityEntry, ActivityTag,
} from '../types'
import { adapter, isLocalMode, subscribeLocalMode, popConflictDetected, getLoadDiagnostic, type LoadDiagnostic } from '../api/adapter'
import { api, getSessionPin, setSessionPin, clearSessionPin } from '../api/client'
import { buildSeedData, buildDemoData } from '../lib/seed'
import { uid, nextProjectColor, nextMemberColor } from '../lib/util'
import { migrate } from '../lib/migrate'
import { buildRankedIds, DELIVERY_EXCLUDED_STATUSES } from '../lib/rank'
import { validateConsistency, selfHeal } from '../lib/consistency'

interface ToastMsg { id: string; kind: 'info' | 'error' | 'success'; text: string; count?: number }

interface Ctx {
  data: TibbieData | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  refresh: () => void

  editMode: boolean
  pinConfigured: boolean | null
  unlock: (pin: string) => Promise<boolean>
  lock: () => void
  setupPin: (pin: string) => Promise<boolean>
  rotatePin: (newPin: string) => Promise<boolean>

  addProject:  (input: { name: string; description: string; startDate: string; endDate: string; color?: string }) => Promise<Project>
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  addTask: (input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>

  addMember: (input: { name: string; email?: string; color?: string }) => Promise<Member>
  updateMember: (id: string, patch: Partial<Member>) => Promise<void>
  deleteMember: (id: string) => Promise<void>

  addDependency: (pred: string, succ: string) => Promise<void>
  removeDependency: (pred: string, succ: string) => Promise<void>

  addHoliday: (input: { date: string; name: string; recurring?: 'yearly' | null }) => Promise<Holiday>
  updateHoliday: (id: string, patch: Partial<Holiday>) => Promise<void>
  deleteHoliday: (id: string) => Promise<void>
  loadHolidayPreset: (holidays: Holiday[]) => Promise<void>

  addUpdate: (input: { projectId: string; text: string; signal: UpdateSignal; authorMemberId?: string }) => Promise<ProjectUpdate>
  updateUpdate: (id: string, patch: Partial<ProjectUpdate>) => Promise<void>
  deleteUpdate: (id: string) => Promise<void>

  // Phase library (global templates)
  addPhaseTemplate: (input: { name: string; description?: string; color?: string }) => Promise<PhaseTemplate>
  updatePhaseTemplate: (id: string, patch: Partial<PhaseTemplate>) => Promise<void>
  deletePhaseTemplate: (id: string) => Promise<void>
  loadPhasePresets: (templates: PhaseTemplate[]) => Promise<void>

  // Per-project phases
  addProjectPhase: (input: { projectId: string; templateId: string; order?: number }) => Promise<ProjectPhase>
  updateProjectPhase: (id: string, patch: Partial<ProjectPhase>) => Promise<void>
  deleteProjectPhase: (id: string) => Promise<void>
  reorderProjectPhases: (projectId: string, orderedIds: string[]) => Promise<void>

  seed: () => Promise<void>
  loadDemoData: () => Promise<void>   // loads [DEMO]-prefixed dataset in local mode

  localMode: boolean
  loadDiagnostic: import('../api/adapter').LoadDiagnostic | null

  // ── CR-2 ─────────────────────────────────────────────────────────────────
  deletionLog: DeletionLogEntry[]
  orphanProjectsV2: ProjectV2[]                         // CR-2.1: migration shells eligible for cleanup
  cleanupOrphans: (ids: string[]) => Promise<void>      // CR-2.1
  permanentDeleteProjectV2: (id: string) => Promise<void>    // CR-2.3
  permanentDeleteFeatureV2: (id: string) => Promise<void>    // CR-2.3
  permanentDeleteMany: (projectIds: string[], featureIds: string[]) => Promise<void>  // CR-2.3 bulk
  exportDataJSON: () => void                             // CR-2.5
  importDataJSON: (raw: string) => Promise<void>         // CR-2.5
  setValueRatingBulk: (ids: string[], kind: 'project' | 'feature' | 'module', rating: 1|2|3|4|5|undefined) => Promise<void>
  setStatusBulk: (items: { id: string; kind: 'project'|'feature'|'module'; currentStatus: string }[], status: ProjectStatus | FeatureStatus, reason?: string) => Promise<void>
  moveToPortfolioBulk: (projectIds: string[], portfolio: string) => Promise<void>
  archiveBulkV2: (projectIds: string[], featureIds: string[]) => Promise<void>

  // ── V2 ───────────────────────────────────────────────────────────────────
  projectsV2: ProjectV2[]
  featuresV2: FeatureV2[]
  archivedProjectsV2: ProjectV2[]
  archivedFeaturesV2: FeatureV2[]
  rankedItemIds: string[]      // projects + features ranked together by RICE score; derived, never stored

  userPresets: { name: string; filter: Record<string, unknown> }[]
  saveUserPreset: (name: string, filter: Record<string, unknown>) => Promise<void>
  deleteUserPreset: (name: string) => Promise<void>

  addProjectV2: (input: { name: string; portfolio?: string; oneLiner?: string }) => Promise<ProjectV2>
  updateProjectV2: (id: string, patch: Partial<ProjectV2>) => Promise<void>
  archiveProjectV2: (id: string) => Promise<void>
  restoreProjectV2: (id: string) => Promise<void>
  addProjectV2StatusLog: (id: string, from: ProjectStatus, to: ProjectStatus, note?: string) => Promise<void>
  addProjectV2Decision: (id: string, text: string) => Promise<void>
  addProjectV2Milestone: (id: string, milestone: Omit<Milestone, 'id'>) => Promise<void>
  updateProjectV2Milestone: (projectId: string, milestoneId: string, patch: Partial<Milestone>) => Promise<void>
  addProjectV2Track: (projectId: string, track: DepartmentTrack) => Promise<void>
  updateProjectV2Track: (projectId: string, kind: DepartmentTrack['kind'], patch: Partial<DepartmentTrack>) => Promise<void>
  removeProjectV2Track: (projectId: string, kind: DepartmentTrack['kind']) => Promise<void>

  addFeatureV2: (input: { name: string; projectId?: string | null; moduleId?: string | null; oneLiner?: string; itemType?: 'feature' | 'improvement' }) => Promise<FeatureV2>
  updateFeatureV2: (id: string, patch: Partial<FeatureV2>) => Promise<void>
  moveFeatureV2: (featureId: string, newProjectId: string | null, newModuleId?: string | null) => Promise<void>
  archiveFeatureV2: (id: string) => Promise<void>
  restoreFeatureV2: (id: string) => Promise<void>
  addFeatureV2StatusLog: (id: string, from: FeatureStatus, to: FeatureStatus, note?: string) => Promise<void>
  addFeatureV2Decision: (id: string, text: string) => Promise<void>

  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
  groupBy: GroupBy
  setGroupBy: (g: GroupBy) => void
  zoom: ZoomLevel
  setZoom: (z: ZoomLevel) => void
  myTasksMemberId: string | null
  setMyTasksMemberId: (id: string | null) => void
  searchOpen: boolean
  setSearchOpen: (b: boolean) => void

  activeProjectId: string | null
  setActiveProjectId: (id: string | null) => void

  toasts: ToastMsg[]
  pushToast: (kind: ToastMsg['kind'], text: string) => void
  dismissToast: (id: string) => void

  // ── Phase A: batched-save ─────────────────────────────────────────────────
  isDirty: boolean
  stagedCount: number
  isSaving: boolean
  saveNow: () => Promise<void>

  // ── Phase B+C: framework + Must-Do + clientTimeline ───────────────────────
  framework: 'rice' | 'wsjf'
  setFramework: (fw: 'rice' | 'wsjf') => Promise<void>
  applyMustDo: (id: string, kind: 'project' | 'feature' | 'module', mustDo: MustDoTag | null) => Promise<void>

  // ── Phase D: modules ──────────────────────────────────────────────────────
  modulesV2: ModuleV2[]
  archivedModulesV2: ModuleV2[]
  addModuleV2: (input: { name: string; projectId: string; oneLiner?: string }) => Promise<ModuleV2>
  updateModuleV2: (id: string, patch: Partial<ModuleV2>) => Promise<void>
  archiveModuleV2: (id: string, detachFeatures: boolean) => Promise<void>
  restoreModuleV2: (id: string) => Promise<void>
  permanentDeleteModuleV2: (id: string) => Promise<void>
  addModuleV2StatusLog: (id: string, from: FeatureStatus, to: FeatureStatus, note?: string) => Promise<void>
  addModuleV2Decision: (id: string, text: string) => Promise<void>
  // EXC-1 (M5.1 C): module track mutations (parallel to project track mutations)
  addModuleV2Track: (moduleId: string, track: DepartmentTrack) => Promise<void>
  updateModuleV2Track: (moduleId: string, kind: TrackKind, patch: Partial<DepartmentTrack>) => Promise<void>
  removeModuleV2Track: (moduleId: string, kind: TrackKind) => Promise<void>

  // ── Item 6: Activity Log user notes ──────────────────────────────────────
  addUserNote: (entityId: string, entityKind: 'project' | 'feature' | 'module', text: string, tag?: ActivityTag) => Promise<void>
  taskPulseId: string | null
  setTaskPulseId: (id: string | null) => void

  // ── Fix 9 (R1-H2): crash-draft recovery ──────────────────────────────────
  crashDraftOffer: { savedAt: string; version: number } | null
  acceptCrashDraft: () => void
  dismissCrashDraft: () => void
}

const AppCtx = createContext<Ctx | null>(null)

const emptyFilters: Filters = {
  projectIds: [], statuses: [], memberIds: [],
  dateRange: { start: null, end: null },
}

// migrate() is now imported from ../lib/migrate — removed inline copy

const PHASE_STATUS_LABELS: Record<PhaseStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  skipped: 'Skipped',
}

// Map phase status → which signal to use when auto-posting an update
const PHASE_STATUS_TO_SIGNAL: Record<PhaseStatus, UpdateSignal> = {
  not_started: 'neutral',
  in_progress: 'neutral',
  blocked: 'red',
  done: 'green',
  skipped: 'neutral',
}

// Fix 9 (R1-H2): module-level key so it's available in mutate before crashDraft state is declared
const CRASH_DRAFT_KEY = 'tibbie-crash-draft-v1'

export function AppProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()

  // ── Phase A: batched-save state ────────────────────────────────────────────
  // Declared BEFORE dataQuery so isDirty is available for the refetch guard.
  const [stagedCount, setStagedCount] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = stagedCount > 0
  // Ref copies read synchronously inside queryFn / setTimeout callbacks
  // to avoid stale closure bugs without requiring these values in dep arrays.
  const isDirtyRef = useRef(false)
  isDirtyRef.current = isDirty
  const stagedCountRef = useRef(0)
  stagedCountRef.current = stagedCount

  const dataQuery = useQuery({
    queryKey: ['data'],
    // ── Gap 1 refetch guard ──────────────────────────────────────────────────
    // While dirty, incoming server data MUST NOT clobber staged local state.
    // queryFn returns the existing cache so React Query's onSuccess keeps the
    // local version intact. The network call is skipped entirely.
    // refetchOnWindowFocus/Reconnect are disabled reactively as a belt; the
    // queryFn guard is the suspenders (catches any in-flight refetch race).
    queryFn: async () => {
      if (isDirtyRef.current) {
        const cached = qc.getQueryData<TibbieData>(['data'])
        if (cached) return cached   // preserve staged mutations; skip network
      }
      return migrate(await adapter.load())!
    },
    refetchOnWindowFocus: !isDirty,   // disabled while dirty (reactive per render)
    refetchOnReconnect:   !isDirty,   // same
  })

  const [editMode, setEditMode] = useState<boolean>(() => !!getSessionPin())
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    api.pinStatus()
      .then(s => setPinConfigured(s.configured))
      .catch(() => setPinConfigured(null))
  }, [])

  const unlock = useCallback(async (pin: string) => {
    try {
      const r = await api.pinVerify(pin)
      if (r.ok) { setSessionPin(pin); setEditMode(true); return true }
      return false
    } catch { return false }
  }, [])

  const lock = useCallback(() => { clearSessionPin(); setEditMode(false) }, [])

  const setupPin = useCallback(async (pin: string) => {
    try {
      await api.pinSetup(pin)
      setPinConfigured(true)
      setSessionPin(pin)
      setEditMode(true)
      return true
    } catch { return false }
  }, [])

  const rotatePin = useCallback(async (newPin: string) => {
    try { await api.pinRotate(newPin); setSessionPin(newPin); return true }
    catch { return false }
  }, [])

  const saveMutation = useMutation({
    // Fix 5 (R2-H1): onSuccess removed — it was overwriting the live cache with
    // the pre-flight snapshot, reverting any mutations made during the in-flight save.
    // The cache already contains all staged mutations and must not be clobbered.
    mutationFn: async (data: TibbieData) => { await adapter.save(data); return data },
  })

  // ── Write-storm circuit breaker — Fix 6 (R2-M5/R1-M6) ────────────────────
  // Counts only dispatched writes. Auto-resets 60s after trip so the user is
  // never permanently locked out of their staged work.
  const cbRef = useRef({ count: 0, windowStart: Date.now(), tripped: false, tripTime: 0 })
  const pushToastRef = useRef<((k: ToastMsg['kind'], t: string) => void) | null>(null)

  function checkWriteAllowed(): boolean {
    const cb = cbRef.current
    const now = Date.now()
    // Auto-reset: trip lifts after 60 s
    if (cb.tripped && now - cb.tripTime > 60_000) {
      cb.tripped = false; cb.count = 0; cb.windowStart = now
      pushToastRef.current?.('info', 'Write limiter reset — saves re-enabled.')
    }
    if (cb.tripped) {
      console.error('[Tibbie circuit-breaker] write blocked — auto-resets in', Math.ceil((cb.tripTime + 60_000 - now) / 1000), 's')
      return false
    }
    if (now - cb.windowStart > 10_000) { cb.count = 0; cb.windowStart = now }
    cb.count++  // count only dispatched (not blocked) writes
    if (cb.count > 5) {
      cb.tripped = true; cb.tripTime = now
      console.error('[Tibbie circuit-breaker] WRITE STORM — >5 writes in 10 s. Auto-resets in 60 s.', new Error().stack)
      pushToastRef.current?.('error', 'Write storm detected — saves paused for 60 s')
      return false
    }
    return true
  }

  // Fix 9: crash draft refs — hoisted here so mutate can use them
  const crashDraftDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Phase A: mutate stages locally — no KV write. Fix 9: debounced crash-draft mirror.
  const mutate = useCallback(async (mutator: (d: TibbieData) => TibbieData) => {
    const current = qc.getQueryData<TibbieData>(['data'])
    if (!current) throw new Error('Data not loaded')
    const next = { ...mutator(current), version: (current.version ?? 0) + 1 }
    qc.setQueryData(['data'], next)
    setStagedCount(n => n + 1)
    // Fix 9 (R1-H2): crash-draft mirror — debounced 2 s to avoid per-keystroke writes
    if (crashDraftDebounceRef.current) clearTimeout(crashDraftDebounceRef.current)
    crashDraftDebounceRef.current = setTimeout(() => {
      try { localStorage.setItem(CRASH_DRAFT_KEY, JSON.stringify({ data: next, savedAt: new Date().toISOString() })) }
      catch { /* quota exceeded or private mode — silently ignore */ }
    }, 2000)
  }, [qc])

  // ── saveNow: the ONE path that writes to KV ──────────────────────────────
  // Circuit breaker lives here now — it gates actual KV writes, not local mutations.
  // Adapter seal preserved: adapter.save() is still the only write path, called
  // via saveMutation (unchanged). We just call it less often.
  const saveNow = useCallback(async () => {
    if (!checkWriteAllowed()) return
    const current = qc.getQueryData<TibbieData>(['data'])
    if (!current) return
    // Fix 5 (R2-H1): capture count BEFORE the async save.
    // On success, subtract exactly that many — mutations arriving during the
    // in-flight save are not erroneously cleared.
    const capturedCount = stagedCountRef.current
    setIsSaving(true)
    try {
      await saveMutation.mutateAsync(current)
      // Subtractive: c - captured, floor at 0 (never go negative)
      setStagedCount(c => Math.max(0, c - capturedCount))
      // Fix 9: clear crash draft after successful save (work is safe on server)
      try { localStorage.removeItem(CRASH_DRAFT_KEY) } catch {}
      if (crashDraftDebounceRef.current) { clearTimeout(crashDraftDebounceRef.current); crashDraftDebounceRef.current = null }
      pushToastRef.current?.('success', 'Saved')
    } catch (e) {
      // State stays dirty — beforeunload stays armed
      pushToastRef.current?.('error', e instanceof Error ? e.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [qc, saveMutation])

  // ── Idle nudge (not autosave) ─────────────────────────────────────────────
  // Fires once, 10 minutes after first going dirty. Clears if user saves first.
  const idleNudgeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (isDirty && idleNudgeRef.current === null) {
      idleNudgeRef.current = setTimeout(() => {
        const n = stagedCountRef.current
        pushToastRef.current?.('info',
          `You have ${n} unsaved change${n !== 1 ? 's' : ''}. Click Save to persist them.`
        )
        idleNudgeRef.current = null
      }, 10 * 60 * 1000)
    }
    if (!isDirty && idleNudgeRef.current !== null) {
      clearTimeout(idleNudgeRef.current)
      idleNudgeRef.current = null
    }
  }, [isDirty])

  // ── beforeunload guard ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''   // required by Chrome/Edge
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const pushToast = useCallback((kind: ToastMsg['kind'], text: string) => {    setToasts(ts => {
      // Coalesce: increment count on an existing identical toast instead of adding a new one
      const existingIdx = ts.findIndex(t => t.kind === kind && t.text === text)
      if (existingIdx >= 0) {
        const updated = [...ts]
        const existing = updated[existingIdx]
        updated[existingIdx] = { ...existing, count: (existing.count ?? 1) + 1 }
        // Reset auto-dismiss timer
        const timerId = toastTimers.current.get(existing.id)
        if (timerId) clearTimeout(timerId)
        const newTimer = setTimeout(() =>
          setToasts(prev => prev.filter(t => t.id !== existing.id)), 4000)
        toastTimers.current.set(existing.id, newTimer)
        return updated
      }
      // Max 3 toasts — drop oldest if needed
      const trimmed = ts.length >= 3 ? ts.slice(ts.length - 2) : ts
      const id = uid('toast')
      const timer = setTimeout(() =>
        setToasts(prev => prev.filter(t => t.id !== id)), 4000)
      toastTimers.current.set(id, timer)
      return [...trimmed, { id, kind, text, count: 1 }]
    })
  }, [])
  // Late-bind pushToast into the circuit breaker (defined earlier, before pushToast)
  pushToastRef.current = pushToast
  const dismissToast = useCallback((id: string) => setToasts(ts => ts.filter(t => t.id !== id)), [])

  const wrap = useCallback(async <T,>(fn: () => Promise<T>, successMsg?: string): Promise<T> => {
    try {
      const r = await fn()
      if (successMsg) pushToast('success', successMsg)
      return r
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Something went wrong')
      throw e
    }
  }, [pushToast])

  // ---- Projects / Tasks / Members / Dependencies ----

  const addProject: Ctx['addProject'] = useCallback((input) => wrap(async () => {
    const now = new Date().toISOString()
    const used = (qc.getQueryData<TibbieData>(['data'])?.projects || []).map(p => p.color)
    const project: Project = {
      id: uid('prj'),
      name: input.name, description: input.description,
      startDate: input.startDate, endDate: input.endDate,
      color: input.color || nextProjectColor(used),
      createdAt: now, updatedAt: now,
    }
    await mutate(d => ({ ...d, projects: [...d.projects, project] }))
    return project
  }, 'Project added'), [mutate, qc, wrap])

  const updateProject: Ctx['updateProject'] = useCallback((id, patch) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projects: d.projects.map(p => p.id === id
        ? { ...p, ...patch, updatedAt: new Date().toISOString() }
        : p),
    }))
  }), [mutate, wrap])

  const deleteProject: Ctx['deleteProject'] = useCallback((id) => wrap(async () => {
    await mutate(d => {
      const taskIds = new Set(d.tasks.filter(t => t.projectId === id).map(t => t.id))
      return {
        ...d,
        projects: d.projects.filter(p => p.id !== id),
        tasks: d.tasks.filter(t => t.projectId !== id),
        dependencies: d.dependencies.filter(dep => !taskIds.has(dep.predecessorId) && !taskIds.has(dep.successorId)),
        updates: d.updates.filter(u => u.projectId !== id),
        projectPhases: d.projectPhases.filter(p => p.projectId !== id),
      }
    })
  }, 'Project deleted'), [mutate, wrap])

  const addTask: Ctx['addTask'] = useCallback((input) => wrap(async () => {
    const now = new Date().toISOString()
    const task: Task = { id: uid('tsk'), ...input, createdAt: now, updatedAt: now }
    await mutate(d => ({ ...d, tasks: [...d.tasks, task] }))
    return task
  }, 'Task added'), [mutate, wrap])

  const updateTask: Ctx['updateTask'] = useCallback((id, patch) => wrap(async () => {
    await mutate(d => ({
      ...d,
      tasks: d.tasks.map(t => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t),
    }))
  }), [mutate, wrap])

  const deleteTask: Ctx['deleteTask'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({
      ...d,
      tasks: d.tasks.filter(t => t.id !== id),
      dependencies: d.dependencies.filter(dep => dep.predecessorId !== id && dep.successorId !== id),
    }))
  }, 'Task deleted'), [mutate, wrap])

  const addMember: Ctx['addMember'] = useCallback((input) => wrap(async () => {
    const used = (qc.getQueryData<TibbieData>(['data'])?.members || []).map(m => m.color)
    const member: Member = {
      id: uid('mem'),
      name: input.name, email: input.email,
      color: input.color || nextMemberColor(used),
      createdAt: new Date().toISOString(),
    }
    await mutate(d => ({ ...d, members: [...d.members, member] }))
    return member
  }, 'Member added'), [mutate, qc, wrap])

  const updateMember: Ctx['updateMember'] = useCallback((id, patch) => wrap(async () => {
    await mutate(d => ({
      ...d,
      members: d.members.map(m => m.id === id ? { ...m, ...patch } : m),
    }))
  }), [mutate, wrap])

  const deleteMember: Ctx['deleteMember'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({
      ...d,
      members: d.members.filter(m => m.id !== id),
      tasks: d.tasks.map(t => ({ ...t, assigneeIds: t.assigneeIds.filter(a => a !== id) })),
    }))
  }, 'Member removed'), [mutate, wrap])

  const addDependency: Ctx['addDependency'] = useCallback((pred, succ) => wrap(async () => {
    if (pred === succ) return
    await mutate(d => {
      if (d.dependencies.some(x => x.predecessorId === pred && x.successorId === succ)) return d
      return { ...d, dependencies: [...d.dependencies, { predecessorId: pred, successorId: succ }] }
    })
  }), [mutate, wrap])

  const removeDependency: Ctx['removeDependency'] = useCallback((pred, succ) => wrap(async () => {
    await mutate(d => ({
      ...d,
      dependencies: d.dependencies.filter(x => !(x.predecessorId === pred && x.successorId === succ)),
    }))
  }), [mutate, wrap])

  // ---- Holidays ----

  const addHoliday: Ctx['addHoliday'] = useCallback((input) => wrap(async () => {
    const now = new Date().toISOString()
    const holiday: Holiday = { id: uid('hol'), date: input.date, name: input.name, recurring: input.recurring ?? null, createdAt: now }
    await mutate(d => ({ ...d, holidays: [...d.holidays, holiday] }))
    return holiday
  }, 'Holiday added'), [mutate, wrap])

  const updateHoliday: Ctx['updateHoliday'] = useCallback((id, patch) => wrap(async () => {
    await mutate(d => ({ ...d, holidays: d.holidays.map(h => h.id === id ? { ...h, ...patch } : h) }))
  }), [mutate, wrap])

  const deleteHoliday: Ctx['deleteHoliday'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({ ...d, holidays: d.holidays.filter(h => h.id !== id) }))
  }, 'Holiday removed'), [mutate, wrap])

  const loadHolidayPreset: Ctx['loadHolidayPreset'] = useCallback((holidays) => wrap(async () => {
    await mutate(d => {
      const existingDates = new Set(d.holidays.map(h => `${h.date}|${h.name}`))
      const toAdd = holidays.filter(h => !existingDates.has(`${h.date}|${h.name}`))
      return { ...d, holidays: [...d.holidays, ...toAdd] }
    })
  }, 'Holiday preset loaded'), [mutate, wrap])

  // ---- Project updates ----

  const addUpdate: Ctx['addUpdate'] = useCallback((input) => wrap(async () => {
    const now = new Date().toISOString()
    const update: ProjectUpdate = {
      id: uid('upd'),
      projectId: input.projectId,
      text: input.text,
      signal: input.signal,
      authorMemberId: input.authorMemberId,
      createdAt: now,
    }
    await mutate(d => ({ ...d, updates: [...d.updates, update] }))
    return update
  }, 'Update posted'), [mutate, wrap])

  const updateUpdate: Ctx['updateUpdate'] = useCallback((id, patch) => wrap(async () => {
    await mutate(d => ({ ...d, updates: d.updates.map(u => u.id === id ? { ...u, ...patch } : u) }))
  }), [mutate, wrap])

  const deleteUpdate: Ctx['deleteUpdate'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({ ...d, updates: d.updates.filter(u => u.id !== id) }))
  }, 'Update deleted'), [mutate, wrap])

  // ---- Phase library ----

  const addPhaseTemplate: Ctx['addPhaseTemplate'] = useCallback((input) => wrap(async () => {
    const now = new Date().toISOString()
    const tpl: PhaseTemplate = {
      id: uid('pht'),
      name: input.name,
      description: input.description,
      color: input.color || '#7B4A6E',
      createdAt: now,
    }
    await mutate(d => ({ ...d, phaseTemplates: [...d.phaseTemplates, tpl] }))
    return tpl
  }, 'Phase added to library'), [mutate, wrap])

  const updatePhaseTemplate: Ctx['updatePhaseTemplate'] = useCallback((id, patch) => wrap(async () => {
    await mutate(d => ({
      ...d,
      phaseTemplates: d.phaseTemplates.map(t => t.id === id ? { ...t, ...patch } : t),
    }))
  }), [mutate, wrap])

  const deletePhaseTemplate: Ctx['deletePhaseTemplate'] = useCallback((id) => wrap(async () => {
    // Also cascade: remove any project phases using this template
    await mutate(d => ({
      ...d,
      phaseTemplates: d.phaseTemplates.filter(t => t.id !== id),
      projectPhases: d.projectPhases.filter(p => p.templateId !== id),
    }))
  }, 'Phase removed from library'), [mutate, wrap])

  const loadPhasePresets: Ctx['loadPhasePresets'] = useCallback((templates) => wrap(async () => {
    await mutate(d => {
      const existing = new Set(d.phaseTemplates.map(t => t.name.toLowerCase()))
      const toAdd = templates.filter(t => !existing.has(t.name.toLowerCase()))
      return { ...d, phaseTemplates: [...d.phaseTemplates, ...toAdd] }
    })
  }, 'Phase library loaded'), [mutate, wrap])

  // ---- Project phases ----

  const addProjectPhase: Ctx['addProjectPhase'] = useCallback((input) => wrap(async () => {
    const now = new Date().toISOString()
    const current = qc.getQueryData<TibbieData>(['data'])
    const existing = current?.projectPhases.filter(p => p.projectId === input.projectId) || []
    const nextOrder = input.order ?? (existing.length > 0
      ? Math.max(...existing.map(p => p.order)) + 1
      : 0)
    const phase: ProjectPhase = {
      id: uid('pph'),
      projectId: input.projectId,
      templateId: input.templateId,
      order: nextOrder,
      status: 'not_started',
      createdAt: now,
    }
    await mutate(d => ({ ...d, projectPhases: [...d.projectPhases, phase] }))
    return phase
  }), [mutate, qc, wrap])

  const updateProjectPhase: Ctx['updateProjectPhase'] = useCallback((id, patch) => wrap(async () => {
    const current = qc.getQueryData<TibbieData>(['data'])
    const existing = current?.projectPhases.find(p => p.id === id)
    if (!existing) return

    const now = new Date().toISOString()
    let finalPatch = { ...patch }
    let autoUpdateText: string | null = null
    let autoUpdateSignal: UpdateSignal = 'neutral'

    // Auto-fill dates on status transitions
    if (patch.status && patch.status !== existing.status) {
      // Transitioning INTO in_progress sets startedAt (if not already set)
      if (patch.status === 'in_progress' && !existing.startedAt && !patch.startedAt) {
        finalPatch.startedAt = now
      }
      // Transitioning INTO done sets completedAt (if not already set)
      if (patch.status === 'done' && !existing.completedAt && !patch.completedAt) {
        finalPatch.completedAt = now
      }
      // Generate auto status update on meaningful transitions
      const template = current?.phaseTemplates.find(t => t.id === existing.templateId)
      if (template) {
        autoUpdateText = `Phase "${template.name}" → ${PHASE_STATUS_LABELS[patch.status]}`
        autoUpdateSignal = PHASE_STATUS_TO_SIGNAL[patch.status]
      }
    }

    await mutate(d => {
      const updated: TibbieData = {
        ...d,
        projectPhases: d.projectPhases.map(p => p.id === id ? { ...p, ...finalPatch } : p),
      }
      if (autoUpdateText) {
        updated.updates = [
          ...d.updates,
          {
            id: uid('upd'),
            projectId: existing.projectId,
            text: autoUpdateText,
            signal: autoUpdateSignal,
            createdAt: now,
            autoGenerated: true,
          },
        ]
      }
      return updated
    })
  }), [mutate, qc, wrap])

  const deleteProjectPhase: Ctx['deleteProjectPhase'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({ ...d, projectPhases: d.projectPhases.filter(p => p.id !== id) }))
  }, 'Phase removed from project'), [mutate, wrap])

  const reorderProjectPhases: Ctx['reorderProjectPhases'] = useCallback((projectId, orderedIds) => wrap(async () => {
    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]))
    await mutate(d => ({
      ...d,
      projectPhases: d.projectPhases.map(p =>
        p.projectId === projectId && orderMap.has(p.id)
          ? { ...p, order: orderMap.get(p.id)! }
          : p,
      ),
    }))
  }), [mutate, wrap])

  // Item 6: append an activity entry to any V2 entity
  function appendActivity(entity: any, entry: import('../types').ActivityEntry): any {
    const log = Array.isArray(entity.activityLog) ? entity.activityLog : []
    return { ...entity, activityLog: [...log, entry], updatedAt: v2now() }
  }
  const projectsV2 = useMemo(() => (dataQuery.data?.projectsV2 || []).filter(p => !p.archived), [dataQuery.data])
  const featuresV2 = useMemo(() => (dataQuery.data?.featuresV2 || []).filter(f => !f.archived), [dataQuery.data])
  const modulesV2  = useMemo(() => (dataQuery.data?.modulesV2  || []).filter(m => !m.archived), [dataQuery.data])

  // Active scoring framework — read from persisted workspaceSettings
  const framework = (dataQuery.data?.workspaceSettings?.framework ?? 'rice') as 'rice' | 'wsjf'

  // F: uses buildRankedIds from rank.ts, which now uses DELIVERY_EXCLUDED_STATUSES (in-delivery + live)
  const rankedItemIds = useMemo<string[]>(() =>
    buildRankedIds([...projectsV2, ...featuresV2, ...modulesV2], framework)
  , [projectsV2, featuresV2, modulesV2, framework])

  const archivedProjectsV2 = useMemo(() => (dataQuery.data?.projectsV2 || []).filter(p => p.archived), [dataQuery.data])
  const archivedFeaturesV2 = useMemo(() => (dataQuery.data?.featuresV2 || []).filter(f => f.archived), [dataQuery.data])
  const archivedModulesV2  = useMemo(() => (dataQuery.data?.modulesV2  || []).filter(m => m.archived), [dataQuery.data])
  const userPresets = useMemo(() => dataQuery.data?.userPresets || [], [dataQuery.data])

  // Fix 3 (R2-H4): localMode is now reactive via useSyncExternalStore.
  // subscribeLocalMode/isLocalMode wired to the adapter's internal notification system.
  // This ensures the offline banner and context memo update reliably on both
  // connection loss and reconnect without a page reload.
  const localMode = useSyncExternalStore(subscribeLocalMode, isLocalMode, isLocalMode)
  const loadDiagnostic = getLoadDiagnostic()

  // ── Fix 7 (R2-H3): consistency validation on load — self-heal orphans ────
  const selfHealVersionRef = useRef<number>(-1)
  useEffect(() => {
    if (!dataQuery.data) return
    const v = dataQuery.data.version ?? 0
    if (selfHealVersionRef.current === v) return  // already processed this version
    const issues = validateConsistency(dataQuery.data)
    if (issues.length === 0) { selfHealVersionRef.current = v; return }
    console.warn('[Tibbie consistency] Self-healing', issues.length, 'issue(s):', issues.map(i => i.detail))
    selfHealVersionRef.current = v + 1  // next version will be healed
    // Write healed data directly to cache (not a user mutation — repair only)
    qc.setQueryData(['data'], selfHeal(dataQuery.data))
    pushToastRef.current?.('info', `Auto-corrected ${issues.length} data inconsistency${issues.length > 1 ? 'ies' : 'y'}.`)
  }, [dataQuery.data?.version])

  // ── Edge case #9: conflict detection toast ────────────────────────────────
  useEffect(() => {
    if (dataQuery.data && popConflictDetected()) {
      pushToast('error', '⚠ Data was modified in another session — your recent changes may have been overwritten. Refresh to see latest.')
    }
  }, [dataQuery.data?.version])

  // ── Fix 9 (R1-H2): crash-draft recovery ──────────────────────────────────
  const CRASH_DRAFT_KEY = 'tibbie-crash-draft-v1'
  const [crashDraftOffer, setCrashDraftOffer] = useState<{ savedAt: string; version: number } | null>(null)
  const crashDraftCheckedRef = useRef(false)
  // Item 5: task pulse highlight for Gantt jump
  const [taskPulseId, setTaskPulseId] = useState<string | null>(null)

  // Check for crash draft after initial load
  useEffect(() => {
    if (crashDraftCheckedRef.current || dataQuery.isLoading || !dataQuery.data) return
    crashDraftCheckedRef.current = true
    try {
      const raw = localStorage.getItem(CRASH_DRAFT_KEY)
      if (!raw) return
      const { data: draftData, savedAt } = JSON.parse(raw) as { data: TibbieData; savedAt: string }
      const ageMs = Date.now() - new Date(savedAt).getTime()
      if (ageMs > 24 * 60 * 60 * 1000) { localStorage.removeItem(CRASH_DRAFT_KEY); return }
      if ((draftData.version ?? 0) <= (dataQuery.data.version ?? 0)) {
        localStorage.removeItem(CRASH_DRAFT_KEY); return
      }
      setCrashDraftOffer({ savedAt, version: draftData.version ?? 0 })
    } catch { /* localStorage unavailable or corrupted — ignore */ }
  }, [dataQuery.isLoading, dataQuery.data?.version])

  const acceptCrashDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(CRASH_DRAFT_KEY)
      if (!raw) { setCrashDraftOffer(null); return }
      const { data: draftData } = JSON.parse(raw) as { data: TibbieData; savedAt: string }
      const migrated = migrate(draftData)
      if (migrated) {
        qc.setQueryData(['data'], migrated)
        setStagedCount(c => c + 1)
      }
      localStorage.removeItem(CRASH_DRAFT_KEY)
      setCrashDraftOffer(null)
      pushToastRef.current?.('success', 'Unsaved changes restored — click Save to keep them.')
    } catch { setCrashDraftOffer(null) }
  }, [qc])

  const dismissCrashDraft = useCallback(() => {
    try { localStorage.removeItem(CRASH_DRAFT_KEY) } catch {}
    setCrashDraftOffer(null)
  }, [])

  // ── CR-2 derived state ────────────────────────────────────────────────────
  const deletionLog = useMemo(() => dataQuery.data?.deletionLog || [], [dataQuery.data])

  /** Eligible orphans: migration-generated ID, no features, no RICE, no tracks,
   *  ≤1 status log entry (just the "Created" one), no decisions. */
  const orphanProjectsV2 = useMemo(() =>
    (dataQuery.data?.projectsV2 || []).filter(p =>
      p.id.startsWith('v2-') &&
      p.featureIds.length === 0 &&
      p.rice == null &&
      p.tracks.length === 0 &&
      p.statusLog.length <= 1 &&
      p.decisionLog.length === 0
    )
  , [dataQuery.data])

  // ── CR-2.1: Orphan cleanup ────────────────────────────────────────────────
  const cleanupOrphans: Ctx['cleanupOrphans'] = useCallback((ids) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).filter(p => !ids.includes(p.id)),
    }))
  }, `Removed ${ids.length} migrated placeholder${ids.length > 1 ? 's' : ''}`), [mutate, wrap])

  // ── CR-2.3: Permanent delete ──────────────────────────────────────────────
  function makeDeletionEntry(id: string, name: string, kind: DeletionLogEntry['kind']): DeletionLogEntry {
    return { id, name, kind, deletedAt: new Date().toISOString() }
  }

  const permanentDeleteProjectV2: Ctx['permanentDeleteProjectV2'] = useCallback((id) => wrap(async () => {
    const project = (dataQuery.data?.projectsV2 || []).find(p => p.id === id)
    if (!project) return
    // Fix 7 (R2-H3): cascade — delete project's modules, detach their features
    const projectModules = (dataQuery.data?.modulesV2 || []).filter(m => m.projectId === id)
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).filter(p => p.id !== id),
      // Features that had this project move to Backlog; also clear any module reference
      featuresV2: (d.featuresV2 || []).map(f =>
        f.projectId === id ? { ...f, projectId: null, moduleId: null, updatedAt: v2now() } : f
      ),
      // Modules belonging to this project are deleted (R2-H3 cascade)
      modulesV2: (d.modulesV2 || []).filter(m => m.projectId !== id),
      // Null out moduleId on features that belonged to this project's modules (already handled above)
      deletionLog: [...(d.deletionLog || []),
        makeDeletionEntry(id, project.name, 'project'),
        // Fix 11 (R2-L1): log module deletions
        ...projectModules.map(m => makeDeletionEntry(m.id, m.name, 'module')),
      ],
    }))
  }, 'Permanently deleted'), [mutate, wrap, dataQuery.data])

  const permanentDeleteFeatureV2: Ctx['permanentDeleteFeatureV2'] = useCallback((id) => wrap(async () => {
    const feature = (dataQuery.data?.featuresV2 || []).find(f => f.id === id)
    if (!feature) return
    await mutate(d => ({
      ...d,
      featuresV2: (d.featuresV2 || []).filter(f => f.id !== id),
      projectsV2: (d.projectsV2 || []).map(p => ({
        ...p, featureIds: p.featureIds.filter(fid => fid !== id)
      })),
      deletionLog: [...(d.deletionLog || []), makeDeletionEntry(id, feature.name, 'feature')],
    }))
  }, 'Permanently deleted'), [mutate, wrap, dataQuery.data])

  const permanentDeleteMany: Ctx['permanentDeleteMany'] = useCallback((projectIds, featureIds) => wrap(async () => {
    const allProjects = dataQuery.data?.projectsV2 || []
    const allFeatures = dataQuery.data?.featuresV2 || []
    const allModules  = dataQuery.data?.modulesV2  || []
    // Fix 7: collect modules belonging to deleted projects (cascade delete)
    const cascadedModules = allModules.filter(m => projectIds.includes(m.projectId))
    const newEntries: DeletionLogEntry[] = [
      ...projectIds.map(id => makeDeletionEntry(id, allProjects.find(p => p.id === id)?.name ?? id, 'project')),
      ...featureIds.map(id => makeDeletionEntry(id, allFeatures.find(f => f.id === id)?.name ?? id, 'feature')),
      ...cascadedModules.map(m => makeDeletionEntry(m.id, m.name, 'module')),
    ]
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).filter(p => !projectIds.includes(p.id)),
      featuresV2: (d.featuresV2 || [])
        .filter(f => !featureIds.includes(f.id))
        .map(f => projectIds.includes(f.projectId ?? '') ? { ...f, projectId: null, moduleId: null, updatedAt: v2now() } : f),
      modulesV2: (d.modulesV2 || []).filter(m => !projectIds.includes(m.projectId)),
      deletionLog: [...(d.deletionLog || []), ...newEntries],
    }))
  }, 'Permanently deleted'), [mutate, wrap, dataQuery.data])

  // ── CR-2.2: V2 card bulk ops ──────────────────────────────────────────────
  const archiveBulkV2: Ctx['archiveBulkV2'] = useCallback((projectIds, featureIds) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p => projectIds.includes(p.id) ? { ...p, archived: true, updatedAt: v2now() } : p),
      featuresV2: (d.featuresV2 || []).map(f => featureIds.includes(f.id) ? { ...f, archived: true, updatedAt: v2now() } : f),
    }))
  }, 'Archived'), [mutate, wrap])

  const setStatusBulk: Ctx['setStatusBulk'] = useCallback((items, status, reason) => wrap(async () => {
    await mutate(d => {
      let pV2 = [...(d.projectsV2 || [])]
      let fV2 = [...(d.featuresV2 || [])]
      let mV2 = [...(d.modulesV2  || [])]
      const now = v2now()
      for (const item of items) {
        const entry: StatusLogEntry = { id: v2id(), from: item.currentStatus, to: status, at: now }
        const patch: any = { status, updatedAt: now }
        if (status === 'on_hold' && reason) patch.holdReason = reason
        if (status === 'killed' && reason) patch.killReason = reason
        if (item.kind === 'project') {
          pV2 = pV2.map(p => p.id === item.id ? { ...p, ...patch, statusLog: [...p.statusLog, entry] } : p)
        } else if (item.kind === 'module') {
          mV2 = mV2.map(m => m.id === item.id ? { ...m, ...patch, statusLog: [...m.statusLog, entry] } : m)
        } else {
          fV2 = fV2.map(f => f.id === item.id ? { ...f, ...patch, statusLog: [...f.statusLog, entry] } : f)
        }
      }
      return { ...d, projectsV2: pV2, featuresV2: fV2, modulesV2: mV2 }
    })
  }), [mutate, wrap])

  const moveToPortfolioBulk: Ctx['moveToPortfolioBulk'] = useCallback((projectIds, portfolio) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p => projectIds.includes(p.id) ? { ...p, portfolio, updatedAt: v2now() } : p),
    }))
  }), [mutate, wrap])

  const setValueRatingBulk: Ctx['setValueRatingBulk'] = useCallback((ids, kind, rating) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: kind === 'project' ? (d.projectsV2 || []).map(p => ids.includes(p.id) ? { ...p, valueRating: rating, updatedAt: v2now() } : p) : d.projectsV2,
      featuresV2: kind === 'feature' ? (d.featuresV2 || []).map(f => ids.includes(f.id) ? { ...f, valueRating: rating, updatedAt: v2now() } : f) : d.featuresV2,
      // Fix 1 (R2-C1): modules are scoreable (value rating included)
      modulesV2:  kind === 'module'  ? (d.modulesV2  || []).map(m => ids.includes(m.id) ? { ...m, valueRating: rating, updatedAt: v2now() } : m) : d.modulesV2,
    }))
  }), [mutate, wrap])

  // ── CR-2.5: Backup / restore ──────────────────────────────────────────────
  const exportDataJSON: Ctx['exportDataJSON'] = useCallback(() => {
    const data = dataQuery.data
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tibbie-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [dataQuery.data])

  const importDataJSON: Ctx['importDataJSON'] = useCallback((raw) => wrap(async () => {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.projects)) throw new Error('Invalid backup: missing projects array')
    const restored = migrate(parsed as TibbieData)
    if (!restored) throw new Error('Invalid backup: migrate returned null')
    // Phase A: import is a full-replacement explicit save — bypasses lazy-save
    // to match the semantics of seed/loadDemoData (dataset wholesale replaced).
    qc.setQueryData(['data'], restored)
    await saveMutation.mutateAsync(restored)
    setStagedCount(0)   // workspace clean after restore
  }, 'Data restored from backup'), [qc, saveMutation, wrap])

  const saveUserPreset: Ctx['saveUserPreset'] = useCallback((name, filter) => wrap(async () => {
    await mutate(d => ({
      ...d,
      userPresets: [
        ...(d.userPresets || []).filter(p => p.name !== name),
        { name, filter },
      ],
    }))
  }), [mutate, wrap])

  const deleteUserPreset: Ctx['deleteUserPreset'] = useCallback((name) => wrap(async () => {
    await mutate(d => ({ ...d, userPresets: (d.userPresets || []).filter(p => p.name !== name) }))
  }), [mutate, wrap])

  // ── V2 helpers ─────────────────────────────────────────────────────────────
  const v2now = () => new Date().toISOString()
  const v2id = () => uid()

  const addProjectV2: Ctx['addProjectV2'] = useCallback((input) => wrap(async () => {
    const now = v2now()
    const p: ProjectV2 = {
      id: v2id(), kind: 'project',
      name: input.name,
      oneLiner: input.oneLiner || '',
      portfolio: input.portfolio || 'Uncategorized',
      status: 'intake',
      ownerIds: [], tags: [], milestones: [], featureIds: [], tracks: [],
      statusLog: [{ id: v2id(), from: '', to: 'intake', at: now, note: 'Created' }],
      decisionLog: [], archived: false,
      order: (dataQuery.data?.projectsV2 || []).length,
      rice: null,
      wsjf: null,
      createdAt: now, updatedAt: now,
    }
    await mutate(d => ({ ...d, projectsV2: [...(d.projectsV2 || []), p] }))
    return p
  }, 'Project created'), [mutate, wrap, dataQuery.data])

  const updateProjectV2: Ctx['updateProjectV2'] = useCallback((id, patch) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p =>
        p.id === id ? { ...p, ...patch, updatedAt: v2now() } : p
      ),
    }))
  }), [mutate, wrap])

  const archiveProjectV2: Ctx['archiveProjectV2'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p => p.id === id ? { ...p, archived: true, updatedAt: v2now() } : p),
      featuresV2: (d.featuresV2 || []).map(f => f.projectId === id ? { ...f, archived: true, updatedAt: v2now() } : f),
    }))
  }, 'Archived'), [mutate, wrap])

  const restoreProjectV2: Ctx['restoreProjectV2'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p =>
        p.id === id ? {
          ...p, archived: false, updatedAt: v2now(),
          statusLog: [...p.statusLog, { id: v2id(), from: p.status, to: p.status, at: v2now(), note: 'Restored from archive' }],
        } : p
      ),
    }))
  }, 'Restored'), [mutate, wrap])

  const addProjectV2StatusLog: Ctx['addProjectV2StatusLog'] = useCallback((id, from, to, note) => wrap(async () => {
    const now = v2now()
    const entry: StatusLogEntry = { id: v2id(), from, to, at: now, note }
    const actEntry: import('../types').ActivityEntry = { id: v2id(), at: now, kind: 'system', text: `Status: ${from || '—'} → ${to}${note ? ` (${note})` : ''}`, systemEventType: 'status_change' }
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p => p.id === id
        ? appendActivity({ ...p, statusLog: [...p.statusLog, entry], status: to }, actEntry)
        : p),
    }))
  }), [mutate, wrap])

  const addProjectV2Decision: Ctx['addProjectV2Decision'] = useCallback((id, text) => wrap(async () => {
    const entry: DecisionEntry = { id: v2id(), text, at: v2now() }
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p => p.id === id ? { ...p, decisionLog: [...p.decisionLog, entry], updatedAt: v2now() } : p),
    }))
  }), [mutate, wrap])

  const addProjectV2Milestone: Ctx['addProjectV2Milestone'] = useCallback((id, ms) => wrap(async () => {
    const milestone: Milestone = { ...ms, id: v2id() }
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p => p.id === id ? { ...p, milestones: [...p.milestones, milestone], updatedAt: v2now() } : p),
    }))
  }), [mutate, wrap])

  const updateProjectV2Milestone: Ctx['updateProjectV2Milestone'] = useCallback((projectId, milestoneId, patch) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p => p.id !== projectId ? p : {
        ...p, updatedAt: v2now(),
        milestones: p.milestones.map(m => {
          if (m.id !== milestoneId) return m
          const updated = { ...m, ...patch }
          // Auto-set moved status if date changed on non-upcoming milestone
          if (patch.date && patch.date !== m.date && m.status !== 'upcoming' && patch.status === undefined) {
            updated.status = 'moved'
            updated.movedFrom = updated.movedFrom || m.date
          }
          return updated
        }),
      }),
    }))
  }), [mutate, wrap])

  const addProjectV2Track: Ctx['addProjectV2Track'] = useCallback((projectId, track) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p => p.id !== projectId ? p : {
        ...p, updatedAt: v2now(),
        tracks: [...p.tracks.filter(t => t.kind !== track.kind), track],
      }),
    }))
  }), [mutate, wrap])

  const updateProjectV2Track: Ctx['updateProjectV2Track'] = useCallback((projectId, kind, patch) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p => p.id !== projectId ? p : {
        ...p, updatedAt: v2now(),
        tracks: p.tracks.map(t => t.kind !== kind ? t : { ...t, ...patch, updatedAt: v2now() }),
      }),
    }))
  }), [mutate, wrap])

  const removeProjectV2Track: Ctx['removeProjectV2Track'] = useCallback((projectId, kind) => wrap(async () => {
    await mutate(d => ({
      ...d,
      projectsV2: (d.projectsV2 || []).map(p => p.id !== projectId ? p : {
        ...p, updatedAt: v2now(),
        tracks: p.tracks.filter(t => t.kind !== kind),
        statusLog: [...p.statusLog, { id: v2id(), from: kind, to: 'removed', at: v2now(), note: `${kind} track removed` }],
      }),
    }))
  }), [mutate, wrap])

  const addFeatureV2: Ctx['addFeatureV2'] = useCallback((input) => wrap(async () => {
    const now = v2now()
    // Fix 8 (R2-M1): validate moduleId and derive projectId from module (authoritative)
    let resolvedProjectId = input.projectId ?? null
    if (input.moduleId) {
      const mod = (dataQuery.data?.modulesV2 || []).find(m => m.id === input.moduleId)
      if (!mod) throw new Error(`Module "${input.moduleId}" not found`)
      if (resolvedProjectId && resolvedProjectId !== mod.projectId) {
        throw new Error(`projectId "${resolvedProjectId}" does not match module's projectId "${mod.projectId}"`)
      }
      resolvedProjectId = mod.projectId  // always authoritative from module
    }
    const f: FeatureV2 = {
      id: v2id(), kind: 'feature',
      name: input.name,
      oneLiner: input.oneLiner || '',
      projectId: resolvedProjectId,
      moduleId: input.moduleId ?? null,
      itemType: input.itemType ?? 'feature',
      status: 'intake',
      rice: null, wsjf: null,
      ownerIds: [], tags: [],
      statusLog: [{ id: v2id(), from: '', to: 'intake', at: now, note: 'Created' }],
      decisionLog: [], archived: false,
      order: (dataQuery.data?.featuresV2 || []).length,
      createdAt: now, updatedAt: now,
    }
    await mutate(d => {
      const updated = { ...d, featuresV2: [...(d.featuresV2 || []), f] }
      if (f.projectId) {
        updated.projectsV2 = (d.projectsV2 || []).map(p =>
          p.id === f.projectId ? { ...p, featureIds: [...p.featureIds, f.id], updatedAt: now } : p
        )
      }
      return updated
    })
    return f
  }, 'Feature created'), [mutate, wrap, dataQuery.data])

  const updateFeatureV2: Ctx['updateFeatureV2'] = useCallback((id, patch) => wrap(async () => {
    await mutate(d => ({
      ...d,
      featuresV2: (d.featuresV2 || []).map(f =>
        f.id === id ? { ...f, ...patch, updatedAt: v2now() } : f
      ),
    }))
  }), [mutate, wrap])

  const moveFeatureV2: Ctx['moveFeatureV2'] = useCallback((featureId, newProjectId, newModuleId) => wrap(async () => {
    await mutate(d => {
      const feature = (d.featuresV2 || []).find(f => f.id === featureId)
      if (!feature) return d
      const oldProjectId = feature.projectId
      return {
        ...d,
        featuresV2: d.featuresV2!.map(f =>
          f.id === featureId
            ? { ...f, projectId: newProjectId, moduleId: newModuleId ?? null, updatedAt: v2now() }
            : f
        ),
        projectsV2: (d.projectsV2 || []).map(p => {
          if (p.id === oldProjectId) return { ...p, featureIds: p.featureIds.filter(id => id !== featureId), updatedAt: v2now() }
          if (p.id === newProjectId) return { ...p, featureIds: [...p.featureIds.filter(id => id !== featureId), featureId], updatedAt: v2now() }
          return p
        }),
      }
    })
  }), [mutate, wrap])

  // ── Phase D: Module mutations ─────────────────────────────────────────────

  const addModuleV2: Ctx['addModuleV2'] = useCallback((input) => wrap(async () => {
    const now = v2now()
    const m: ModuleV2 = {
      id: v2id(), kind: 'module',
      name: input.name,
      oneLiner: input.oneLiner || '',
      projectId: input.projectId,
      status: 'intake',
      ownerIds: [],
      rice: null, wsjf: null,
      milestones: [], tracks: [],   // EXC-1: roadmap fields
      statusLog: [{ id: v2id(), from: '', to: 'intake', at: now, note: 'Created' }],
      decisionLog: [], archived: false,
      createdAt: now, updatedAt: now,
    }
    await mutate(d => ({ ...d, modulesV2: [...(d.modulesV2 || []), m] }))
    return m
  }, 'Module created'), [mutate, wrap])

  const updateModuleV2: Ctx['updateModuleV2'] = useCallback((id, patch) => wrap(async () => {
    await mutate(d => ({
      ...d,
      modulesV2: (d.modulesV2 || []).map(m =>
        m.id === id ? { ...m, ...patch, updatedAt: v2now() } : m
      ),
    }))
  }), [mutate, wrap])

  const archiveModuleV2: Ctx['archiveModuleV2'] = useCallback((id, detachFeatures) => wrap(async () => {
    const now = v2now()
    await mutate(d => ({
      ...d,
      modulesV2: (d.modulesV2 || []).map(m => m.id === id ? { ...m, archived: true, updatedAt: now } : m),
      // Two paths: archive features with module, OR detach to project level
      featuresV2: (d.featuresV2 || []).map(f => {
        if (f.moduleId !== id) return f
        if (detachFeatures) return { ...f, moduleId: null, updatedAt: now }  // detach
        return { ...f, archived: true, updatedAt: now }                       // archive together
      }),
    }))
  }, 'Module archived'), [mutate, wrap])

  const restoreModuleV2: Ctx['restoreModuleV2'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({
      ...d,
      modulesV2: (d.modulesV2 || []).map(m =>
        m.id !== id ? m : {
          ...m, archived: false, updatedAt: v2now(),
          statusLog: [...m.statusLog, { id: v2id(), from: m.status, to: m.status, at: v2now(), note: 'Restored from archive' }],
        }
      ),
    }))
  }, 'Module restored'), [mutate, wrap])

  const permanentDeleteModuleV2: Ctx['permanentDeleteModuleV2'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({
      ...d,
      modulesV2: (d.modulesV2 || []).filter(m => m.id !== id),
      // Detach features to project level (not deleted) — stated in confirm dialog
      featuresV2: (d.featuresV2 || []).map(f =>
        f.moduleId === id ? { ...f, moduleId: null, updatedAt: v2now() } : f
      ),
    }))
  }, 'Module permanently deleted'), [mutate, wrap])

  const addModuleV2StatusLog: Ctx['addModuleV2StatusLog'] = useCallback((id, from, to, note) => wrap(async () => {
    const now = v2now()
    const entry: StatusLogEntry = { id: v2id(), from, to, at: now, note }
    const actEntry: ActivityEntry = { id: v2id(), at: now, kind: 'system', text: `Status: ${from || '—'} → ${to}${note ? ` (${note})` : ''}`, systemEventType: 'status_change' }
    await mutate(d => ({
      ...d,
      modulesV2: (d.modulesV2 || []).map(m =>
        m.id === id ? appendActivity({ ...m, status: to, statusLog: [...m.statusLog, entry] }, actEntry) : m
      ),
    }))
  }), [mutate, wrap])

  const addUserNote: Ctx['addUserNote'] = useCallback((entityId, entityKind, text, tag) => wrap(async () => {
    const entry: ActivityEntry = { id: v2id(), at: v2now(), kind: 'user', text, tag }
    await mutate(d => {
      if (entityKind === 'project') {
        return { ...d, projectsV2: (d.projectsV2 || []).map(p => p.id === entityId ? appendActivity(p, entry) : p) }
      } else if (entityKind === 'module') {
        return { ...d, modulesV2: (d.modulesV2 || []).map(m => m.id === entityId ? appendActivity(m, entry) : m) }
      } else {
        return { ...d, featuresV2: (d.featuresV2 || []).map(f => f.id === entityId ? appendActivity(f, entry) : f) }
      }
    })
  }), [mutate, wrap])

  const addModuleV2Decision: Ctx['addModuleV2Decision'] = useCallback((id, text) => wrap(async () => {
    const entry: DecisionEntry = { id: v2id(), text, at: v2now() }
    await mutate(d => ({
      ...d,
      modulesV2: (d.modulesV2 || []).map(m =>
        m.id === id ? { ...m, decisionLog: [...m.decisionLog, entry], updatedAt: v2now() } : m
      ),
    }))
  }), [mutate, wrap])

  // EXC-1 (M5.1 C): module track mutations — parallel to project track mutations
  const addModuleV2Track: Ctx['addModuleV2Track'] = useCallback((moduleId, track) => wrap(async () => {
    await mutate(d => ({
      ...d,
      modulesV2: (d.modulesV2 || []).map(m =>
        m.id === moduleId
          ? { ...m, tracks: [...(m.tracks || []).filter(t => t.kind !== track.kind), track], updatedAt: v2now() }
          : m
      ),
    }))
  }), [mutate, wrap])

  const updateModuleV2Track: Ctx['updateModuleV2Track'] = useCallback((moduleId, kind, patch) => wrap(async () => {
    await mutate(d => ({
      ...d,
      modulesV2: (d.modulesV2 || []).map(m =>
        m.id === moduleId
          ? { ...m, tracks: (m.tracks || []).map(t => t.kind === kind ? { ...t, ...patch } : t), updatedAt: v2now() }
          : m
      ),
    }))
  }), [mutate, wrap])

  const removeModuleV2Track: Ctx['removeModuleV2Track'] = useCallback((moduleId, kind) => wrap(async () => {
    await mutate(d => ({
      ...d,
      modulesV2: (d.modulesV2 || []).map(m =>
        m.id === moduleId
          ? { ...m, tracks: (m.tracks || []).filter(t => t.kind !== kind), updatedAt: v2now() }
          : m
      ),
    }))
  }), [mutate, wrap])

  const archiveFeatureV2: Ctx['archiveFeatureV2'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({
      ...d,
      featuresV2: (d.featuresV2 || []).map(f => f.id === id ? { ...f, archived: true, updatedAt: v2now() } : f),
    }))
  }, 'Archived'), [mutate, wrap])

  const restoreFeatureV2: Ctx['restoreFeatureV2'] = useCallback((id) => wrap(async () => {
    await mutate(d => ({
      ...d,
      featuresV2: (d.featuresV2 || []).map(f =>
        f.id !== id ? f : {
          ...f, archived: false, updatedAt: v2now(),
          statusLog: [...f.statusLog, { id: v2id(), from: f.status, to: f.status, at: v2now(), note: 'Restored from archive' }],
        }
      ),
    }))
  }, 'Restored'), [mutate, wrap])

  const addFeatureV2StatusLog: Ctx['addFeatureV2StatusLog'] = useCallback((id, from, to, note) => wrap(async () => {
    const now = v2now()
    const entry: StatusLogEntry = { id: v2id(), from, to, at: now, note }
    const actEntry: ActivityEntry = { id: v2id(), at: now, kind: 'system', text: `Status: ${from || '—'} → ${to}${note ? ` (${note})` : ''}`, systemEventType: 'status_change' }
    await mutate(d => ({
      ...d,
      featuresV2: (d.featuresV2 || []).map(f => f.id === id ? appendActivity({ ...f, status: to, statusLog: [...f.statusLog, entry] }, actEntry) : f),
    }))
  }), [mutate, wrap])

  const addFeatureV2Decision: Ctx['addFeatureV2Decision'] = useCallback((id, text) => wrap(async () => {
    const entry: DecisionEntry = { id: v2id(), text, at: v2now() }
    await mutate(d => ({
      ...d,
      featuresV2: (d.featuresV2 || []).map(f => f.id === id ? { ...f, decisionLog: [...f.decisionLog, entry], updatedAt: v2now() } : f),
    }))
  }), [mutate, wrap])

  // ── Phase C: framework setting ────────────────────────────────────────────
  const setFramework: Ctx['setFramework'] = useCallback((fw) => wrap(async () => {
    await mutate(d => ({
      ...d,
      workspaceSettings: { ...(d.workspaceSettings ?? {}), framework: fw },
    }))
  }), [mutate, wrap])

  // ── Phase B+C+D: Must-Do tagging (projects, features, modules) ───────────────
  const applyMustDo: Ctx['applyMustDo'] = useCallback((id, kind, mustDo) => wrap(async () => {
    const now = v2now()
    if (kind === 'project') {
      await mutate(d => ({
        ...d,
        projectsV2: (d.projectsV2 || []).map(p => {
          if (p.id !== id) return p
          if (mustDo === null) {
            const entry: StatusLogEntry = { id: v2id(), from: p.status, to: p.status, at: now, note: 'Must-Do tag removed' }
            return { ...p, mustDo: undefined, statusLog: [...p.statusLog, entry], updatedAt: now }
          }
          return { ...p, mustDo, updatedAt: now }
        }),
      }))
    } else if (kind === 'feature') {
      await mutate(d => ({
        ...d,
        featuresV2: (d.featuresV2 || []).map(f => {
          if (f.id !== id) return f
          if (mustDo === null) {
            const entry: StatusLogEntry = { id: v2id(), from: f.status, to: f.status, at: now, note: 'Must-Do tag removed' }
            return { ...f, mustDo: undefined, statusLog: [...f.statusLog, entry], updatedAt: now }
          }
          return { ...f, mustDo, updatedAt: now }
        }),
      }))
    } else {
      // module
      await mutate(d => ({
        ...d,
        modulesV2: (d.modulesV2 || []).map(m => {
          if (m.id !== id) return m
          if (mustDo === null) {
            const entry: StatusLogEntry = { id: v2id(), from: m.status, to: m.status, at: now, note: 'Must-Do tag removed' }
            return { ...m, mustDo: undefined, statusLog: [...m.statusLog, entry], updatedAt: now }
          }
          return { ...m, mustDo, updatedAt: now }
        }),
      }))
    }
  }, mustDo ? 'Marked Must-Do' : 'Must-Do tag removed'), [mutate, wrap])

  const seed: Ctx['seed'] = useCallback(() => wrap(async () => {
    const seedData = buildSeedData()   // empty — seed() resets to blank
    qc.setQueryData(['data'], seedData)
    await saveMutation.mutateAsync(seedData)   // immediate save (full replacement)
    setStagedCount(0)   // workspace clean after explicit reset
  }, 'Data reset'), [qc, saveMutation, wrap])

  const loadDemoData: Ctx['loadDemoData'] = useCallback(() => wrap(async () => {
    const demo = buildDemoData()       // full dataset with [DEMO] prefixes
    qc.setQueryData(['data'], demo)
    await saveMutation.mutateAsync(demo)   // immediate save (full replacement)
    setStagedCount(0)   // workspace clean after explicit reset
  }, 'Demo data loaded'), [qc, saveMutation, wrap])

  // ---- UI state ----
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [groupBy, setGroupBy] = useState<GroupBy>('project')
  const [zoom, setZoom] = useState<ZoomLevel>(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) return 'month'
      if (window.innerWidth < 1024) return 'week'
    }
    return 'day'
  })
  const [myTasksMemberId, setMyTasksMemberId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  const value: Ctx = useMemo(() => ({
    data: dataQuery.data,
    isLoading: dataQuery.isLoading,
    isError: dataQuery.isError,
    error: dataQuery.error as Error | null,
    refresh: () => qc.invalidateQueries({ queryKey: ['data'] }),
    editMode, pinConfigured, unlock, lock, setupPin, rotatePin,
    addProject, updateProject, deleteProject,
    addTask, updateTask, deleteTask,
    addMember, updateMember, deleteMember,
    addDependency, removeDependency,
    addHoliday, updateHoliday, deleteHoliday, loadHolidayPreset,
    addUpdate, updateUpdate, deleteUpdate,
    addPhaseTemplate, updatePhaseTemplate, deletePhaseTemplate, loadPhasePresets,
    addProjectPhase, updateProjectPhase, deleteProjectPhase, reorderProjectPhases,
    seed, loadDemoData,
    // V2
    localMode, loadDiagnostic, projectsV2, featuresV2, archivedProjectsV2, archivedFeaturesV2, rankedItemIds, userPresets, saveUserPreset, deleteUserPreset,
    // CR-2
    deletionLog, orphanProjectsV2,
    cleanupOrphans, permanentDeleteProjectV2, permanentDeleteFeatureV2, permanentDeleteMany,
    archiveBulkV2, setStatusBulk, moveToPortfolioBulk, setValueRatingBulk,
    exportDataJSON, importDataJSON,
    addProjectV2, updateProjectV2, archiveProjectV2, restoreProjectV2,
    addProjectV2StatusLog, addProjectV2Decision,
    addProjectV2Milestone, updateProjectV2Milestone,
    addProjectV2Track, updateProjectV2Track, removeProjectV2Track,
    addFeatureV2, updateFeatureV2, moveFeatureV2, archiveFeatureV2, restoreFeatureV2,
    addFeatureV2StatusLog, addFeatureV2Decision,
    filters, setFilters, groupBy, setGroupBy, zoom, setZoom,
    myTasksMemberId, setMyTasksMemberId, searchOpen, setSearchOpen,
    activeProjectId, setActiveProjectId,
    toasts, pushToast, dismissToast,
    isDirty, stagedCount, isSaving, saveNow,
    framework, setFramework, applyMustDo,
    modulesV2, archivedModulesV2,
    addModuleV2, updateModuleV2, archiveModuleV2, restoreModuleV2, permanentDeleteModuleV2,
    addModuleV2StatusLog, addModuleV2Decision,
    addModuleV2Track, updateModuleV2Track, removeModuleV2Track,
    addUserNote,
    crashDraftOffer, acceptCrashDraft, dismissCrashDraft,
    taskPulseId, setTaskPulseId,
  }), [
    dataQuery.data, dataQuery.isLoading, dataQuery.isError, dataQuery.error,
    editMode, pinConfigured, unlock, lock, setupPin, rotatePin,
    addProject, updateProject, deleteProject,
    addTask, updateTask, deleteTask,
    addMember, updateMember, deleteMember,
    addDependency, removeDependency,
    addHoliday, updateHoliday, deleteHoliday, loadHolidayPreset,
    addUpdate, updateUpdate, deleteUpdate,
    addPhaseTemplate, updatePhaseTemplate, deletePhaseTemplate, loadPhasePresets,
    addProjectPhase, updateProjectPhase, deleteProjectPhase, reorderProjectPhases,
    seed, loadDemoData,
    // V2
    projectsV2, featuresV2, rankedItemIds,
    addProjectV2, updateProjectV2, archiveProjectV2, restoreProjectV2,
    addProjectV2StatusLog, addProjectV2Decision,
    addProjectV2Milestone, updateProjectV2Milestone,
    addProjectV2Track, updateProjectV2Track, removeProjectV2Track,
    addFeatureV2, updateFeatureV2, moveFeatureV2, archiveFeatureV2, restoreFeatureV2,
    addFeatureV2StatusLog, addFeatureV2Decision,
    cleanupOrphans, permanentDeleteProjectV2, permanentDeleteFeatureV2, permanentDeleteMany,
    archiveBulkV2, setStatusBulk, moveToPortfolioBulk, setValueRatingBulk,
    exportDataJSON, importDataJSON,
    filters, groupBy, zoom, myTasksMemberId, searchOpen, activeProjectId,
    toasts, pushToast, dismissToast, qc,
    isDirty, stagedCount, isSaving, saveNow,
    framework, setFramework, applyMustDo,
    modulesV2, archivedModulesV2,
    addModuleV2, updateModuleV2, archiveModuleV2, restoreModuleV2, permanentDeleteModuleV2,
    addModuleV2StatusLog, addModuleV2Decision,
    addModuleV2Track, updateModuleV2Track, removeModuleV2Track,
    addUserNote,
    crashDraftOffer, acceptCrashDraft, dismissCrashDraft,
    taskPulseId, setTaskPulseId,
  ])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const v = useContext(AppCtx)
  if (!v) throw new Error('useApp must be used inside AppProvider')
  return v
}
