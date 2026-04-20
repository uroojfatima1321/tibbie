import type { Handler } from '@netlify/functions'
import {
  ok, bad, preflight,
  hashPin, getPinHash, setPinHash, verifyPinHeader,
} from './_shared'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()

  if (event.httpMethod === 'GET') {
    const hash = await getPinHash()
    return ok({ configured: !!hash })
  }

  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  let body: { action?: string; pin?: string }
  try { body = JSON.parse(event.body || '{}') } catch { return bad(400, 'Invalid JSON') }

  const action = body.action
  const pin = (body.pin || '').trim()
  if (!pin || pin.length < 4 || pin.length > 32) {
    return bad(400, 'PIN must be 4–32 characters')
  }

  if (action === 'setup') {
    if (await getPinHash()) return bad(409, 'PIN already configured')
    await setPinHash(hashPin(pin))
    return ok({ ok: true })
  }
  if (action === 'verify') {
    const stored = await getPinHash()
    if (!stored) return ok({ ok: false, reason: 'no_pin_configured' })
    return ok({ ok: hashPin(pin) === stored })
  }
  if (action === 'rotate') {
    if (!(await verifyPinHeader(event))) return bad(401, 'Current PIN required')
    await setPinHash(hashPin(pin))
    return ok({ ok: true })
  }
  return bad(400, 'Unknown action')
}
