import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS } from "@/lib/catalogs"
import { durationMinutes } from "@/lib/dates"
import {
  creditedDurationMinutes,
  isStaleRunning,
  needsConfirmation,
  needsWarning,
  rawElapsedMinutes,
} from "@/lib/session-safety"
import type { StudySession } from "@/lib/types"

const settings = {
  ...DEFAULT_SETTINGS,
  longSessionWarningHours: 3,
  confirmSessionHours: 4,
  timezone: "UTC",
}

function running(startAt: string, confirmedThroughAt: string | null = null): StudySession {
  return {
    id: "s1",
    subjectId: "cardiology",
    sourceId: "uworld",
    activityId: "lecture",
    topic: "",
    startAt,
    endAt: null,
    durationMinutes: null,
    entryMode: "timer",
    status: "running",
    notes: "",
    linkedAssessmentId: null,
    planned: false,
    confidence: null,
    energy: null,
    confirmedThroughAt,
    createdAt: startAt,
    updatedAt: startAt,
  }
}

describe("session safety credits", () => {
  it("credits a normal 90-minute session in full", () => {
    const start = "2026-08-26T10:00:00.000Z"
    const end = "2026-08-26T11:30:00.000Z"
    expect(durationMinutes(start, end)).toBe(90)
    const done = { ...running(start), status: "completed" as const, endAt: end, durationMinutes: 90 }
    expect(creditedDurationMinutes(done, settings, new Date(end))).toBe(90)
  })

  it("caps an unconfirmed 7h 20m running session at 4h", () => {
    const start = "2026-08-25T19:00:00.000Z"
    const now = new Date("2026-08-26T02:20:00.000Z")
    const session = running(start)
    expect(rawElapsedMinutes(session, now)).toBe(440)
    expect(creditedDurationMinutes(session, settings, now)).toBe(240)
    expect(needsConfirmation(session, settings, now)).toBe(true)
  })

  it("credits a full 5h session after Still Studying at 4h", () => {
    const start = "2026-08-26T10:00:00.000Z"
    const confirmed = "2026-08-26T14:00:00.000Z"
    const end = "2026-08-26T15:00:00.000Z"
    const session = running(start, confirmed)
    expect(creditedDurationMinutes(session, settings, new Date(end))).toBe(300)
    const done = {
      ...session,
      status: "completed" as const,
      endAt: end,
      durationMinutes: 300,
      confirmedThroughAt: end,
    }
    expect(creditedDurationMinutes(done, settings, new Date(end))).toBe(300)
  })

  it("does not auto-credit overnight time until the actual end is entered", () => {
    const start = "2026-08-25T19:00:00.000Z"
    const morning = new Date("2026-08-26T09:00:00.000Z")
    const session = running(start)
    expect(isStaleRunning(session, settings, "UTC", morning)).toBe(true)
    expect(creditedDurationMinutes(session, settings, morning)).toBe(240)
    const actualEnd = "2026-08-25T22:00:00.000Z"
    const done = {
      ...session,
      status: "completed" as const,
      endAt: actualEnd,
      durationMinutes: durationMinutes(start, actualEnd),
      confirmedThroughAt: actualEnd,
    }
    expect(done.durationMinutes).toBe(180)
    expect(creditedDurationMinutes(done, settings, morning)).toBe(180)
  })

  it("treats a previous-calendar-day long session as stale, not a same-day 4h session", () => {
    const overnight = running("2026-08-25T19:00:00.000Z")
    const morning = new Date("2026-08-26T09:00:00.000Z")
    expect(isStaleRunning(overnight, settings, "UTC", morning)).toBe(true)
    const sameDayLong = running("2026-08-26T00:00:00.000Z")
    const later = new Date("2026-08-26T13:00:00.000Z")
    expect(needsConfirmation(sameDayLong, settings, later)).toBe(true)
    expect(isStaleRunning(sameDayLong, settings, "UTC", later)).toBe(false)
  })

  it("warns at 3 hours without blocking, and does not warn before that", () => {
    const start = "2026-08-26T10:00:00.000Z"
    expect(needsWarning(running(start), settings, new Date("2026-08-26T12:59:00.000Z"))).toBe(false)
    expect(needsWarning(running(start), settings, new Date("2026-08-26T13:00:00.000Z"))).toBe(true)
    expect(needsConfirmation(running(start), settings, new Date("2026-08-26T13:00:00.000Z"))).toBe(false)
  })
})
