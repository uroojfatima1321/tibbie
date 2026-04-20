import type { Handler } from '@netlify/functions'
import { dataStore, ok, bad, preflight, verifyPinHeader, DEFAULT_DATA } from './_shared'

/**
 * GET  /api/data        → entire dataset (open)
 * PUT  /api/data        → replace dataset (PIN required)
 *
 * We keep the whole dataset in one blob key `root`. For an internal PM tool
 * with <1K tasks this is fine and gives us atomic writes. If this ever grows,
 * shard per-collection (projects/tasks/members/deps as separate keys).
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()

  const store = dataStore()

  if (event.httpMethod === 'GET') {
    const data = (await store.get('root', { type: 'json' })) as unknown
    return ok(data || DEFAULT_DATA)
  }

  if (event.httpMethod === 'PUT') {
    if (!(await verifyPinHeader(event))) {
      return bad(401, 'Invalid or missing PIN')
    }
    try {
      const body = JSON.parse(event.body || '{}')
      if (!body || typeof body !== 'object') return bad(400, 'Invalid body')
      // Minimal shape check
      if (!Array.isArray(body.projects) || !Array.isArray(body.tasks)
        || !Array.isArray(body.members) || !Array.isArray(body.dependencies)) {
        return bad(400, 'Dataset missing required arrays')
      }
      await store.setJSON('root', body)
      return ok({ ok: true })
    } catch (e) {
      return bad(400, 'Could not parse body')
    }
  }

  return bad(405, 'Method not allowed')
}
