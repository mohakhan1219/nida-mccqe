import { dayKey, durationMinutes, todayKey } from "@/lib/dates"
import { isActiveSession, openPause, studyCreditMinutes } from "@/lib/session-pause"
import type { Settings, StudySession } from "@/lib/types"

export function warningThresholdHours(settings: Settings) {
  return settings.longSessionWarningHours > 0 ? settings.longSessionWarningHours : 3
}

export function confirmThresholdHours(settings: Settings) {
  return settings.confirmSessionHours > 0 ? settings.confirmSessionHours : 4
}

/** Wall-clock elapsed including breaks (for “you've been away” UX). */
export function rawElapsedMinutes(
  session: Pick<StudySession, "startAt" | "endAt" | "status" | "pauseLog">,
  now = new Date()
) {
  if (session.status === "paused") {
    const open = openPause(session)
    if (open) return durationMinutes(session.startAt, open.pausedAt)
  }
  const endIso = session.endAt ?? now.toISOString()
  return durationMinutes(session.startAt, endIso)
}

/**
 * Credited study minutes excluding pauses.
 * Running sessions still respect the 4h unconfirmed cap.
 */
export function creditedDurationMinutes(
  session: StudySession,
  settings: Settings,
  now = new Date()
) {
  if (session.status === "completed") {
    return studyCreditMinutes(session, now)
  }
  const study = studyCreditMinutes(session, now)
  if (session.status === "paused") return study
  const cap = confirmThresholdHours(settings) * 60
  if (!session.confirmedThroughAt) return Math.min(study, cap)
  const confirmedStudy = studyCreditMinutes(
    {
      ...session,
      status: "completed",
      endAt: session.confirmedThroughAt,
      durationMinutes: null,
    },
    new Date(session.confirmedThroughAt)
  )
  const sinceConfirm = study - confirmedStudy
  if (sinceConfirm <= cap + 0.01) return study
  return confirmedStudy + cap
}

export function needsConfirmation(
  session: StudySession | null,
  settings: Settings,
  now = new Date()
) {
  if (!session || !isActiveSession(session)) return false
  if (session.status === "paused") return false
  const study = studyCreditMinutes(session, now)
  const credited = creditedDurationMinutes(session, settings, now)
  return study > credited + 0.5
}

export function needsWarning(
  session: StudySession | null,
  settings: Settings,
  now = new Date()
) {
  if (!session || session.status !== "running") return false
  if (needsConfirmation(session, settings, now)) return false
  const study = studyCreditMinutes(session, now)
  return study >= warningThresholdHours(settings) * 60
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
): "Normal" | "Needs Confirmation" | "Confirmed" | "Paused" {
  if (session.status === "paused") return "Paused"
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
