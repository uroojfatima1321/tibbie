import type { TibbieData } from '../types'
import { api } from './client'
import { buildSeedData } from '../lib/seed'

export interface DataAdapter {
  load(): Promise<TibbieData>
  save(data: TibbieData): Promise<void>
  readonly name: string
  readonly localMode: boolean
}

// ── Fix 2 (R2-C2): typed error for local-mode save attempts ─────────────────
export class LocalModeError extends Error {
  readonly code = 'LOCAL_MODE' as const
  constructor() {
    super('Working offline — changes are NOT saved to server. Reconnect and try again.')
    this.name = 'LocalModeError'
  }
}

// ── Diagnostic capture ────────────────────────────────────────────────────────
export interface LoadDiagnostic {
  url: string
  status: number | null
  message: string
  responseSnippet: string
  timestamp: string
}

let _localMode = false
let _inMemoryData: TibbieData | null = null
let _lastKnownData: TibbieData | null = null  // Fix 2: last-known cache for fallback
let _lastSavedVersion = -1
let _conflictPending = false
let _loadDiagnostic: LoadDiagnostic | null = null

// ── Fix 3 (R2-H4): subscribable _localMode ──────────────────────────────────
// useSyncExternalStore in context.tsx calls subscribeLocalMode, so React
// re-renders reliably whenever localMode changes (recovery + failure both).
type LocalModeListener = () => void
const _localModeListeners = new Set<LocalModeListener>()

function setLocalMode(value: boolean): void {
  if (_localMode === value) return
  _localMode = value
  _localModeListeners.forEach(cb => cb())
}

export function subscribeLocalMode(cb: LocalModeListener): () => void {
  _localModeListeners.add(cb)
  return () => _localModeListeners.delete(cb)
}

export function isLocalMode(): boolean { return _localMode }
export function getLoadDiagnostic(): LoadDiagnostic | null { return _loadDiagnostic }

export function popConflictDetected(): boolean {
  const v = _conflictPending
  _conflictPending = false
  return v
}

// ── Sub-adapters ──────────────────────────────────────────────────────────────
const netlifyAdapter: DataAdapter = {
  name: 'cloudflare-pages',
  localMode: false,
  load: () => api.getData(),
  save: async (data) => { await api.putData(data) },
}

const memoryAdapter: DataAdapter = {
  name: 'local-memory',
  localMode: true,
  async load() {
    // Fix 2: prefer last-known cache over seed; seed only when truly empty
    if (_inMemoryData) return _inMemoryData
    const fallback = _lastKnownData ?? buildSeedData() as TibbieData
    _inMemoryData = fallback
    return _inMemoryData
  },
  async save(data) { _inMemoryData = data },
}

// ── Smart adapter ─────────────────────────────────────────────────────────────
const smartAdapter: DataAdapter = {
  name: 'smart',
  get localMode() { return _localMode },

  async load() {
    try {
      const data = await netlifyAdapter.load()
      _lastKnownData = data   // Fix 2: keep last known for fallback

      if (_localMode) {
        setLocalMode(false)    // Fix 3: notify subscribers on recovery
        _loadDiagnostic = null
        _inMemoryData = null   // clear stale memory cache on reconnect
      }

      if (_lastSavedVersion >= 0 && (data.version ?? 0) > _lastSavedVersion + 1) {
        _conflictPending = true
      }

      return data
    } catch (e) {
      // Fix 2: capture diagnostic
      const diag: LoadDiagnostic = {
        url: '/api/data',
        status: e instanceof Error && /HTTP (\d+)/.test(e.message)
          ? parseInt(/HTTP (\d+)/.exec(e.message)![1], 10)
          : null,
        message: e instanceof Error ? e.message : String(e),
        responseSnippet: '',
        timestamp: new Date().toISOString(),
      }
      if (e && typeof e === 'object' && 'responseSnippet' in e) {
        diag.responseSnippet = (e as any).responseSnippet ?? ''
      }
      _loadDiagnostic = diag
      setLocalMode(true)       // Fix 3: notify subscribers
      // Fix 2: return last-known cache, not seed (seed only on truly first visit)
      return memoryAdapter.load()
    }
  },

  async save(data) {
    // Fix 2 (R2-C2): local mode MUST throw — never silently succeed.
    // State stays dirty, beforeunload stays armed, offline banner persists.
    if (_localMode) {
      // Mirror to memory for continuity (data not lost in-session)
      _inMemoryData = data
      throw new LocalModeError()
    }
    try {
      await netlifyAdapter.save(data)
      _lastSavedVersion = data.version ?? 0
    } catch (e) {
      await memoryAdapter.save(data)
      throw e   // rethrow — upstream saveNow() keeps state dirty
    }
  },
}

export const adapter: DataAdapter = smartAdapter
