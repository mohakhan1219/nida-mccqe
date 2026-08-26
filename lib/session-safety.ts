import { dayKey, durationMinutes, todayKey } from "@/lib/dates"
import type { Settings, StudySession } from "@/lib/types"

export function warningThresholdHours(settings: Settings) {
  return settings.longSessionWarningHours > 0 ? settings.longSessionWarningHours : 3
}

export function confirmThresholdHours(settings: Settings) {
  return settings.confirmSessionHours > 0 ? settings.confirmSessionHours : 4
}

export function rawElapsedMinutes(
  session: Pick<StudySession, "startAt" | "endAt">,
  now = new Date()
) {
  const endIso = session.endAt ?? now.toISOString()
  return durationMinutes(session.startAt, endIso)
}

export function creditedDurationMinutes(
  session: StudySession,
  settings: Settings,
  now = new Date()
) {
  if (session.status === "completed") {
    return session.durationMinutes ?? rawElapsedMinutes(session, now)
  }
  const raw = rawElapsedMinutes(session, now)
  const cap = confirmThresholdHours(settings) * 60
  if (!session.confirmedThroughAt) return Math.min(raw, cap)
  const confirmedElapsed = durationMinutes(session.startAt, session.confirmedThroughAt)
  const sinceConfirm = raw - confirmedElapsed
  if (sinceConfirm <= cap + 0.01) return raw
  return confirmedElapsed + cap
}

export function needsConfirmation(
  session: StudySession | null,
  settings: Settings,
  now = new Date()
) {
  if (!session || session.status !== "running") return false
  const raw = rawElapsedMinutes(session, now)
  const credited = creditedDurationMinutes(session, settings, now)
  return raw > credited + 0.5
}

export function needsWarning(
  session: StudySession | null,
  settings: Settings,
  now = new Date()
) {
  if (!session || session.status !== "running") return false
  if (needsConfirmation(session, settings, now)) return false
  const raw = rawElapsedMinutes(session, now)
  return raw >= warningThresholdHours(settings) * 60
}

export function isStaleRunning(
  session: StudySession | null,
  settings: Settings,
  timeZone: string,
  now = new Date()
) {
  if (!session || session.status !== "running") return false
  if (!needsConfirmation(session, settings, now)) return false
  return dayKey(session.startAt, timeZone) < todayKey(timeZone, now)
}

export function sessionSafetyLabel(
  session: StudySession,
  settings: Settings,
  now = new Date()
): "Normal" | "Needs Confirmation" | "Confirmed" {
  if (session.status === "completed") {
    return session.confirmedThroughAt ? "Confirmed" : "Normal"
  }
  if (needsConfirmation(session, settings, now)) return "Needs Confirmation"
  if (session.confirmedThroughAt) return "Confirmed"
  return "Normal"
}

export function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string) {
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) throw new Error("Enter a valid time.")
  return d.toISOString()
}
