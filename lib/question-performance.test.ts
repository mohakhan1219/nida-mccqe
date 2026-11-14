import { describe, expect, it } from "vitest"
import { emptySnapshot } from "@/lib/catalogs"
import {
  buildQBankDashboard,
  computeEligibleQuestionPerformance,
  reconcileSourcePerformance,
  validateQBankSnapshotInput,
} from "@/lib/question-performance"
import type { QBankSnapshot, QuestionBlock } from "@/lib/types"

function block(partial: Partial<QuestionBlock> & Pick<QuestionBlock, "id" | "correct" | "incorrect">): QuestionBlock {
  return {
    subjectId: "subject:cardiology",
    sourceId: "source:uworld",
    assessmentTypeId: "assessment_type:uworld-block",
    topic: "",
    startAt: "2026-09-01T12:00:00.000Z",
    endAt: "2026-09-01T13:00:00.000Z",
    durationMinutes: 60,
    total: partial.correct + partial.incorrect + (partial.skipped ?? 0),
    skipped: 0,
    timedMode: "timed",
    attemptState: "first_pass",
    notes: "",
    linkedSessionId: null,
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    ...partial,
  }
}

describe("qbank reconciliation", () => {
  it("does not double-count app logs covered by a cumulative snapshot", () => {
    const snap = emptySnapshot()
    snap.blocks = [
      block({ id: "1", correct: 300, incorrect: 200, startAt: "2026-08-01T12:00:00.000Z", endAt: "2026-08-01T13:00:00.000Z" }),
      block({ id: "2", correct: 40, incorrect: 10, startAt: "2026-10-01T12:00:00.000Z", endAt: "2026-10-01T13:00:00.000Z" }),
    ]
    const platform: QBankSnapshot = {
      id: "qs1",
      sourceId: "source:uworld",
      asOfDate: "2026-09-15",
      totalAvailable: 3000,
      used: 2000,
      unused: 1000,
      correct: 1400,
      incorrect: 600,
      skipped: 0,
      notes: "",
      createdAt: "2026-09-16T00:00:00.000Z",
      updatedAt: "2026-09-16T00:00:00.000Z",
    }
    snap.qbankSnapshots = [platform]
    const row = reconcileSourcePerformance(snap, "source:uworld")
    expect(row.reconciledAnswered).toBe(2050) // 2000 snapshot + 50 after
    expect(row.reconciledCorrect).toBe(1440)
    expect(row.overlapFlag).toBe("possible_overlap")
    expect(row.appOverlapAnswered).toBe(500)
  })

  it("uses weighted eligible totals, not average of percents", () => {
    const snap = emptySnapshot()
    snap.blocks = [
      block({ id: "1", sourceId: "source:uworld", correct: 90, incorrect: 10 }),
      block({
        id: "2",
        sourceId: "source:mcc-practice",
        correct: 20,
        incorrect: 80,
        assessmentTypeId: "assessment_type:mcc-practice-test",
      }),
    ]
    const perf = computeEligibleQuestionPerformance(snap)
    // (90+20)/(100+100) = 55%, not average of 90% and 20%
    expect(perf.accuracy).toBeCloseTo(0.55)
    expect(perf.accuracyPct).toBe(55)
  })

  it("warns when platform stats do not add cleanly", () => {
    const warnings = validateQBankSnapshotInput({
      totalAvailable: 100,
      used: 60,
      unused: 30,
      correct: 40,
      incorrect: 10,
      skipped: 5,
    })
    expect(warnings.length).toBeGreaterThan(0)
  })

  it("builds a central dashboard for UWorld, ACE, MCC practice, and ABZI without inventing totals", () => {
    const snap = emptySnapshot()
    const rows = buildQBankDashboard(snap)
    expect(rows.map((r) => r.slug)).toEqual(["uworld", "ace-qbank", "mcc-practice", "abzi"])
    for (const row of rows) {
      expect(row.usedOrCompleted).toBeNull()
      expect(row.remaining).toBeNull()
      expect(row.lastUpdated).toBeNull()
      expect(row.accuracy).toBeNull()
    }
  })

  it("counts ABZI and MCC practice in the eligible pool without double-counting snapshot overlap", () => {
    const snap = emptySnapshot()
    snap.tests = [
      {
        id: "abzi1",
        subjectId: "subject:cardiology",
        sourceId: "source:abzi",
        assessmentTypeId: "assessment_type:abzi-exam",
        testName: "ABZI MCQ",
        startAt: "2026-10-02T12:00:00.000Z",
        endAt: "2026-10-02T15:00:00.000Z",
        durationMinutes: 180,
        total: 50,
        correct: 35,
        incorrect: 15,
        skipped: 0,
        rank: "",
        strongAreas: "",
        weakAreas: "",
        reviewCompleted: false,
        notes: "",
        linkedSessionId: null,
        createdAt: "2026-10-02T12:00:00.000Z",
        updatedAt: "2026-10-02T12:00:00.000Z",
      },
    ]
    snap.qbankSnapshots = [
      {
        id: "uw",
        sourceId: "source:uworld",
        asOfDate: "2026-09-15",
        totalAvailable: 3000,
        used: 2000,
        unused: 1000,
        correct: 1440,
        incorrect: 560,
        skipped: 0,
        notes: "",
        createdAt: "2026-09-16T00:00:00.000Z",
        updatedAt: "2026-09-16T00:00:00.000Z",
      },
    ]
    snap.blocks = [
      block({
        id: "overlap",
        correct: 100,
        incorrect: 50,
        startAt: "2026-08-01T12:00:00.000Z",
        endAt: "2026-08-01T13:00:00.000Z",
      }),
    ]
    const perf = computeEligibleQuestionPerformance(snap)
    // 2000 UWorld snapshot + 50 ABZI; 150 overlapping UWorld app logs excluded
    expect(perf.answered).toBe(2050)
    expect(perf.correct).toBe(1475)
    const dash = buildQBankDashboard(snap)
    expect(dash.find((r) => r.slug === "uworld")?.usedOrCompleted).toBe(2000)
    expect(dash.find((r) => r.slug === "abzi")?.reconciledAnswered).toBe(50)
  })
})
