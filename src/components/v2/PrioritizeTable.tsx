import { useState, useMemo, useCallback, useEffect, useRef, createRef } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, FolderOpen, Tag, Wrench, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useApp } from '../../store/context'
import type { FeatureV2, ProjectV2, ModuleV2, RiceScore, WsjfScore, FeatureStatus, Member } from '../../types'
import { StatusPill } from './StatusPill'
import { Avatar } from '../members/Avatar'
import { ValueDotsCell } from './ValueDots'
import { InfoTip } from './InfoTip'
import { PrioritizeSection } from './PrioritizeSection'
import { useLocalStorage } from '../../lib/useLocalStorage'
import { isValidRice, safeRiceScore, isValidWsjf, safeWsjfScore } from '../../lib/filterV2'
import { LIVE_GROUP_STATUSES, DELIVERY_EXCLUDED_STATUSES, IN_DELIVERY_STATUSES } from '../../lib/rank'
import { deriveSections, type SectionId } from '../../lib/prioritizeSections'

type SortCol = 'rank' | 'name' | 'project' | 'status' | 'reach' | 'impact' | 'confidence' | 'effort' | 'score' | 'scoredAt' | 'valueRating' | 've'
  | 'bv' | 'tc' | 'ro' | 'js'   // WSJF columns
type SortDir = 'asc' | 'desc'
// Phase D: 'modules' added to TypeFilter
export type TypeFilter = 'all' | 'both' | 'projects' | 'features' | 'improvements' | 'modules'

const STALE_DAYS = 90
const REACH_OPTS: { value: RiceScore['reach']; label: string }[] = [
  { value: 1, label: '1 · Very few' }, { value: 2, label: '2 · Some' },
  { value: 3, label: '3 · Many' }, { value: 4, label: '4 · Most' }, { value: 5, label: '5 · Nearly all' },
]
const IMPACT_OPTS: { value: RiceScore['impact']; label: string }[] = [
  { value: 0.25, label: '0.25' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' },
]

// Phase D: modules now participate in the rank pool
type AnyItem = (ProjectV2 | FeatureV2 | ModuleV2) & { kind: 'project' | 'feature' | 'module' }

function riceScore(r: RiceScore | null | undefined): number | null { return safeRiceScore(r) }
function isStale(scoredAt: string | undefined | null) {
  if (!scoredAt) return false
  return (Date.now() - new Date(scoredAt).getTime()) > STALE_DAYS * 86_400_000
}
function veScore(item: AnyItem): number | null {
  if (!item.valueRating || !isValidRice(item.rice)) return null
  return item.valueRating / item.rice.effort
}

type PartialRice = { reach?: RiceScore['reach']; impact?: RiceScore['impact']; confidence?: string; effort?: string }

// ── Module-scope sort helpers ──────────────────────────────────────────────────
interface SortCtx { sortCol: SortCol; sortDir: SortDir; onSort: (col: SortCol) => void }

function SortIcon({ col, ctx }: { col: SortCol; ctx: SortCtx }) {
  if (ctx.sortCol !== col) return <ChevronsUpDown size={11} className="text-ink-300" />
  return ctx.sortDir === 'asc'
    ? <ChevronUp size={11} className="text-rust-500" />
    : <ChevronDown size={11} className="text-rust-500" />
}

function Th({ col, label, right, tip, ctx }: { col: SortCol; label: string; right?: boolean; tip?: string; ctx: SortCtx }) {
  return (
    <th className={`py-2 px-3 text-left whitespace-nowrap ${right ? 'text-right' : ''}`}>
      <button onClick={() => ctx.onSort(col)} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-ink-500 hover:text-ink-900 transition-colors">
        {label}
        {tip && <InfoTip content={tip} />}
        <SortIcon col={col} ctx={ctx} />
      </button>
    </th>
  )
}

// ── Module-scope scored row ────────────────────────────────────────────────────
interface ScoredRowCtx {
  rankedItemIds: string[]
  members: Member[]
  flashingIds: Set<string>
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  projectsV2: ProjectV2[]
  featuresV2: FeatureV2[]
  modulesV2: ModuleV2[]
  saveRiceField: (item: AnyItem, field: 'reach' | 'impact' | 'confidence' | 'effort', val: number) => Promise<void>
  openItem: (item: AnyItem) => void
  onOpenProject: (id: string) => void
  framework: 'rice' | 'wsjf'
}

function ScoredRow({ item, indent, ctx, isMustDo }: { item: AnyItem; indent: boolean; ctx: ScoredRowCtx; isMustDo?: boolean }) {
  const { rankedItemIds, members, flashingIds, selectedIds, onToggleSelect,
          projectsV2, featuresV2, modulesV2, saveRiceField, openItem, onOpenProject, framework } = ctx
  const rank = rankedItemIds.indexOf(item.id) + 1
  const total = rankedItemIds.length
  const score = framework === 'wsjf' ? safeWsjfScore(item.wsjf) : riceScore(item.rice)
  const stale = framework === 'rice' && isValidRice(item.rice) ? isStale(item.rice.scoredAt) : false
  const ve = veScore(item)
  const parentProject = item.kind === 'feature'
    ? projectsV2.find(p => p.id === (item as FeatureV2).projectId) ?? null
    : item.kind === 'module'
    ? projectsV2.find(p => p.id === (item as ModuleV2).projectId) ?? null
    : null
  const parentModule = item.kind === 'feature' && (item as FeatureV2).moduleId
    ? modulesV2.find(m => m.id === (item as FeatureV2).moduleId)?.name ?? null
    : null
  const owners = members.filter(m => item.ownerIds.includes(m.id))
  const isFlashing = flashingIds.has(item.id)
  // Overlap hint: scored child features/modules
  const overlapCount = item.kind === 'project'
    ? featuresV2.filter(f => f.projectId === item.id && (framework === 'wsjf' ? f.wsjf !== null : f.rice !== null)).length
      + modulesV2.filter(m => m.projectId === item.id && (framework === 'wsjf' ? m.wsjf !== null : m.rice !== null)).length
    : item.kind === 'module'
    ? featuresV2.filter(f => f.moduleId === item.id && (framework === 'wsjf' ? f.wsjf !== null : f.rice !== null)).length
    : 0
  const isImprovement = item.kind === 'feature' && (item as FeatureV2).itemType === 'improvement'

  return (
    <tr key={item.id} className={`hover:bg-surface-50 cursor-pointer ${selectedIds.has(item.id) ? 'bg-rust-50' : ''} ${isFlashing ? 'animate-rank-flash' : ''}`}>
      <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => onToggleSelect(item.id)}
          className="rounded border-surface-300 text-rust-500 focus:ring-rust-400" />
      </td>
      {/* Rank / Must-Do badge */}
      <td className="py-2 px-3 font-mono text-xs whitespace-nowrap" onClick={() => openItem(item)}>
        {isMustDo ? (
          <span className="font-sans text-[10px] font-semibold bg-brick-600 text-white px-1.5 py-0.5 rounded-full">Must-Do</span>
        ) : rank > 0 ? (
          <span className="text-ink-500">#{rank}<span className="text-ink-300"> / {total}</span></span>
        ) : <span className="text-ink-300">—</span>}
      </td>
      <td className={`py-2 px-3 sticky left-0 bg-inherit border-r border-surface-100 font-medium text-ink-900 max-w-[220px] ${indent ? 'pl-6' : ''}`} onClick={() => openItem(item)}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="block truncate">{item.name}</span>
          {overlapCount > 0 && (
            <span className="shrink-0 font-sans text-[10px] text-ink-400 bg-surface-100 px-1.5 py-0.5 rounded-full whitespace-nowrap"
              title={`This project is scored alongside ${overlapCount} scored child feature${overlapCount > 1 ? 's' : ''} in the same ranking pool`}>
              {overlapCount} scored feature{overlapCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </td>
      <td className="py-2 px-3" onClick={() => openItem(item)}>
        {item.kind === 'project' ? <span title="Project"><FolderOpen size={13} className="text-ink-400" /></span>
          : isImprovement ? <span title="Improvement"><Wrench size={13} className="text-blue-400" /></span>
          : <span title="Feature"><Tag size={13} className="text-ink-400" /></span>}
      </td>
      <td className="py-2 px-3 text-xs max-w-[160px]">
        {parentProject ? (
          <button onClick={e => { e.stopPropagation(); onOpenProject(parentProject.id) }}
            className="inline-flex items-center gap-1 text-[11px] font-sans text-ink-600 bg-surface-100 px-2 py-0.5 rounded-full hover:bg-surface-200 transition-colors max-w-full"
            title={parentModule ? `${parentProject.name} · ${parentModule}` : parentProject.name}>
            <span className="truncate">
              ↳ {parentProject.name.length > 12 ? parentProject.name.slice(0, 12) + '…' : parentProject.name}
              {parentModule && <span className="text-ink-400"> · {parentModule.length > 10 ? parentModule.slice(0, 10) + '…' : parentModule}</span>}
            </span>
          </button>
        ) : item.kind === 'feature' ? (
          <span className="inline-flex items-center text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Backlog</span>
        ) : null}
      </td>
      <td className="py-2 px-3" onClick={() => openItem(item)}>
        <StatusPill status={item.status} kind={item.kind === 'module' ? 'feature' : item.kind} className="!text-[10px]" />
      </td>
      {/* Score columns — adapt to active framework */}
      {framework === 'wsjf' ? (
        <>
          <td className="py-2 px-3 text-right font-mono text-xs text-ink-700" onClick={() => openItem(item)}>{item.wsjf?.businessValue ?? '—'}</td>
          <td className="py-2 px-3 text-right font-mono text-xs text-ink-700" onClick={() => openItem(item)}>{item.wsjf?.timeCriticality ?? '—'}</td>
          <td className="py-2 px-3 text-right font-mono text-xs text-ink-700" onClick={() => openItem(item)}>{item.wsjf?.riskOpportunity ?? '—'}</td>
          <td className="py-2 px-3 text-right font-mono text-xs text-ink-700" onClick={() => openItem(item)}>{item.wsjf?.jobSize ?? '—'}</td>
        </>
      ) : (
        <>
          <td className="py-2 px-3 text-right"><ScoredCell field="reach" item={item} onSave={saveRiceField} isSelect reachOpts={REACH_OPTS} impactOpts={IMPACT_OPTS} /></td>
          <td className="py-2 px-3 text-right"><ScoredCell field="impact" item={item} onSave={saveRiceField} isSelect reachOpts={REACH_OPTS} impactOpts={IMPACT_OPTS} /></td>
          <td className="py-2 px-3 text-right"><ScoredCell field="confidence" item={item} onSave={saveRiceField} reachOpts={REACH_OPTS} impactOpts={IMPACT_OPTS} /></td>
          <td className="py-2 px-3 text-right"><ScoredCell field="effort" item={item} onSave={saveRiceField} reachOpts={REACH_OPTS} impactOpts={IMPACT_OPTS} /></td>
        </>
      )}
      <td className="py-2 px-3 text-right font-mono text-xs text-ink-900" onClick={() => openItem(item)}>
        {score?.toFixed(1) ?? '—'}
      </td>
      <td className="py-2 px-3 whitespace-nowrap" onClick={() => openItem(item)}>
        {framework === 'rice' && isValidRice(item.rice) && item.rice.scoredAt && (
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-ink-400">{format(parseISO(item.rice.scoredAt), 'dd MMM yy')}</span>
            {stale && <span className="font-sans text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Stale</span>}
          </span>
        )}
        {framework === 'wsjf' && item.wsjf?.scoredAt && (
          <span className="font-mono text-xs text-ink-400">{format(parseISO(item.wsjf.scoredAt), 'dd MMM yy')}</span>
        )}
      </td>
      <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
        <ValueDotsCell itemId={item.id} kind={item.kind} value={item.valueRating} />
      </td>
      <td className="py-2 px-3 text-right" onClick={() => openItem(item)}>
        {ve !== null
          ? <span className="font-mono text-xs text-ink-700" title={`${item.valueRating} ÷ ${isValidRice(item.rice) ? item.rice.effort : '?'} = ${ve.toFixed(1)}`}>{ve.toFixed(1)}</span>
          : <span className="text-ink-300 font-mono text-xs">—</span>}
      </td>
      <td className="py-2 px-3" onClick={() => openItem(item)}>
        <div className="flex -space-x-1">
          {owners.slice(0, 2).map(m => <Avatar key={m.id} member={m} size="xs" />)}
          {owners.length > 2 && <span className="font-mono text-[10px] text-ink-400 pl-2">+{owners.length - 2}</span>}
        </div>
      </td>
    </tr>
  )
}

interface Props {
  typeFilter: TypeFilter
  onOpenFeature: (id: string, scrollToRice?: boolean) => void
  onOpenProject: (id: string) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: (ids: string[]) => void
  groupByProject?: boolean
  showInDelivery?: boolean  // Item 4: controls In Delivery + Live section visibility
  sectionRefs?: Partial<Record<SectionId, React.RefObject<HTMLDivElement>>>
}

export function PrioritizeTable({ typeFilter, onOpenFeature, onOpenProject, selectedIds, onToggleSelect, onSelectAll, groupByProject = false, showInDelivery = true, sectionRefs }: Props) {
  const { featuresV2, projectsV2, modulesV2, rankedItemIds, data, updateFeatureV2, updateProjectV2, updateModuleV2, framework } = useApp()
  const [sortCol, setSortCol] = useLocalStorage<SortCol>('tibbie-sort-col', 'rank')
  const [sortDir, setSortDir] = useLocalStorage<SortDir>('tibbie-sort-dir', 'asc')
  const [unscoredExpanded, setUnscoredExpanded] = useState(false)
  // Item 4: section collapse state — persisted per brief spec
  const [sectionCollapse, setSectionCollapse] = useLocalStorage<Record<SectionId, boolean>>(
    'tibbie.prioritize.collapsed',
    { 'must-do': false, ranked: false, 'needs-scoring': false, 'in-delivery': false, live: true }
  )
  function toggleSection(id: SectionId) {
    setSectionCollapse(prev => ({ ...prev, [id]: !prev[id] }))
  }
  const [partialEdits, setPartialEdits] = useState<Record<string, PartialRice>>({})
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set())
  const prevRanksRef = useRef<Record<string, number>>({})
  const members = data?.members || []

  useEffect(() => {
    const prev = prevRanksRef.current
    const next: Record<string, number> = {}
    const changed: string[] = []
    rankedItemIds.forEach((id, i) => {
      next[id] = i
      if (prev[id] !== undefined && prev[id] !== i) changed.push(id)
    })
    prevRanksRef.current = next
    if (changed.length > 0) {
      setFlashingIds(new Set(changed))
      const t = setTimeout(() => setFlashingIds(new Set()), 500)
      return () => clearTimeout(t)
    }
  }, [rankedItemIds])

  // Phase B: separate Must-Do items (above ranked queue)
  const mustDoIds = useMemo(() => new Set(
    [...projectsV2, ...featuresV2].filter(i => !!i.mustDo).map(i => i.id)
  ), [projectsV2, featuresV2])

  // Items by typeFilter — Phase D adds modules
  const allItems = useMemo<AnyItem[]>(() => {
    const showAll = typeFilter === 'all' || typeFilter === 'both'
    const ps = (showAll || typeFilter === 'projects') ? (projectsV2 as AnyItem[]) : []
    const ms = (showAll || typeFilter === 'modules')  ? (modulesV2  as AnyItem[]) : []
    const allFs = featuresV2 as AnyItem[]
    let fs: AnyItem[] = []
    if (showAll) fs = allFs
    else if (typeFilter === 'features')     fs = allFs.filter(f => (f as FeatureV2).itemType !== 'improvement')
    else if (typeFilter === 'improvements') fs = allFs.filter(f => (f as FeatureV2).itemType === 'improvement')
    return [...ps, ...ms, ...fs]
  }, [projectsV2, modulesV2, featuresV2, typeFilter])

  // Must-Do items for the top group (ordered by tag date, oldest first)
  const mustDoItems = useMemo<AnyItem[]>(() =>
    allItems
      .filter(i => !!i.mustDo)
      .sort((a, b) => (a.mustDo!.at).localeCompare(b.mustDo!.at))
  , [allItems])

  // Items eligible for ranked/unscored sections (excluding Must-Do and ALL delivery-excluded projects — F)
  const eligibleItems = useMemo(() => allItems.filter(i => {
    if (i.mustDo) return false
    if (i.kind === 'project' && DELIVERY_EXCLUDED_STATUSES.includes((i as ProjectV2).status)) return false
    return true
  }), [allItems])

  const hasScore = (i: AnyItem) => framework === 'wsjf'
    ? isValidWsjf(i.wsjf)
    : (i.rice !== null && isValidRice(i.rice))

  const scoredItems  = useMemo(() => eligibleItems.filter(i => hasScore(i)), [eligibleItems, framework])
  const unscoredItems = useMemo(() => eligibleItems.filter(i => !hasScore(i)), [eligibleItems, framework])

  // EXC-3 (F): All delivery-excluded projects shown together — building + live sub-groups
  const inDeliveryItems = useMemo<AnyItem[]>(() =>
    allItems.filter(i => !i.mustDo && i.kind === 'project' && IN_DELIVERY_STATUSES.includes((i as ProjectV2).status))
  , [allItems])

  const liveItems = useMemo<AnyItem[]>(() =>
    allItems.filter(i => !i.mustDo && i.kind === 'project' && LIVE_GROUP_STATUSES.includes((i as ProjectV2).status))
  , [allItems])

  const allDeliveryItems = useMemo(() => [...inDeliveryItems, ...liveItems], [inDeliveryItems, liveItems])

  function sortedList(items: AnyItem[]) {
    // Fix 11 (R2-L4): build rank Map once → O(n) setup, O(1) per lookup vs O(n²) indexOf-in-sort
    const rankMap = new Map(rankedItemIds.map((id, i) => [id, i]))
    return [...items].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      switch (sortCol) {
        case 'rank': {
          const ra = rankMap.get(a.id) ?? 9999
          const rb = rankMap.get(b.id) ?? 9999
          va = ra; vb = rb; break
        }
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break
        case 'project': va = (a.kind === 'feature' ? (a as FeatureV2).projectId ?? '' : ''); vb = (b.kind === 'feature' ? (b as FeatureV2).projectId ?? '' : ''); break
        case 'status': va = a.status; vb = b.status; break
        case 'reach': va = isValidRice(a.rice) ? a.rice.reach : -1; vb = isValidRice(b.rice) ? b.rice.reach : -1; break
        case 'impact': va = isValidRice(a.rice) ? a.rice.impact : -1; vb = isValidRice(b.rice) ? b.rice.impact : -1; break
        case 'confidence': va = isValidRice(a.rice) ? a.rice.confidence : -1; vb = isValidRice(b.rice) ? b.rice.confidence : -1; break
        case 'effort': va = isValidRice(a.rice) ? a.rice.effort : -1; vb = isValidRice(b.rice) ? b.rice.effort : -1; break
        case 'score': va = (framework === 'wsjf' ? safeWsjfScore(a.wsjf) : safeRiceScore(a.rice)) ?? -1; vb = (framework === 'wsjf' ? safeWsjfScore(b.wsjf) : safeRiceScore(b.rice)) ?? -1; break
        case 'scoredAt': va = isValidRice(a.rice) ? a.rice.scoredAt : ''; vb = isValidRice(b.rice) ? b.rice.scoredAt : ''; break
        case 'valueRating': va = a.valueRating ?? -1; vb = b.valueRating ?? -1; break
        case 've': va = veScore(a) ?? -1; vb = veScore(b) ?? -1; break
        case 'bv': va = a.wsjf?.businessValue ?? -1; vb = b.wsjf?.businessValue ?? -1; break
        case 'tc': va = a.wsjf?.timeCriticality ?? -1; vb = b.wsjf?.timeCriticality ?? -1; break
        case 'ro': va = a.wsjf?.riskOpportunity ?? -1; vb = b.wsjf?.riskOpportunity ?? -1; break
        case 'js': va = a.wsjf?.jobSize ?? -1; vb = b.wsjf?.jobSize ?? -1; break
      }
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  async function saveRiceField(item: AnyItem, field: keyof Pick<RiceScore, 'reach'|'impact'|'confidence'|'effort'>, val: number) {
    const now = new Date().toISOString().slice(0, 10)
    const existing = isValidRice(item.rice) ? item.rice : null
    const newRice: RiceScore = {
      reach: field === 'reach' ? val as RiceScore['reach'] : (existing?.reach ?? 1),
      impact: field === 'impact' ? val as RiceScore['impact'] : (existing?.impact ?? 1),
      confidence: field === 'confidence' ? val : (existing?.confidence ?? 80),
      effort: field === 'effort' ? val : (existing?.effort ?? 1),
      scoredAt: now, scoredBy: existing?.scoredBy,
    }
    // Fix 1 (R2-C1): modules are scoreable
    if (item.kind === 'module') await updateModuleV2(item.id, { rice: newRice })
    else if (item.kind === 'feature') await updateFeatureV2(item.id, { rice: newRice })
    else await updateProjectV2(item.id, { rice: newRice })
  }

  function updatePartial(id: string, field: keyof PartialRice, val: PartialRice[typeof field]) {
    setPartialEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }))
  }

  async function tryCommitPartial(id: string, item: AnyItem) {
    const p = partialEdits[id] ?? {}
    const reach = p.reach; const impact = p.impact
    const conf = parseFloat(p.confidence ?? ''); const effort = parseFloat(p.effort ?? '')
    if (!reach || !impact || isNaN(conf) || isNaN(effort) || conf < 0 || conf > 100 || effort < 0.5) return
    const now = new Date().toISOString().slice(0, 10)
    const rice: RiceScore = { reach, impact, confidence: conf, effort, scoredAt: now }
    // Fix 1 (R2-C1)
    if (item.kind === 'module') await updateModuleV2(id, { rice })
    else if (item.kind === 'feature') await updateFeatureV2(id, { rice })
    else await updateProjectV2(id, { rice })
    setPartialEdits(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  function focusNext(id: string, current: 'reach' | 'impact' | 'conf' | 'effort') {
    const map: Record<string, string> = { reach: 'impact', impact: 'conf', conf: 'effort' }
    const next = map[current]
    if (next) document.getElementById(`ur-${id}-${next}`)?.focus()
  }

  function openItem(item: AnyItem) {
    if (item.kind === 'feature') onOpenFeature(item.id)
    else onOpenProject(item.id)
    // Modules: onOpenProject will be wired to open module drawer from App.tsx via ProjectDrawer
  }

  type GroupEntry =
    | { type: 'header'; projectId: string | null; label: string }
    | { type: 'item'; item: AnyItem; indent: boolean }

  const sorted = sortedList(scoredItems)

  const groupedEntries = useMemo<GroupEntry[] | null>(() => {
    if (!groupByProject) return null

    // Phase D: two-level grouping — project → modules → features
    const projectItems: AnyItem[] = []
    const moduleItems: AnyItem[]  = []
    const featuresByProject = new Map<string | null, AnyItem[]>()    // direct project features
    const featuresByModule  = new Map<string, AnyItem[]>()           // features inside modules

    for (const item of sorted) {
      if (item.kind === 'project') {
        projectItems.push(item)
      } else if (item.kind === 'module') {
        moduleItems.push(item)
      } else {
        const feat = item as FeatureV2
        if (feat.moduleId) {
          if (!featuresByModule.has(feat.moduleId)) featuresByModule.set(feat.moduleId, [])
          featuresByModule.get(feat.moduleId)!.push(item)
        } else {
          const pid = feat.projectId ?? null
          if (!featuresByProject.has(pid)) featuresByProject.set(pid, [])
          featuresByProject.get(pid)!.push(item)
        }
      }
    }

    const modulesByProject = new Map<string, AnyItem[]>()
    for (const mod of moduleItems) {
      const pid = (mod as ModuleV2).projectId
      if (!modulesByProject.has(pid)) modulesByProject.set(pid, [])
      modulesByProject.get(pid)!.push(mod)
    }

    const out: GroupEntry[] = []
    const coveredProjects = new Set<string>()

    // Project rows with their modules and direct features
    for (const projItem of projectItems) {
      coveredProjects.add(projItem.id)
      out.push({ type: 'header', projectId: projItem.id, label: projItem.name })
      out.push({ type: 'item', item: projItem, indent: false })
      // Modules under this project (with their features, indented)
      for (const modItem of (modulesByProject.get(projItem.id) ?? [])) {
        out.push({ type: 'item', item: modItem, indent: true })
        for (const f of (featuresByModule.get(modItem.id) ?? [])) {
          out.push({ type: 'item', item: f, indent: true })  // deeper indent via double-indent class
        }
      }
      // Direct features under this project
      for (const child of (featuresByProject.get(projItem.id) ?? [])) {
        out.push({ type: 'item', item: child, indent: true })
      }
    }

    // Standalone modules (project not in scored list)
    for (const [pid, mods] of modulesByProject.entries()) {
      if (coveredProjects.has(pid)) continue
      const parentName = projectsV2.find(p => p.id === pid)?.name ?? pid
      out.push({ type: 'header', projectId: pid, label: parentName })
      for (const mod of mods) {
        out.push({ type: 'item', item: mod, indent: false })
        for (const f of (featuresByModule.get(mod.id) ?? [])) {
          out.push({ type: 'item', item: f, indent: true })
        }
      }
    }

    // Features under projects not in scored list
    for (const [pid, children] of featuresByProject.entries()) {
      if (pid === null) continue
      if (coveredProjects.has(pid)) continue
      const parentName = projectsV2.find(p => p.id === pid)?.name ?? pid
      out.push({ type: 'header', projectId: pid, label: parentName })
      for (const child of children) out.push({ type: 'item', item: child, indent: true })
    }

    // Backlog (no parent)
    const backlog = featuresByProject.get(null) ?? []
    if (backlog.length > 0) {
      out.push({ type: 'header', projectId: null, label: 'Backlog' })
      for (const child of backlog) out.push({ type: 'item', item: child, indent: true })
    }

    return out
  }, [groupByProject, sorted, projectsV2, modulesV2])

  const allScoredIds = scoredItems.map(i => i.id)
  const allSelected = allScoredIds.every(id => selectedIds.has(id)) && allScoredIds.length > 0

  const sortCtx: SortCtx = { sortCol, sortDir, onSort: handleSort }
  const rowCtx: ScoredRowCtx = {
    rankedItemIds, members, flashingIds, selectedIds,
    onToggleSelect, projectsV2, featuresV2, modulesV2,
    saveRiceField, openItem, onOpenProject, framework,
  }

  // Column headers switch by framework
  const scoreColHeaders = framework === 'wsjf' ? (
    <>
      <Th col="bv" label="BV" tip="Business Value (1–10)" right ctx={sortCtx} />
      <Th col="tc" label="Time Crit." tip="Time Criticality (1–10)" right ctx={sortCtx} />
      <Th col="ro" label="Risk/Opp." tip="Risk Reduction / Opportunity (1–10)" right ctx={sortCtx} />
      <Th col="js" label="Job Size" tip="Job Size (1–10, divides score)" right ctx={sortCtx} />
    </>
  ) : (
    <>
      <Th col="reach" label="Reach" right ctx={sortCtx} />
      <Th col="impact" label="Impact" right ctx={sortCtx} />
      <Th col="confidence" label="Conf." right ctx={sortCtx} />
      <Th col="effort" label="Effort Req." right ctx={sortCtx} />
    </>
  )

  if (allItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center">
        <p className="text-sm text-ink-500">No items yet. Add projects or features from the Roadmap.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto tibbie-scroll">
      <table className="w-full border-collapse text-sm min-w-[1020px]">
        <thead className="bg-white border-b border-surface-200 sticky top-0 z-10">
          <tr>
            <th className="py-2 px-3 w-8">
              <input type="checkbox" checked={allSelected}
                onChange={() => allSelected ? onSelectAll([]) : onSelectAll(allScoredIds)}
                className="rounded border-surface-300 text-rust-500 focus:ring-rust-400" />
            </th>
            <Th col="rank" label="Rank" ctx={sortCtx} />
            <th className="py-2 px-3 text-left sticky left-0 bg-white border-r border-surface-100 min-w-[180px]">
              <button onClick={() => handleSort('name')} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-ink-500 hover:text-ink-900 transition-colors">
                Name <SortIcon col="name" ctx={sortCtx} />
              </button>
            </th>
            <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-semibold text-ink-500 w-6" title="Type" />
            <Th col="project" label="Project" ctx={sortCtx} />
            <Th col="status" label="Status" ctx={sortCtx} />
            {scoreColHeaders}
            <Th col="score" label="Score"
              tip={framework === 'wsjf' ? '(BV + Time Crit. + Risk/Opp.) ÷ Job Size' : '(Reach × Impact × Confidence%) ÷ Effort Required'}
              right ctx={sortCtx} />
            <Th col="scoredAt" label="Scored" ctx={sortCtx} />
            <Th col="valueRating" label="Value" ctx={sortCtx} />
            <Th col="ve" label="V/E" tip="Business Value per person-week — cheap high-value work floats up." right ctx={sortCtx} />
            <th className="py-2 px-3 text-left text-[10px] uppercase tracking-wider font-semibold text-ink-500">Owner</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100"></tbody>
      </table>

      {/* Item 4: derive 5 ordered sections; each uses PrioritizeSection for sticky header + collapse */}
      {(() => {
        const sections = deriveSections(allItems, framework, rankedItemIds, { showInDelivery })

        function renderSectionRows(items: AnyItem[], sectionId: SectionId) {
          if (sectionId === 'ranked') {
            return (
              <table className="w-full border-collapse text-sm min-w-[1020px]">
                <tbody className="divide-y divide-surface-100">
                  {groupedEntries ? (
                    groupedEntries.map((entry, idx) => {
                      if (entry.type === 'header') {
                        return (
                          <tr key={`gh-${entry.projectId ?? 'backlog'}-${idx}`} className="bg-surface-50/80 border-t-2 border-surface-200">
                            <td colSpan={15} className="py-1.5 px-4">
                              <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                                {entry.label === 'Backlog' ? 'Backlog' : `↳ ${entry.label}`}
                              </span>
                            </td>
                          </tr>
                        )
                      }
                      return <ScoredRow key={entry.item.id} item={entry.item} indent={entry.indent} ctx={rowCtx} />
                    })
                  ) : (
                    items.map(item => <ScoredRow key={item.id} item={item} indent={false} ctx={rowCtx} />)
                  )}
                </tbody>
              </table>
            )
          }
          if (sectionId === 'must-do') {
            return (
              <table className="w-full border-collapse text-sm min-w-[1020px]">
                <tbody className="divide-y divide-surface-100">
                  {items.map(item => <ScoredRow key={item.id} item={item} indent={false} ctx={rowCtx} isMustDo />)}
                </tbody>
              </table>
            )
          }
          if (sectionId === 'needs-scoring') {
            return (
              <div>
                {items.map(item => (
                  <UnscoredRow key={item.id} item={item} partial={partialEdits[item.id] ?? {}}
                    projectsV2={projectsV2}
                    onUpdate={(f, v) => updatePartial(item.id, f, v)}
                    onCommit={() => tryCommitPartial(item.id, item)}
                    onFocusNext={f => focusNext(item.id, f)}
                    onOpenDrawer={() => item.kind === 'feature' ? onOpenFeature(item.id, true) : onOpenProject(item.id)}
                    selected={selectedIds.has(item.id)} onToggle={() => onToggleSelect(item.id)}
                    framework={framework} />
                ))}
              </div>
            )
          }
          return (
            <div>
              {items.map(item => (
                <div key={item.id}
                  className="flex items-center gap-3 px-4 py-2 border-b border-surface-100 hover:bg-surface-50 cursor-pointer text-sm"
                  onClick={() => openItem(item)}>
                  <FolderOpen size={12} className="text-ink-400 shrink-0" />
                  <span className="font-medium text-ink-900 flex-1 truncate">{item.name}</span>
                  <StatusPill status={item.status} kind="project" className="!text-[10px]" />
                </div>
              ))}
            </div>
          )
        }

        return sections
          .filter(sec => sec.count > 0)
          .map(sec => (
            <PrioritizeSection
              key={sec.id}
              id={sec.id}
              label={sec.label}
              count={sec.count}
              tone={sec.tone}
              sticky
              collapsed={sectionCollapse[sec.id] ?? sec.defaultCollapsed}
              onToggle={() => toggleSection(sec.id)}
              sectionRef={sectionRefs?.[sec.id]}
            >
              {renderSectionRows(sec.items, sec.id)}
            </PrioritizeSection>
          ))
      })()}
    </div>
  )
}

// ── Scored row inline edit cell (RICE only) ───────────────────────────────────
function ScoredCell({ field, item, onSave, isSelect, reachOpts, impactOpts }: {
  field: 'reach' | 'impact' | 'confidence' | 'effort'
  item: AnyItem
  onSave: (item: AnyItem, field: 'reach'|'impact'|'confidence'|'effort', val: number) => Promise<void>
  isSelect?: boolean
  reachOpts: typeof REACH_OPTS
  impactOpts: typeof IMPACT_OPTS
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const { editMode } = useApp()
  const display = item.rice?.[field] ?? null

  if (!editing) return (
    <button onClick={() => { if (!editMode) return; setVal(display?.toString() ?? ''); setEditing(true) }}
      className={`w-full text-left px-1 py-0.5 rounded font-mono text-xs min-w-[36px] ${editMode ? 'hover:bg-surface-100 transition-colors cursor-pointer' : 'cursor-default'}`}>
      {display ?? <span className="text-ink-300">—</span>}
    </button>
  )

  async function commit() {
    const n = parseFloat(val)
    if (!isNaN(n)) await onSave(item, field, n)
    setEditing(false)
  }

  if (field === 'reach') return (
    <select autoFocus className="text-xs border-0 bg-surface-50 rounded outline-none ring-1 ring-rust-400 w-full"
      value={val} onChange={e => setVal(e.target.value)} onBlur={commit}>
      {reachOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
  if (field === 'impact') return (
    <select autoFocus className="text-xs border-0 bg-surface-50 rounded outline-none ring-1 ring-rust-400 w-full"
      value={val} onChange={e => setVal(e.target.value)} onBlur={commit}>
      {impactOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
  return (
    <input autoFocus type="number" step={field === 'effort' ? 0.5 : 1}
      min={field === 'effort' ? 0.5 : field === 'confidence' ? 0 : undefined}
      max={field === 'confidence' ? 100 : undefined}
      className="text-xs border-0 bg-surface-50 rounded outline-none ring-1 ring-rust-400 w-full font-mono px-1"
      value={val} onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }} />
  )
}

// ── CR-1.3: Zero-modal unscored row ──────────────────────────────────────────
function UnscoredRow({ item, partial, projectsV2, onUpdate, onCommit, onFocusNext, onOpenDrawer, selected, onToggle, framework }: {
  item: AnyItem
  partial: PartialRice
  projectsV2: ProjectV2[]
  onUpdate: (field: keyof PartialRice, val: PartialRice[keyof PartialRice]) => void
  onCommit: () => void
  onFocusNext: (field: 'reach' | 'impact' | 'conf' | 'effort') => void
  onOpenDrawer: () => void
  selected: boolean
  onToggle: () => void
  framework: 'rice' | 'wsjf'
}) {
  const project = item.kind === 'feature' ? projectsV2.find(p => p.id === (item as FeatureV2).projectId) : null
  const isImprovement = item.kind === 'feature' && (item as FeatureV2).itemType === 'improvement'

  const previewScore = (() => {
    if (!partial.reach || !partial.impact) return null
    const conf = parseFloat(partial.confidence ?? ''); const effort = parseFloat(partial.effort ?? '')
    if (isNaN(conf) || isNaN(effort) || conf < 0 || conf > 100 || effort < 0.5) return null
    return (Number(partial.reach) * Number(partial.impact) * (conf / 100)) / effort
  })()

  const id = item.id

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 border-b border-surface-100 ${selected ? 'bg-rust-50' : 'hover:bg-surface-50'}`}>
      <input type="checkbox" checked={selected} onChange={onToggle}
        className="rounded border-surface-300 text-rust-500 focus:ring-rust-400 shrink-0" onClick={e => e.stopPropagation()} />
      <span className="shrink-0">
        {item.kind === 'project' ? <FolderOpen size={12} className="text-ink-400" />
          : isImprovement ? <Wrench size={12} className="text-blue-400" />
          : <Tag size={12} className="text-ink-400" />}
      </span>
      <span className="text-sm text-ink-800 min-w-[140px] max-w-[180px] truncate shrink-0">{item.name}</span>
      {project && <span className="text-xs text-ink-400 truncate max-w-[100px] shrink-0">{project.name}</span>}

      {/* For WSJF mode, just show Open link (stepper UX doesn't work in table) */}
      {framework === 'wsjf' ? (
        <span className="text-xs text-ink-400 italic ml-2">Open to score in WSJF →</span>
      ) : (
        <>
          <select id={`ur-${id}-reach`}
            className="text-xs border border-surface-200 rounded bg-white px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-rust-400 max-w-[80px] flex-shrink-0"
            value={partial.reach ?? ''}
            onChange={e => onUpdate('reach', Number(e.target.value) as RiceScore['reach'])}
            onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); onFocusNext('reach') } }}>
            <option value="">Reach</option>
            {REACH_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select id={`ur-${id}-impact`}
            className="text-xs border border-surface-200 rounded bg-white px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-rust-400 max-w-[64px] flex-shrink-0"
            value={partial.impact ?? ''}
            onChange={e => onUpdate('impact', Number(e.target.value) as RiceScore['impact'])}
            onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); onFocusNext('impact') } }}>
            <option value="">Impact</option>
            {IMPACT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <input id={`ur-${id}-conf`} type="number" min={0} max={100} step={5} placeholder="Conf %"
              className="text-xs border border-surface-200 rounded bg-white px-1.5 py-0.5 w-16 outline-none focus:ring-1 focus:ring-rust-400 font-mono"
              value={partial.confidence ?? ''}
              onChange={e => onUpdate('confidence', e.target.value)}
              onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); onFocusNext('conf') } }} />
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <input id={`ur-${id}-effort`} type="number" min={0.5} step={0.5} placeholder="Effort pw"
              className="text-xs border border-surface-200 rounded bg-white px-1.5 py-0.5 w-16 outline-none focus:ring-1 focus:ring-rust-400 font-mono"
              value={partial.effort ?? ''}
              onChange={e => onUpdate('effort', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onCommit() } }} />
          </div>
          <span className="font-mono text-xs text-ink-400 w-10 shrink-0 text-right">
            {previewScore !== null ? previewScore.toFixed(1) : '—'}
          </span>
        </>
      )}

      <button onClick={onOpenDrawer} className="shrink-0 text-xs text-rust-500 hover:text-rust-600 font-medium transition-colors ml-auto">
        Open →
      </button>
    </div>
  )
}
