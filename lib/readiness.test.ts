import { describe, expect, it } from "vitest"
import { emptySnapshot } from "@/lib/catalogs"
import { durationMinutes, resolveAssessmentWindow } from "@/lib/dates"
import { accuracyOf, countsValid, scoreOf, shrinkAccuracy, volumeFactor } from "@/lib/metrics"
import { computeReadiness } from "@/lib/readiness"
import { deriveStats } from "@/lib/stats"
import { backupToPartial, snapshotToBackup } from "@/lib/backup"
import type { QuestionBlock, TestMock, WorkspaceSnapshot } from "@/lib/types"

function block(
  snapshot: WorkspaceSnapshot,
  overrides: Partial<QuestionBlock> & { correct: number; incorrect: number; skipped: number; total: number }
): QuestionBlock {
  const subject = snapshot.catalogs.find((c) => c.slug === "neurology")!.id
  const source = snapshot.catalogs.find((c) => c.slug === "uworld")!.id
  const type = snapshot.catalogs.find((c) => c.slug === "uworld-block")!.id
  return {
    id: crypto.randomUUID(),
    subjectId: subject,
    sourceId: source,
    assessmentTypeId: type,
    topic: "",
    startAt: overrides.startAt ?? "2026-08-01T14:00:00.000Z",
    endAt: overrides.endAt ?? "2026-08-01T15:00:00.000Z",
    durationMinutes: 60,
    timedMode: "timed",
    attemptState: "first_pass",
    notes: "",
    linkedSessionId: null,
    createdAt: "2026-08-01T15:00:00.000Z",
    updatedAt: "2026-08-01T15:00:00.000Z",
    ...overrides,
  }
}

function mockExam(snapshot: WorkspaceSnapshot, scoreCorrect: number, total = 100, startAt: string): TestMock {
  const subject = snapshot.catalogs.find((c) => c.slug === "mixed")!.id
  const source = snapshot.catalogs.find((c) => c.slug === "mcc-practice")!.id
  const type = snapshot.catalogs.find((c) => c.slug === "full-mock")!.id
  return {
    id: crypto.randomUUID(),
    subjectId: subject,
    sourceId: source,
    assessmentTypeId: type,
    testName: "Full mock",
    startAt,
    endAt: startAt,
    durationMinutes: 240,
    total,
    correct: scoreCorrect,
    incorrect: total - scoreCorrect,
    skipped: 0,
    rank: "",
    strongAreas: "",
    weakAreas: "",
    reviewCompleted: true,
    notes: "",
    linkedSessionId: null,
    createdAt: startAt,
    updatedAt: startAt,
  }
}

describe("counts and accuracy", () => {
  it("treats skipped as excluded from accuracy", () => {
    expect(accuracyOf({ correct: 30, incorrect: 8 })).toBeCloseTo(30 / 38)
    expect(scoreOf({ correct: 30, total: 40 })).toBeCloseTo(0.75)
    expect(countsValid({ total: 40, correct: 30, incorrect: 8, skipped: 2 })).toBe(true)
    expect(countsValid({ total: 40, correct: 35, incorrect: 8, skipped: 2 })).toBe(false)
  })

  it("computes overnight duration", () => {
    expect(durationMinutes("2026-08-01T22:00:00.000Z", "2026-08-02T02:00:00.000Z")).toBe(240)
  })

  it("lets a question block save without optional times", () => {
    const now = new Date("2026-08-25T21:51:00.000Z")
    const window = resolveAssessmentWindow({ now })
    expect(new Date(window.endAt).getTime()).toBeGreaterThan(new Date(window.startAt).getTime())
    expect(durationMinutes(window.startAt, window.endAt)).toBe(1)
  })

  it("still rejects inverted optional times", () => {
    expect(() =>
      resolveAssessmentWindow({
        startLocal: "2026-08-25T12:00",
        endLocal: "2026-08-25T11:00",
      })
    ).toThrow(/after start time/)
  })
})

describe("readiness evidence", () => {
  it("empty snapshot is building baseline with no fake score pressure", () => {
    const snap = emptySnapshot()
    const stats = deriveStats(snap, new Date("2026-08-25T15:00:00Z"))
    const report = computeReadiness(snap, stats)
    expect(report.state).toBe("building_baseline")
    expect(stats.lifetimeQuestions).toBe(0)
    expect(stats.subjects.every((s) => s.status === "not_started")).toBe(true)
  })

  it("does not treat 50 questions at 80% like 2000 questions at 80%", () => {
    const small = emptySnapshot()
    small.blocks = [
      block(small, {
        total: 50,
        correct: 40,
        incorrect: 10,
        skipped: 0,
        startAt: "2026-08-20T14:00:00.000Z",
        endAt: "2026-08-20T15:00:00.000Z",
      }),
    ]
    const large = emptySnapshot()
    large.blocks = Array.from({ length: 40 }, (_, i) =>
      block(large, {
        id: crypto.randomUUID(),
        total: 50,
        correct: 40,
        incorrect: 10,
        skipped: 0,
        startAt: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T14:00:00.000Z`,
        endAt: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T15:00:00.000Z`,
      })
    )
    const sSmall = deriveStats(small, new Date("2026-08-25T15:00:00Z"))
    const sLarge = deriveStats(large, new Date("2026-08-25T15:00:00Z"))
    const rSmall = computeReadiness(small, sSmall)
    const rLarge = computeReadiness(large, sLarge)
    expect(sSmall.lifetimeAccuracy).toBeCloseTo(0.8)
    expect(sLarge.lifetimeAccuracy).toBeCloseTo(0.8)
    expect(rLarge.confidenceScore).toBeGreaterThan(rSmall.confidenceScore)
    expect(rSmall.state).not.toBe("ready_to_book")
    expect(rLarge.state).not.toBe("ready_to_book")
  })

  it("cannot be ready to book without mocks even with high volume", () => {
    const snap = emptySnapshot()
    snap.blocks = Array.from({ length: 50 }, (_, i) =>
      block(snap, {
        id: crypto.randomUUID(),
        total: 40,
        correct: 32,
        incorrect: 8,
        skipped: 0,
        startAt: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T14:00:00.000Z`,
        endAt: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T15:00:00.000Z`,
      })
    )
    const stats = deriveStats(snap, new Date("2026-08-25T15:00:00Z"))
    const report = computeReadiness(snap, stats)
    expect(report.state).not.toBe("ready_to_book")
    expect(report.blockers.some((b) => /mock/i.test(b))).toBe(true)
  })

  it("shrinks small samples toward the accuracy goal", () => {
    const goal = 0.75
    const small = shrinkAccuracy(8, 10, goal, 40)!
    const large = shrinkAccuracy(1600, 2000, goal, 40)!
    expect(small).toBeLessThan(0.8)
    expect(large).toBeGreaterThan(small)
    expect(volumeFactor(50, 400)).toBeLessThan(volumeFactor(2000, 400))
  })
})

describe("empty workspace and backup", () => {
  it("ships 90 quotes and no preloaded study history", () => {
    const snap = emptySnapshot()
    expect(snap.quotes).toHaveLength(90)
    expect(snap.sessions).toHaveLength(0)
    expect(snap.blocks).toHaveLength(0)
    expect(snap.tests).toHaveLength(0)
    expect(snap.reviews).toHaveLength(0)
    expect(snap.schedule).toHaveLength(0)
    expect(snap.settings.examDate).toBeNull()
  })

  it("round-trips schedule through backup JSON", () => {
    const snap = emptySnapshot()
    snap.schedule = [
      {
        id: "evt-1",
        date: "2026-09-01",
        startTime: "09:00",
        endTime: "11:00",
        timezone: "America/Toronto",
        eventType: "Lecture",
        subjectId: "subject:cardiology",
        courseId: "course:abzi",
        status: "scheduled",
        notes: "",
      },
    ]
    const file = snapshotToBackup(snap)
    const restored = backupToPartial(file)
    expect(restored.schedule).toHaveLength(1)
    expect(restored.schedule[0].courseId).toBe("course:abzi")
    expect(restored.sessions).toHaveLength(0)
  })
})
