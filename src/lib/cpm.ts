import type { Task, Dependency } from '../types'
import { daysBetween } from './dates'

/**
 * Basic CPM: forward pass computes earliest start, backward pass computes
 * latest start. Tasks where earliest start == latest start are on the
 * critical path. Handles finish-to-start dependencies (FS) only — covers
 * ~95% of real-world PM use.
 */
export function computeCriticalPath(
  tasks: Task[],
  dependencies: Dependency[],
): Set<string> {
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const predMap = new Map<string, string[]>()
  const succMap = new Map<string, string[]>()

  for (const t of tasks) {
    predMap.set(t.id, [])
    succMap.set(t.id, [])
  }
  for (const d of dependencies) {
    if (!taskMap.has(d.predecessorId) || !taskMap.has(d.successorId)) continue
    predMap.get(d.successorId)!.push(d.predecessorId)
    succMap.get(d.predecessorId)!.push(d.successorId)
  }

  const duration = (t: Task) => Math.max(1, daysBetween(t.startDate, t.endDate) || 1)

  // Topological order via Kahn's algorithm
  const inDeg = new Map<string, number>()
  for (const t of tasks) inDeg.set(t.id, predMap.get(t.id)!.length)
  const queue = tasks.filter(t => inDeg.get(t.id) === 0).map(t => t.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const s of succMap.get(id)!) {
      inDeg.set(s, inDeg.get(s)! - 1)
      if (inDeg.get(s) === 0) queue.push(s)
    }
  }
  // If graph has cycles, order will be incomplete — just bail
  if (order.length !== tasks.length) return new Set()

  // Forward pass — earliest finish
  const es = new Map<string, number>()
  const ef = new Map<string, number>()
  for (const id of order) {
    const t = taskMap.get(id)!
    const preds = predMap.get(id)!
    const earliestStart = preds.length === 0 ? 0 : Math.max(...preds.map(p => ef.get(p)!))
    es.set(id, earliestStart)
    ef.set(id, earliestStart + duration(t))
  }
  const projectEnd = Math.max(...Array.from(ef.values()))

  // Backward pass — latest finish
  const lf = new Map<string, number>()
  const ls = new Map<string, number>()
  for (const id of [...order].reverse()) {
    const t = taskMap.get(id)!
    const succs = succMap.get(id)!
    const latestFinish = succs.length === 0 ? projectEnd : Math.min(...succs.map(s => ls.get(s)!))
    lf.set(id, latestFinish)
    ls.set(id, latestFinish - duration(t))
  }

  // Critical: slack (ls - es) == 0
  const critical = new Set<string>()
  for (const id of order) {
    if ((ls.get(id)! - es.get(id)!) === 0) critical.add(id)
  }
  return critical
}
