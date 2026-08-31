import type { Holiday } from '../types'
import { uid } from './util'

/**
 * Preset Pakistan public holidays.
 *
 * Two categories:
 * - Fixed holidays (Pakistan Day, Labour Day, Independence Day, Iqbal Day,
 *   Quaid Day): same date every year → recurring: 'yearly'.
 * - Lunar holidays (Eids, Muharram, Mawlid): dates shift annually based on
 *   moon sighting → stored as one-off entries with explicit YYYY-MM-DD.
 *   These need updating each year. The dates below are approximate for 2026
 *   and should be confirmed against official Pakistan government notifications
 *   when the time comes.
 *
 * Users can edit, add, or remove any of these from the Holidays panel.
 */
export function pakistanHolidayPreset2026(): Holiday[] {
  const now = new Date().toISOString()
  const mk = (date: string, name: string, recurring: 'yearly' | null = null): Holiday => ({
    id: uid('hol'), date, name, recurring, createdAt: now,
  })

  return [
    // Fixed annual
    mk('2026-02-05', 'Kashmir Day',           'yearly'),
    mk('2026-03-23', 'Pakistan Day',          'yearly'),
    mk('2026-05-01', 'Labour Day',            'yearly'),
    mk('2026-08-14', 'Independence Day',      'yearly'),
    mk('2026-11-09', 'Iqbal Day',             'yearly'),
    mk('2026-12-25', 'Quaid-e-Azam Day',      'yearly'),

    // Lunar — 2026 estimates (verify nearer the time)
    mk('2026-03-21', 'Eid-ul-Fitr (Day 1)'),
    mk('2026-03-22', 'Eid-ul-Fitr (Day 2)'),
    mk('2026-03-23', 'Eid-ul-Fitr (Day 3)'),
    mk('2026-05-27', 'Eid-ul-Adha (Day 1)'),
    mk('2026-05-28', 'Eid-ul-Adha (Day 2)'),
    mk('2026-05-29', 'Eid-ul-Adha (Day 3)'),
    mk('2026-06-25', 'Ashura (9th Muharram)'),
    mk('2026-06-26', 'Ashura (10th Muharram)'),
    mk('2026-08-25', 'Eid Milad un-Nabi'),
  ]
}

/**
 * Build a Set of ISO date strings (YYYY-MM-DD) covered by holidays in the
 * given range. Yearly-recurring entries are expanded for each year in the
 * range; one-off entries are included when they fall in range.
 */
export function expandHolidays(
  holidays: Holiday[],
  rangeStartISO: string,
  rangeEndISO: string,
): Map<string, string[]> {
  // Map of ISO date → list of holiday names that fall on that day
  const map = new Map<string, string[]>()
  if (!holidays.length) return map

  const startYear = parseInt(rangeStartISO.slice(0, 4), 10)
  const endYear = parseInt(rangeEndISO.slice(0, 4), 10)

  for (const h of holidays) {
    if (h.recurring === 'yearly') {
      const md = h.date.slice(5)  // MM-DD
      for (let y = startYear; y <= endYear; y++) {
        const iso = `${y}-${md}`
        if (iso >= rangeStartISO && iso <= rangeEndISO) {
          if (!map.has(iso)) map.set(iso, [])
          map.get(iso)!.push(h.name)
        }
      }
    } else {
      if (h.date >= rangeStartISO && h.date <= rangeEndISO) {
        if (!map.has(h.date)) map.set(h.date, [])
        map.get(h.date)!.push(h.name)
      }
    }
  }
  return map
}

/**
 * Returns true if the [taskStart, taskEnd] interval (inclusive) overlaps any
 * holiday in the expanded map. Used for the "spans a holiday" warning icon
 * on bars.
 */
export function taskOverlapsHoliday(
  taskStartISO: string,
  taskEndISO: string,
  holidayMap: Map<string, string[]>,
): { overlaps: boolean; names: string[] } {
  if (holidayMap.size === 0) return { overlaps: false, names: [] }
  const names: string[] = []
  // Iterate keys (it's small — at most ~20-30 holidays per year)
  for (const [date, holNames] of holidayMap) {
    if (date >= taskStartISO && date <= taskEndISO) {
      names.push(...holNames)
    }
  }
  return { overlaps: names.length > 0, names }
}
