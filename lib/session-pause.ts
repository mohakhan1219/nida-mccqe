import { durationMinutes } from "@/lib/dates"
import type { SessionPauseInterval, Settings, StudySession } from "@/lib/types"

export function isActiveSession(session: Pick<StudySession, "status"> | null | undefined) {
  return Boolean(session && (session.status === "running" || session.status === "paused"))
}

export function openPause(session: Pick<StudySession, "pauseLog" | "status">) {
  if (session.status !== "paused") return null
  const last = session.pauseLog.at(-1)
  if (!last || last.resumedAt) return null
  return last
}

export function completedPauseMinutes(pauseLog: SessionPauseInterval[], untilIso?: string) {
  let total = 0
  const until = untilIso ? new Date(untilIso).getTime() : Number.POSITIVE_INFINITY
  for (const interval of pauseLog) {
    if (!interval.resumedAt) continue
    const start = new Date(interval.pausedAt).getTime()
    const end = new Date(interval.resumedAt).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    if (start >= until) continue
    const clippedEnd = Math.min(end, until)
    if (clippedEnd <= start) continue
    total += (clippedEnd - start) / 60000
  }
  return Math.round(total * 100) / 100
}

/**
 * Wall-clock study credit excluding break time.
 * While paused, freezes at the open pause timestamp.
 */
export function studyCreditMinutes(
  session: Pick<StudySession, "startAt" | "endAt" | "status" | "pauseLog" | "durationMinutes">,
  now = new Date()
) {
  if (session.status === "completed") {
    if (session.durationMinutes != null) return session.durationMinutes
    if (!session.endAt) return 0
    const raw = durationMinutes(session.startAt, session.endAt)
    return Math.max(0, Math.round((raw - completedPauseMinutes(session.pauseLog, session.endAt)) * 100) / 100)
  }

  const open = openPause(session)
  const endIso = open?.pausedAt ?? now.toISOString()
  const raw = durationMinutes(session.startAt, endIso)
  const paused = completedPauseMinutes(session.pauseLog, endIso)
  return Math.max(0, Math.round((raw - paused) * 100) / 100)
}

export function breakMinutesSoFar(
  session: Pick<StudySession, "pauseLog" | "status">,
  now = new Date()
) {
  const completed = completedPauseMinutes(session.pauseLog)
  const open = openPause(session)
  if (!open) return completed
  const openMins = durationMinutes(open.pausedAt, now.toISOString())
  return Math.round((completed + openMins) * 100) / 100
}

export function pauseAutoEndMinutes(settings: Pick<Settings, "pauseAutoEndMinutes">) {
  return settings.pauseAutoEndMinutes > 0 ? settings.pauseAutoEndMinutes : 60
}

export function shouldAutoEndPaused(
  session: Pick<StudySession, "status" | "pauseLog">,
  settings: Pick<Settings, "pauseAutoEndMinutes">,
  now = new Date()
) {
  const open = openPause(session)
  if (!open) return false
  const elapsed = durationMinutes(open.pausedAt, now.toISOString())
  return elapsed >= pauseAutoEndMinutes(settings)
}

/** Deterministic reconciliation: if paused too long, end at the pause timestamp. */
export function reconcilePausedSession(
  session: StudySession,
  settings: Pick<Settings, "pauseAutoEndMinutes">,
  now = new Date()
): StudySession {
  if (!shouldAutoEndPaused(session, settings, now)) return session
  const open = openPause(session)!
  const endAt = open.pausedAt
  const pauseLog = session.pauseLog.map((p, i) =>
    i === session.pauseLog.length - 1 && !p.resumedAt ? { ...p, resumedAt: endAt } : p
  )
  // Closing the open pause at pause time contributes 0 break; study credit freezes at pause.
  const duration = studyCreditMinutes(
    { ...session, status: "completed", endAt, pauseLog, durationMinutes: null },
    new Date(endAt)
  )
  return {
    ...session,
    status: "completed",
    endAt,
    pauseLog,
    durationMinutes: duration,
    confirmedThroughAt: session.confirmedThroughAt ?? endAt,
    updatedAt: now.toISOString(),
    notes: session.notes?.trim()
      ? session.notes
      : "Auto-ended after 60 minutes paused (break time not counted).",
  }
}

export function withPauseStarted(session: StudySession, at = new Date().toISOString()): StudySession {
  if (session.status !== "running") throw new Error("Only a live study session can be paused.")
  if (openPause(session)) throw new Error("Session is already paused.")
  return {
    ...session,
    status: "paused",
    pauseLog: [...session.pauseLog, { pausedAt: at, resumedAt: null }],
    updatedAt: at,
  }
}

export function withResume(session: StudySession, at = new Date().toISOString()): StudySession {
  if (session.status !== "paused") throw new Error("Only a paused session can be resumed.")
  const open = openPause(session)
  if (!open) throw new Error("No open pause to resume.")
  if (new Date(at) < new Date(open.pausedAt)) throw new Error("Resume time must be after pause time.")
  const pauseLog = session.pauseLog.map((p, i) =>
    i === session.pauseLog.length - 1 && !p.resumedAt ? { ...p, resumedAt: at } : p
  )
  return {
    ...session,
    status: "running",
    pauseLog,
    updatedAt: at,
  }
}

export function withSessionEnded(
  session: StudySession,
  endAt: string,
  patch?: Partial<Pick<StudySession, "notes" | "topic">>
): StudySession {
  if (!isActiveSession(session)) throw new Error("No active session")
  if (new Date(endAt) <= new Date(session.startAt)) {
    throw new Error("End time must be after start time.")
  }
  let pauseLog = session.pauseLog
  const open = openPause(session)
  // Ending while paused: effective study ends at pause time (break not counted).
  let effectiveEnd = endAt
  if (open) {
    effectiveEnd = open.pausedAt
    pauseLog = pauseLog.map((p, i) =>
      i === pauseLog.length - 1 && !p.resumedAt ? { ...p, resumedAt: open.pausedAt } : p
  )
  }
  const duration = studyCreditMinutes(
    { ...session, status: "completed", endAt: effectiveEnd, pauseLog, durationMinutes: null },
    new Date(effectiveEnd)
  )
  return {
    ...session,
    ...patch,
    endAt: effectiveEnd,
    durationMinutes: duration,
    status: "completed",
    pauseLog,
    confirmedThroughAt: effectiveEnd,
    updatedAt: new Date().toISOString(),
  }
}
