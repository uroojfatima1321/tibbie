import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, FolderKanban, CheckSquare, User, Loader2 } from 'lucide-react'
import { useApp } from '../../store/context'
import { useDebounce } from '../../hooks/useDebounce'
import { searchAll, highlightMatches } from '../../lib/search'
import type { SearchResult } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSelectTask: (id: string) => void
  onSelectProject: (id: string) => void
  onSelectMember: (id: string) => void
}

type Cat = 'all' | 'project' | 'task' | 'member'

export function SearchPalette({ open, onClose, onSelectTask, onSelectProject, onSelectMember }: Props) {
  const { data } = useApp()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<Cat>('all')
  const debounced = useDebounce(query, 300)
  const inputRef = useRef<HTMLInputElement>(null)
  const [highlighted, setHighlighted] = useState(0)

  useEffect(() => {
    if (open) {
      setQuery(''); setCat('all'); setHighlighted(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  const isSearching = query.trim().length >= 2 && debounced !== query
  const results = useMemo(() => {
    if (!data) return []
    return searchAll(data, debounced)
  }, [data, debounced])

  const filtered = useMemo(
    () => cat === 'all' ? results : results.filter(r => r.type === cat),
    [results, cat],
  )

  const grouped = useMemo(() => {
    const g = { project: [] as SearchResult[], task: [] as SearchResult[], member: [] as SearchResult[] }
    for (const r of filtered) g[r.type].push(r)
    return g
  }, [filtered])

  const flatList = useMemo(
    () => [...grouped.project, ...grouped.task, ...grouped.member],
    [grouped],
  )

  useEffect(() => { setHighlighted(0) }, [debounced, cat])

  function handleSelect(r: SearchResult) {
    if (r.type === 'task') onSelectTask(r.id)
    else if (r.type === 'project') onSelectProject(r.id)
    else onSelectMember(r.id)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, flatList.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && flatList[highlighted]) { e.preventDefault(); handleSelect(flatList[highlighted]) }
  }

  if (!open) return null

  const counts = { all: results.length, project: grouped.project.length, task: grouped.task.length, member: grouped.member.length }

  return (
    <div className="fixed inset-0 z-50 animate-fade-in" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto mt-[10vh] w-[min(640px,92vw)] bg-cream-50 rounded-2xl shadow-float overflow-hidden animate-scale-in flex flex-col max-h-[70vh]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-cream-300">
          {isSearching ? (
            <Loader2 size={18} className="text-ink-400 animate-spin" />
          ) : (
            <Search size={18} className="text-ink-400" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, tasks, members…"
            className="flex-1 bg-transparent outline-none text-ink-900 placeholder-ink-400"
          />
          <button onClick={onClose} className="btn-ghost !p-1"><X size={16} /></button>
        </div>

        {query.trim().length >= 2 && (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-cream-300 overflow-x-auto">
            {(['all', 'project', 'task', 'member'] as Cat[]).map(c => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${cat === c ? 'bg-ink-900 text-cream-50' : 'text-ink-600 hover:bg-cream-200'}`}
              >
                {c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1) + 's'}
                {counts[c] > 0 && <span className="ml-1.5 opacity-60">{counts[c]}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto tibbie-scroll">
          {query.trim().length < 2 ? (
            <p className="text-sm text-ink-400 text-center py-8">Type at least 2 characters to search</p>
          ) : flatList.length === 0 && !isSearching ? (
            <p className="text-sm text-ink-400 text-center py-8">No results for "{debounced}"</p>
          ) : (
            <div className="py-2">
              {grouped.project.length > 0 && (
                <GroupHeader label="Projects" icon={<FolderKanban size={12} />} />
              )}
              {grouped.project.map(r => (
                <ResultRow
                  key={r.id}
                  result={r}
                  query={debounced}
                  isHighlighted={flatList.indexOf(r) === highlighted}
                  onClick={() => handleSelect(r)}
                  icon={<FolderKanban size={14} />}
                />
              ))}
              {grouped.task.length > 0 && (
                <GroupHeader label="Tasks" icon={<CheckSquare size={12} />} />
              )}
              {grouped.task.map(r => (
                <ResultRow
                  key={r.id}
                  result={r}
                  query={debounced}
                  isHighlighted={flatList.indexOf(r) === highlighted}
                  onClick={() => handleSelect(r)}
                  icon={<CheckSquare size={14} />}
                />
              ))}
              {grouped.member.length > 0 && (
                <GroupHeader label="Members" icon={<User size={12} />} />
              )}
              {grouped.member.map(r => (
                <ResultRow
                  key={r.id}
                  result={r}
                  query={debounced}
                  isHighlighted={flatList.indexOf(r) === highlighted}
                  onClick={() => handleSelect(r)}
                  icon={<User size={14} />}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-cream-300 flex items-center gap-3 text-[11px] text-ink-400">
          <KbdHint k="↑↓">navigate</KbdHint>
          <KbdHint k="↵">open</KbdHint>
          <KbdHint k="Esc">close</KbdHint>
        </div>
      </div>
    </div>
  )
}

function GroupHeader({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-semibold text-ink-400">
      {icon} {label}
    </div>
  )
}

function ResultRow({ result, query, isHighlighted, onClick, icon }: {
  result: SearchResult
  query: string
  isHighlighted: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  const labelParts = highlightMatches(result.label, query)
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-2 text-left transition-colors ${isHighlighted ? 'bg-rust-500/10' : 'hover:bg-cream-100'}`}
    >
      <span className="mt-0.5 text-ink-400">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-ink-900 truncate">
          {labelParts.map((p, i) => p.match
            ? <mark key={i} className="bg-rust-500/20 text-ink-900 rounded px-0.5">{p.text}</mark>
            : <span key={i}>{p.text}</span>)}
        </span>
        {result.sublabel && <span className="block text-xs text-ink-500 truncate mt-0.5">{result.sublabel}</span>}
      </span>
      {result.matchField && result.matchField !== 'name' && (
        <span className="text-[10px] text-ink-400 shrink-0 mt-1">in {result.matchField}</span>
      )}
    </button>
  )
}

function KbdHint({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-cream-200 text-ink-600">{k}</kbd>
      <span>{children}</span>
    </span>
  )
}
