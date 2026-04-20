import { getStore } from '@netlify/blobs'
import crypto from 'node:crypto'
import type { HandlerEvent, HandlerResponse } from '@netlify/functions'

// ---- Store ----
export function dataStore() {
  return getStore({ name: 'tibbie-data', consistency: 'strong' })
}

export function configStore() {
  return getStore({ name: 'tibbie-config', consistency: 'strong' })
}

// ---- PIN ----
export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex')
}

export async function getPinHash(): Promise<string | null> {
  const cfg = configStore()
  const raw = await cfg.get('pin_hash', { type: 'text' })
  return raw || null
}

export async function setPinHash(hash: string): Promise<void> {
  const cfg = configStore()
  await cfg.set('pin_hash', hash)
}

export async function verifyPinHeader(event: HandlerEvent): Promise<boolean> {
  const stored = await getPinHash()
  if (!stored) return false  // no PIN set yet → no writes allowed
  const provided = event.headers['x-tibbie-pin'] || event.headers['X-Tibbie-Pin']
  if (!provided) return false
  return hashPin(String(provided)) === stored
}

// ---- HTTP helpers ----
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tibbie-Pin',
  'Content-Type': 'application/json',
}

export function ok(body: unknown): HandlerResponse {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(body) }
}

export function bad(status: number, message: string): HandlerResponse {
  return { statusCode: status, headers: CORS_HEADERS, body: JSON.stringify({ error: message }) }
}

export function preflight(): HandlerResponse {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' }
}

// ---- Data default ----
export const DEFAULT_DATA = {
  projects: [],
  members: [],
  tasks: [],
  dependencies: [],
  version: 1,
}
