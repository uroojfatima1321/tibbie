import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TibbieData, Project, Task, Member, Dependency, Filters, GroupBy, ZoomLevel, TaskStatus } from '../types'
import { adapter } from '../api/adapter'
import { api, getSessionPin, setSessionPin, clearSessionPin } from '../api/client'
import { buildSeedData } from '../lib/seed'
import { uid, nextProjectColor, nextMemberColor } from '../lib/util'

interface ToastMsg { id: string; kind: 'info' | 'error' | 'success'; text: string }

interface Ctx {
  // data
  data: TibbieData | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  refresh: () => void

  // auth (edit mode)
  editMode: boolean
  pinConfigured: boolean | null
  unlock: (pin: string) => Promise<boolean>
  lock: () => void
  setupPin: (pin: string) => Promise<boolean>
  rotatePin: (newPin: string) => Promise<boolean>

  // mutations
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

  seed: () => Promise<void>

  // ui state
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

  // toasts
  toasts: ToastMsg[]
  pushToast: (kind: ToastMsg['kind'], text: string) => void
  dismissToast: (id: string) => void
}

const AppCtx = createContext<Ctx | null>(null)

const emptyFilters: Filters = {
  projectIds: [], statuses: [], memberIds: [],
  dateRange: { start: null, end: null },
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()

  const dataQuery = useQuery({
    queryKey: ['data'],
    queryFn: () => adapter.load(),
  })

  // PIN / edit state
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

  const lock = useCallback(() => {
    clearSessionPin()
    setEditMode(false)
  }, [])

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
    try {
      await api.pinRotate(newPin)
      setSessionPin(newPin)
      return true
    } catch { return false }
  }, [])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: TibbieData) => { await adapter.save(data); return data },
    onSuccess: (data) => { qc.setQueryData(['data'], data) },
  })

  const mutate = useCallback(async (mutator: (d: TibbieData) => TibbieData) => {
    const current = qc.getQueryData<TibbieData>(['data'])
    if (!current) throw new Error('Data not loaded')
    const next = mutator(current)
    // Optimistic update
    qc.setQueryData(['data'], next)
    try {
      await saveMutation.mutateAsync(next)
    } catch (e) {
      // Rollback on failure
      qc.setQueryData(['data'], current)
      throw e
    }
  }, [qc, saveMutation])

  // ---- Toasts ----
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const pushToast = useCallback((kind: ToastMsg['kind'], text: string) => {
    const id = uid('toast')
    setToasts(ts => [...ts, { id, kind, text }])
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4000)
  }, [])
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

  // ---- CRUD ----
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
      tasks: d.tasks.map(t => t.id === id
        ? { ...t, ...patch, updatedAt: new Date().toISOString() }
        : t),
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

  const seed: Ctx['seed'] = useCallback(() => wrap(async () => {
    const seedData = buildSeedData()
    qc.setQueryData(['data'], seedData)
    await saveMutation.mutateAsync(seedData)
  }, 'Seed data loaded'), [qc, saveMutation, wrap])

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
    addDependency, removeDependency, seed,
    filters, setFilters, groupBy, setGroupBy, zoom, setZoom,
    myTasksMemberId, setMyTasksMemberId, searchOpen, setSearchOpen,
    toasts, pushToast, dismissToast,
  }), [
    dataQuery.data, dataQuery.isLoading, dataQuery.isError, dataQuery.error,
    editMode, pinConfigured, unlock, lock, setupPin, rotatePin,
    addProject, updateProject, deleteProject,
    addTask, updateTask, deleteTask,
    addMember, updateMember, deleteMember,
    addDependency, removeDependency, seed,
    filters, groupBy, zoom, myTasksMemberId, searchOpen,
    toasts, pushToast, dismissToast, qc,
  ])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const v = useContext(AppCtx)
  if (!v) throw new Error('useApp must be used inside AppProvider')
  return v
}
