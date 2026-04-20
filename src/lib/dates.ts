import {
  format, parseISO, differenceInCalendarDays, addDays,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isWithinInterval, isBefore, isAfter,
} from 'date-fns'

export const ISO = 'yyyy-MM-dd'

export const today = () => format(new Date(), ISO)

export const toISO = (d: Date) => format(d, ISO)
export const fromISO = (s: string) => parseISO(s)

export const daysBetween = (a: string, b: string) =>
  differenceInCalendarDays(parseISO(b), parseISO(a))

export const addDaysISO = (s: string, n: number) =>
  format(addDays(parseISO(s), n), ISO)

export const fmtShort = (s: string) => format(parseISO(s), 'd MMM')
export const fmtLong = (s: string) => format(parseISO(s), 'd MMM yyyy')

export function isOverdue(endDate: string, status: string): boolean {
  if (status === 'done') return false
  return isBefore(parseISO(endDate), parseISO(today()))
}

export function isDueSoon(endDate: string, status: string, days = 7): boolean {
  if (status === 'done') return false
  const end = parseISO(endDate)
  const now = parseISO(today())
  const threshold = addDays(now, days)
  return !isBefore(end, now) && !isAfter(end, threshold)
}

export function weekBounds(date: Date) {
  return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) }
}

export function monthBounds(date: Date) {
  return { start: startOfMonth(date), end: endOfMonth(date) }
}

export function overlapsRange(
  itemStart: string, itemEnd: string,
  rangeStart: string | null, rangeEnd: string | null,
): boolean {
  if (!rangeStart && !rangeEnd) return true
  const iS = parseISO(itemStart), iE = parseISO(itemEnd)
  const rS = rangeStart ? parseISO(rangeStart) : null
  const rE = rangeEnd ? parseISO(rangeEnd) : null
  if (rS && isBefore(iE, rS)) return false
  if (rE && isAfter(iS, rE)) return false
  return true
}

export { isWithinInterval, isBefore, isAfter }
