/// <reference types="@cloudflare/workers-types" />
import {
  type Env, ok, bad, preflight,
  hashPin, getPinHash, setPinHash, verifyPinHeader,
} from '../_shared'

/**
 * GET  /api/pin   → { configured: boolean }
 * POST /api/pin   → { action: 'setup'|'verify'|'rotate', pin: string }
 */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return preflight()

  if (request.method === 'GET') {
    const hash = await getPinHash(env)
    return ok({ configured: !!hash })
  }

  if (request.method !== 'POST') return bad(405, 'Method not allowed')

  let body: { action?: string; pin?: string }
  try { body = await request.json() } catch { return bad(400, 'Invalid JSON') }

  const action = body.action
  const pin = (body.pin || '').trim()
  if (!pin || pin.length < 4 || pin.length > 32) {
    return bad(400, 'PIN must be 4–32 characters')
  }

  if (action === 'setup') {
    if (await getPinHash(env)) return bad(409, 'PIN already configured')
    await setPinHash(env, await hashPin(pin))
    return ok({ ok: true })
  }
  if (action === 'verify') {
    const stored = await getPinHash(env)
    if (!stored) return ok({ ok: false, reason: 'no_pin_configured' })
    return ok({ ok: (await hashPin(pin)) === stored })
  }
  if (action === 'rotate') {
    if (!(await verifyPinHeader(request, env))) return bad(401, 'Current PIN required')
    await setPinHash(env, await hashPin(pin))
    return ok({ ok: true })
  }
  return bad(400, 'Unknown action')
}
