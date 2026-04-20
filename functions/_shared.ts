/**
 * Shared helpers for Cloudflare Pages Functions.
 * Env is declared via `interface Env` in each function file — Cloudflare
 * injects KV bindings at request time based on the dashboard config.
 */

export interface Env {
  TIBBIE_KV: KVNamespace
}

// ---- PIN ----
export async function hashPin(pin: string): Promise<string> {
  // Web Crypto SHA-256 — available in the Workers runtime
  const data = new TextEncoder().encode(pin)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function getPinHash(env: Env): Promise<string | null> {
  return await env.TIBBIE_KV.get('pin_hash')
}

export async function setPinHash(env: Env, hash: string): Promise<void> {
  await env.TIBBIE_KV.put('pin_hash', hash)
}

export async function verifyPinHeader(request: Request, env: Env): Promise<boolean> {
  const stored = await getPinHash(env)
  if (!stored) return false
  const provided = request.headers.get('X-Tibbie-Pin')
  if (!provided) return false
  return (await hashPin(provided)) === stored
}

// ---- HTTP helpers ----
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tibbie-Pin',
  'Content-Type': 'application/json',
}

export const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: CORS_HEADERS })

export const bad = (status: number, message: string): Response =>
  new Response(JSON.stringify({ error: message }), { status, headers: CORS_HEADERS })

export const preflight = (): Response =>
  new Response(null, { status: 204, headers: CORS_HEADERS })

// ---- Data default ----
export const DEFAULT_DATA = {
  projects: [],
  members: [],
  tasks: [],
  dependencies: [],
  version: 1,
}
