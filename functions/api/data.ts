/// <reference types="@cloudflare/workers-types" />
import {
  type Env, ok, bad, preflight, verifyPinHeader, DEFAULT_DATA,
} from '../_shared'

/**
 * GET  /api/data  → full dataset (open)
 * PUT  /api/data  → replace dataset (PIN required)
 *
 * Whole dataset kept in one KV key `root`. Atomic writes; last-write-wins.
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

    // Strip _v1ProjectsBackup from the main blob — it should never live in `root`.
    // Keeping it there inflates every subsequent write and can trigger KV rate limits.
    // Belt-and-suspenders: client-side migrate() also no longer sets it, but old KV
    // data written before this fix may still carry it.
    const { _v1ProjectsBackup, ...dataToStore } = body as any

    try {
      await env.TIBBIE_KV.put('root', JSON.stringify(dataToStore))
    } catch (e: any) {
      // KV.put can throw on rate-limit or size limit; surface a clear 503.
      return bad(503, `KV write failed: ${e?.message ?? 'unknown error'}`)
    }

    // Persist V1 backup to its own key — once, silently.
    if (Array.isArray(_v1ProjectsBackup) && _v1ProjectsBackup.length > 0) {
      try { await env.TIBBIE_KV.put('root_v1backup', JSON.stringify(_v1ProjectsBackup)) } catch {}
    }

    return ok({ ok: true })
  }

  return bad(405, 'Method not allowed')
}
