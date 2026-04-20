// Short unique ID (good enough for a single-tenant tool, not cryptographically secure)
export const uid = (prefix = 'id'): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`

// Project colour palette — picked to feel cohesive with the rust/cream theme
export const PROJECT_PALETTE = [
  '#C65D3B', // rust
  '#2F5743', // forest
  '#3A6B8A', // steel
  '#C8932F', // amber
  '#7B4A6E', // plum
  '#5C6B3A', // olive
  '#A83D2F', // brick
  '#4F7C66', // forest-light
  '#8B5A3C', // bronze
  '#526784', // dusk
]

export function nextProjectColor(usedColors: string[]): string {
  for (const c of PROJECT_PALETTE) if (!usedColors.includes(c)) return c
  return PROJECT_PALETTE[usedColors.length % PROJECT_PALETTE.length]
}

// Member avatar colours — softer, distinct from project colours
export const MEMBER_PALETTE = [
  '#C65D3B', '#2F5743', '#3A6B8A', '#7B4A6E',
  '#8B5A3C', '#526784', '#6B8E4E', '#A05252',
  '#4A6B7B', '#8A6E3C',
]

export function nextMemberColor(usedColors: string[]): string {
  for (const c of MEMBER_PALETTE) if (!usedColors.includes(c)) return c
  return MEMBER_PALETTE[usedColors.length % MEMBER_PALETTE.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function classNames(...xs: (string | undefined | false | null)[]): string {
  return xs.filter(Boolean).join(' ')
}
