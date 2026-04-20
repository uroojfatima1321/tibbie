/// <reference types="@cloudflare/workers-types" />
import {
  type Env, ok, bad, preflight, verifyPinHeader, DEFAULT_DATA,
} from '../_shared'

/**
 * GET  /api/data  → full dataset (open)
 * PUT  /api/data  → replace dataset (PIN required)
 *
 * Whole dataset kept in one KV key `root`. Atomic writes; last-write-wins.
 * Sharding to per-collection keys becomes interesting past ~1K tasks —
 * you're nowhere near that yet.
 */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return preflight()

  if (request.method === 'GET') {
    const raw = await env.TIBBIE_KV.get('root', { type: 'json' })
    return ok(raw || DEFAULT_DATA)
  }

  if (request.method === 'PUT') {
    if (!(await verifyPinHeader(request, env))) {
      return bad(401, 'Invalid or missing PIN')
    }
    let body: any
    try {
      body = await request.json()
    } catch {
      return bad(400, 'Could not parse body')
    }
    if (!body || typeof body !== 'object') return bad(400, 'Invalid body')
    if (!Array.isArray(body.projects) || !Array.isArray(body.tasks)
      || !Array.isArray(body.members) || !Array.isArray(body.dependencies)) {
      return bad(400, 'Dataset missing required arrays')
    }
    await env.TIBBIE_KV.put('root', JSON.stringify(body))
    return ok({ ok: true })
  }

  return bad(405, 'Method not allowed')
}
