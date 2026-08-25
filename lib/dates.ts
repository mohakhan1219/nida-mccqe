import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns"
import { formatInTimeZone, toZonedTime } from "date-fns-tz"

export function nowIso() {
  return new Date().toISOString()
}

export function zonedDate(date: Date | string, timeZone: string) {
  return toZonedTime(typeof date === "string" ? parseISO(date) : date, timeZone)
}

export function dayKey(iso: string, timeZone: string) {
  return formatInTimeZone(parseISO(iso), timeZone, "yyyy-MM-dd")
}

export function todayKey(timeZone: string) {
  return formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd")
}

export function weekStartKey(isoOrNow: string | Date, timeZone: string) {
  const z = zonedDate(isoOrNow, timeZone)
  const start = startOfWeek(z, { weekStartsOn: 1 })
  return format(start, "yyyy-MM-dd")
}

export function monthKey(iso: string, timeZone: string) {
  return formatInTimeZone(parseISO(iso), timeZone, "yyyy-MM")
}

export function addDaysKey(key: string, days: number) {
  return format(addDays(parseISO(`${key}T12:00:00`), days), "yyyy-MM-dd")
}

export function daysBetweenKeys(a: string, b: string) {
  return differenceInCalendarDays(parseISO(`${b}T12:00:00`), parseISO(`${a}T12:00:00`))
}

export function combineLocalDateTime(dateKey: string, timeHHmm: string, timeZone: string) {
  const [h, m] = timeHHmm.split(":").map(Number)
  const local = `${dateKey}T${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00`
  const asIf = new Date(local)
  const tzDate = toZonedTime(asIf, timeZone)
  const offset = asIf.getTime() - tzDate.getTime()
  return new Date(asIf.getTime() + offset).toISOString()
}

export function durationMinutes(startIso: string, endIso: string) {
  const ms = parseISO(endIso).getTime() - parseISO(startIso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.round((ms / 60000) * 100) / 100
}

export function quoteIndexForDay(day: string, count: number) {
  if (count <= 0) return 0
  const [y, m, d] = day.split("-").map(Number)
  const serial = Math.floor(Date.UTC(y, m - 1, d) / 86400000)
  return ((serial % count) + count) % count
}

export function countdownDays(examDate: string, timeZone: string) {
  const today = todayKey(timeZone)
  return daysBetweenKeys(today, examDate)
}
