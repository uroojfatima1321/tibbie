/**
 * ActivityLog — Item 6
 * Shared activity log panel for Project, Module, and Feature drawers.
 *
 * Rendering rules:
 * - User notes: full row, tag chip left, text, author, timestamp
 * - System events: lighter/gray, compressed rows
 * - Day clusters: 3+ events of the same kind within one hour collapse to "N events · expand"
 * - Feed order: newest-first
 * - Filter tabs: All · Notes · System · by tag (Meeting / Blocker / Update / Decision)
 *
 * Inputs at module scope (input registry compliance).
 */
import { useState } from 'react'
import { format, parseISO, formatDistanceToNow, differenceInMinutes } from 'date-fns'
import type { ActivityEntry, ActivityTag } from '../../types'
import { useApp } from '../../store/context'

const TAG_COLORS: Record<ActivityTag, string> = {
  Meeting:  'bg-steel-100 text-steel-700',
  Blocker:  'bg-brick-100 text-brick-700',
  Update:   'bg-amber-50 text-amber-700',
  Decision: 'bg-forest-50 text-forest-700',
}
const TAGS: ActivityTag[] = ['Meeting', 'Blocker', 'Update', 'Decision']

type Filter = 'all' | 'notes' | 'system' | ActivityTag

// ── Module-scope input component (input registry) ─────────────────────────────
interface NoteInputProps {
  entityId: string
  entityKind: 'project' | 'feature' | 'module'
}
function NoteInput({ entityId, entityKind }: NoteInputProps) {
  const { addUserNote, editMode } = useApp()
  const [text, setText] = useState('')
  const [tag, setTag] = useState<ActivityTag | ''>('')

  if (!editMode) return null
  return (
    <div className="space-y-1.5 mb-3">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1 text-sm !py-1.5"
          placeholder="Add note — Enter to save"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={async e => {
            if (e.key === 'Enter' && text.trim()) {
              await addUserNote(entityId, entityKind, text.trim(), tag || undefined)
              setText('')
            }
          }}
        />
        <select
          className="input text-xs !py-1.5 w-28"
          value={tag}
          onChange={e => setTag(e.target.value as ActivityTag | '')}
        >
          <option value="">Tag…</option>
          {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  entityId: string
  entityKind: 'project' | 'feature' | 'module'
  activityLog?: ActivityEntry[]
  members?: { id: string; name: string }[]
}

interface Cluster {
  kind: 'single' | 'collapsed'
  entries: ActivityEntry[]
}

function clusterEntries(entries: ActivityEntry[]): Cluster[] {
  const clusters: Cluster[] = []
  let i = 0
  while (i < entries.length) {
    const cur = entries[i]
    if (cur.kind !== 'system') { clusters.push({ kind: 'single', entries: [cur] }); i++; continue }
    // Collect consecutive system events of same systemEventType within 60 min
    const group = [cur]
    let j = i + 1
    while (j < entries.length) {
      const next = entries[j]
      if (next.kind !== 'system') break
      if (next.systemEventType !== cur.systemEventType) break
      if (Math.abs(differenceInMinutes(parseISO(next.at), parseISO(cur.at))) > 60) break
      group.push(next); j++
    }
    clusters.push({ kind: group.length >= 3 ? 'collapsed' : 'single', entries: group })
    i = j
  }
  return clusters
}

export function ActivityLog({ entityId, entityKind, activityLog, members = [] }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const entries = [...(activityLog || [])].reverse()  // newest first

  const filtered = entries.filter(e => {
    if (filter === 'notes') return e.kind === 'user'
    if (filter === 'system') return e.kind === 'system'
    if (filter === 'all') return true
    return e.tag === filter
  })

  const clusters = clusterEntries(filtered)

  function memberName(id?: string) {
    if (!id) return ''
    return members.find(m => m.id === id)?.name ?? ''
  }

  function relTime(at: string) {
    try { return formatDistanceToNow(parseISO(at), { addSuffix: true }) }
    catch { return at }
  }

  function EntryRow({ entry }: { entry: ActivityEntry }) {
    if (entry.kind === 'user') {
      return (
        <div className="flex items-start gap-2 py-2 border-b border-surface-100">
          {entry.tag && (
            <span className={`font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${TAG_COLORS[entry.tag]}`}>
              {entry.tag}
            </span>
          )}
          <span className="flex-1 text-sm text-ink-800">{entry.text}</span>
          <span className="text-[10px] text-ink-400 shrink-0 whitespace-nowrap" title={entry.at}>
            {relTime(entry.at)}
          </span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 py-1 border-b border-surface-100/50">
        <span className="text-[10px] text-ink-400 flex-1">{entry.text}</span>
        <span className="text-[10px] text-ink-300 shrink-0" title={entry.at}>
          {format(parseISO(entry.at), 'MMM d')}
        </span>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-2">
        Activity
      </p>

      <NoteInput entityId={entityId} entityKind={entityKind} />

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {(['all', 'notes', 'system', ...TAGS] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${filter === f ? 'bg-ink-900 text-white border-ink-900' : 'border-surface-200 text-ink-400 hover:border-surface-300'}`}>
            {f === 'all' ? 'All' : f === 'notes' ? 'Notes' : f === 'system' ? 'System' : f}
          </button>
        ))}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <p className="text-xs text-ink-400">No activity yet.</p>
      ) : (
        <div className="max-h-60 overflow-y-auto tibbie-scroll space-y-0">
          {clusters.map((cluster, ci) => {
            if (cluster.kind === 'single') {
              return cluster.entries.map((e, ei) => <EntryRow key={`${ci}-${ei}`} entry={e} />)
            }
            // Collapsed: show summary row with expand option
            const isExpanded = expanded.has(ci)
            return (
              <div key={ci}>
                <button
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev)
                    isExpanded ? next.delete(ci) : next.add(ci)
                    return next
                  })}
                  className="w-full text-left text-[10px] text-ink-400 py-1 border-b border-surface-100/50 hover:text-ink-600 transition-colors"
                >
                  {cluster.entries.length} {cluster.entries[0].systemEventType?.replace('_', ' ')} events
                  {' '}· {format(parseISO(cluster.entries[0].at), 'MMM d')}
                  <span className="ml-1 text-rust-400">{isExpanded ? '▲ collapse' : '▼ expand'}</span>
                </button>
                {isExpanded && cluster.entries.map((e, ei) => (
                  <EntryRow key={ei} entry={e} />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
