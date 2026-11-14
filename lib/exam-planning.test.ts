import { describe, expect, it } from "vitest"
import { examCountdownCopy, computeExamPlanning } from "@/lib/exam-planning"
import { emptySnapshot, DEFAULT_SETTINGS } from "@/lib/catalogs"
import { deriveStats } from "@/lib/stats"
import type { QuestionBlock, TestMock, WorkspaceSnapshot } from "@/lib/types"

describe("exam countdown copy", () => {
  it("never shows a negative countdown as on track", () => {
    expect(examCountdownCopy(null, null).copy).toBe("Exam not booked yet.")
    expect(examCountdownCopy("2025-01-01", -301).copy).toBe("Exam date passed — update exam date.")
    expect(examCountdownCopy("2027-01-01", 40).copy).toBe("40 days remaining")
  })
})

describe("100-day suggested target gates", () => {
  it("defaults the answered-question gate to 4,000", () => {
    expect(DEFAULT_SETTINGS.minEligibleQuestionsForTarget).toBe(4000)
  })

  it("does not create a target from insufficient evidence", () => {
    const snap = emptySnapshot()
    snap.settings = {
      ...DEFAULT_SETTINGS,
      examDate: null,
      suggestedExamDate: null,
      minEligibleQuestionsForTarget: 4000,
      questionAccuracyGoal: 0.72,
    }
    const report = computeExamPlanning(snap, deriveStats(snap), null)
    expect(report.shouldCreateSuggestedTarget).toBe(false)
    expect(report.state).toBe("not_ready_to_plan")
  })

  it("becomes eligible only with weighted accuracy and evidence gates", () => {
    const snap = emptySnapshot() as WorkspaceSnapshot
    snap.settings = {
      ...DEFAULT_SETTINGS,
      examDate: null,
      suggestedExamDate: null,
      minEligibleQuestionsForTarget: 50,
      minSubjectsForTarget: 2,
      minMocksForTarget: 1,
      questionAccuracyGoal: 0.72,
    }
    const mkBlock = (subjectId: string, correct: number, incorrect: number, i: number): QuestionBlock => ({
      id: `b${i}`,
      subjectId,
      sourceId: "source:uworld",
      assessmentTypeId: "assessment_type:uworld-block",
      topic: "",
      startAt: `2026-10-${String(10 + (i % 15)).padStart(2, "0")}T12:00:00.000Z`,
      endAt: `2026-10-${String(10 + (i % 15)).padStart(2, "0")}T13:00:00.000Z`,
      durationMinutes: 60,
      total: correct + incorrect,
      correct,
      incorrect,
      skipped: 0,
      timedMode: "timed",
      attemptState: "first_pass",
      notes: "",
      linkedSessionId: null,
      createdAt: "2026-10-10T12:00:00.000Z",
      updatedAt: "2026-10-10T12:00:00.000Z",
    })
    snap.blocks = [
      mkBlock("subject:cardiology", 40, 10, 1),
      mkBlock("subject:neurology", 36, 14, 2),
    ]
    const mock: TestMock = {
      id: "t1",
      subjectId: "subject:mixed",
      sourceId: "source:mcc-practice",
      assessmentTypeId: "assessment_type:mcc-practice-test",
      testName: "MCC Practice",
      startAt: "2026-10-20T12:00:00.000Z",
      endAt: "2026-10-20T15:00:00.000Z",
      durationMinutes: 180,
      total: 100,
      correct: 78,
      incorrect: 22,
      skipped: 0,
      rank: "",
      strongAreas: "",
      weakAreas: "",
      reviewCompleted: false,
      notes: "",
      linkedSessionId: null,
      createdAt: "2026-10-20T12:00:00.000Z",
      updatedAt: "2026-10-20T12:00:00.000Z",
    }
    snap.tests = [mock]
    const report = computeExamPlanning(snap, deriveStats(snap), null)
    expect(report.meetsAccuracyBenchmark).toBe(true)
    expect(report.shouldCreateSuggestedTarget).toBe(true)
    expect(report.proposedSuggestedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
