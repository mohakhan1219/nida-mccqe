import { describe, expect, it } from "vitest"
import {
  breakMinutesSoFar,
  reconcilePausedSession,
  studyCreditMinutes,
  withPauseStarted,
  withResume,
  withSessionEnded,
} from "@/lib/session-pause"
import type { StudySession } from "@/lib/types"

const settings = { pauseAutoEndMinutes: 60 }

function base(startAt: string): StudySession {
  return {
    id: "s1",
    subjectId: "subject:cardiology",
    sourceId: "source:uworld",
    activityId: "activity:question-practice",
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
    confirmedThroughAt: null,
    pauseLog: [],
    createdAt: startAt,
    updatedAt: startAt,
  }
}

describe("session pause / resume / auto-end", () => {
  it("excludes break time from study credit across multiple pause cycles", () => {
    const start = "2026-11-13T12:00:00.000Z"
    let session = base(start)
    session = withPauseStarted(session, "2026-11-13T13:00:00.000Z") // 60m study
    session = withResume(session, "2026-11-13T13:20:00.000Z") // 20m break
    session = withPauseStarted(session, "2026-11-13T14:00:00.000Z") // +40m study
    session = withResume(session, "2026-11-13T14:10:00.000Z") // 10m break
    const now = new Date("2026-11-13T14:30:00.000Z") // +20m study
    expect(studyCreditMinutes(session, now)).toBe(120)
    expect(breakMinutesSoFar(session, now)).toBe(30)
  })

  it("freezes credited study time while paused", () => {
    const start = "2026-11-13T12:00:00.000Z"
    let session = withPauseStarted(base(start), "2026-11-13T13:00:00.000Z")
    expect(studyCreditMinutes(session, new Date("2026-11-13T13:00:00.000Z"))).toBe(60)
    expect(studyCreditMinutes(session, new Date("2026-11-13T13:45:00.000Z"))).toBe(60)
  })

  it("auto-ends at the pause timestamp after 60 minutes paused", () => {
    const start = "2026-11-13T12:00:00.000Z"
    const paused = withPauseStarted(base(start), "2026-11-13T13:00:00.000Z")
    const ended = reconcilePausedSession(paused, settings, new Date("2026-11-13T14:05:00.000Z"))
    expect(ended.status).toBe("completed")
    expect(ended.endAt).toBe("2026-11-13T13:00:00.000Z")
    expect(ended.durationMinutes).toBe(60)
  })

  it("does not auto-end before 60 minutes paused", () => {
    const start = "2026-11-13T12:00:00.000Z"
    const paused = withPauseStarted(base(start), "2026-11-13T13:00:00.000Z")
    const same = reconcilePausedSession(paused, settings, new Date("2026-11-13T13:59:00.000Z"))
    expect(same.status).toBe("paused")
  })

  it("ending while paused uses the pause timestamp", () => {
    const start = "2026-11-13T12:00:00.000Z"
    const paused = withPauseStarted(base(start), "2026-11-13T13:00:00.000Z")
    const ended = withSessionEnded(paused, "2026-11-13T13:40:00.000Z")
    expect(ended.endAt).toBe("2026-11-13T13:00:00.000Z")
    expect(ended.durationMinutes).toBe(60)
  })
})
