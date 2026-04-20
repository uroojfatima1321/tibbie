import type { TibbieData, SearchResult } from '../types'

/**
 * Case-insensitive substring search across projects, tasks (name + notes),
 * and members. Client-side over the full dataset — for <1K tasks this is
 * near-instant (<5ms). Satisfies US-26 "direct query" from the user's
 * perspective because we hit the live data store on every load.
 */
export function searchAll(data: TibbieData, query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const results: SearchResult[] = []

  for (const p of data.projects) {
    if (p.name.toLowerCase().includes(q)) {
      results.push({ type: 'project', id: p.id, label: p.name, matchField: 'name' })
    } else if (p.description.toLowerCase().includes(q)) {
      results.push({ type: 'project', id: p.id, label: p.name, sublabel: truncate(p.description, 80), matchField: 'description' })
    }
  }

  for (const t of data.tasks) {
    const project = data.projects.find(p => p.id === t.projectId)
    if (t.name.toLowerCase().includes(q)) {
      results.push({
        type: 'task', id: t.id, label: t.name,
        sublabel: project?.name, matchField: 'name', projectId: t.projectId,
      })
    } else if (t.notes.toLowerCase().includes(q)) {
      results.push({
        type: 'task', id: t.id, label: t.name,
        sublabel: truncate(t.notes, 80), matchField: 'notes', projectId: t.projectId,
      })
    }
  }

  for (const m of data.members) {
    if (m.name.toLowerCase().includes(q)) {
      results.push({ type: 'member', id: m.id, label: m.name, matchField: 'name' })
    } else if (m.email && m.email.toLowerCase().includes(q)) {
      results.push({ type: 'member', id: m.id, label: m.name, sublabel: m.email, matchField: 'email' })
    }
  }

  return results
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

/**
 * Highlight matching substring — returns an array of parts where each part
 * is { text, match: boolean }. Used by the SearchResult component (US-27).
 */
export function highlightMatches(text: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim()
  if (!q) return [{ text, match: false }]
  const parts: { text: string; match: boolean }[] = []
  const lower = text.toLowerCase()
  const qLower = q.toLowerCase()
  let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(qLower, i)
    if (idx === -1) { parts.push({ text: text.slice(i), match: false }); break }
    if (idx > i) parts.push({ text: text.slice(i, idx), match: false })
    parts.push({ text: text.slice(idx, idx + q.length), match: true })
    i = idx + q.length
  }
  return parts
}
