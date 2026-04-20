import type { TibbieData } from '../types'

const PIN_SESSION_KEY = 'tibbie:pin'

export function getSessionPin(): string | null {
  try { return sessionStorage.getItem(PIN_SESSION_KEY) } catch { return null }
}
export function setSessionPin(pin: string): void {
  try { sessionStorage.setItem(PIN_SESSION_KEY, pin) } catch {}
}
export function clearSessionPin(): void {
  try { sessionStorage.removeItem(PIN_SESSION_KEY) } catch {}
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const pin = getSessionPin()
  if (pin) headers.set('X-Tibbie-Pin', pin)

  const res = await fetch(path, { ...init, headers })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const j = await res.json() as { error?: string }; if (j.error) msg = j.error } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export const api = {
  // Data
  getData: () => req<TibbieData>('/api/data'),
  putData: (data: TibbieData) =>
    req<{ ok: boolean }>('/api/data', { method: 'PUT', body: JSON.stringify(data) }),

  // PIN
  pinStatus: () => req<{ configured: boolean }>('/api/pin'),
  pinSetup: (pin: string) =>
    req<{ ok: boolean }>('/api/pin', { method: 'POST', body: JSON.stringify({ action: 'setup', pin }) }),
  pinVerify: (pin: string) =>
    req<{ ok: boolean }>('/api/pin', { method: 'POST', body: JSON.stringify({ action: 'verify', pin }) }),
  pinRotate: (newPin: string) =>
    req<{ ok: boolean }>('/api/pin', { method: 'POST', body: JSON.stringify({ action: 'rotate', pin: newPin }) }),
}
