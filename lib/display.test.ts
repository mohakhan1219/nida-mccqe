import { describe, expect, it } from "vitest"
import {
  evidenceBandLabel,
  formatLastActivity,
  goalCountCopy,
  goalHoursCopy,
  goalProgress,
  humanizeSettingKey,
  overallStageLabel,
  showReadinessPercent,
  subjectDisplayStatus,
  subjectHealthCopy,
  warmCopy,
  weeklyGoalsHeadline,
} from "@/lib/display"

describe("readiness display gating", () => {
  it("hides a numeric score while the baseline is still forming", () => {
    expect(showReadinessPercent({ state: "building_baseline", confidence: "insufficient" })).toBe(false)
    expect(showReadinessPercent({ state: "building_baseline", confidence: "low" })).toBe(false)
    expect(showReadinessPercent({ state: "progressing", confidence: "insufficient" })).toBe(false)
    expect(showReadinessPercent({ state: "progressing", confidence: "moderate" })).toBe(true)
  })

  it("maps overall stages without using Exam Ready until a date is booked", () => {
    expect(overallStageLabel("ready_to_book", null)).toBe("Ready to Book")
    expect(overallStageLabel("ready_to_book", "2027-01-15")).toBe("Exam Ready")
    expect(overallStageLabel("building_baseline", null)).toBe("Building Foundation")
  })

  it("never labels a subject Exam Ready", () => {
    expect(subjectDisplayStatus("strong")).toBe("Strong")
    expect(subjectDisplayStatus("not_started")).toBe("Not Started")
    expect(subjectDisplayStatus("not_enough_data")).toBe("Started")
    expect(subjectDisplayStatus("needs_focus")).toBe("Needs Review")
    expect(subjectDisplayStatus("progressing")).toBe("In Progress")
  })

  it("treats insufficient evidence as Low on the hero", () => {
    expect(evidenceBandLabel("insufficient")).toBe("Low")
    expect(evidenceBandLabel("high")).toBe("High")
  })
})

describe("weekly goals are never caps", () => {
  it("reports achievement above 100%", () => {
    const over = goalProgress(30, 24)
    expect(over.percent).toBeCloseTo(125)
    expect(over.bar).toBe(100)
    expect(over.status).toBe("exceeded")
    expect(goalHoursCopy(30, 24)).toContain("125%")
    expect(goalHoursCopy(30, 24)).toContain("Goal exceeded")
    expect(goalCountCopy(300, 240)).toContain("300 of 240")
    expect(goalCountCopy(300, 240)).toContain("125%")
  })

  it("marks exact completion as goal met", () => {
    expect(goalProgress(24, 24).status).toBe("met")
    expect(goalHoursCopy(24, 24)).toContain("Goal met")
    expect(goalProgress(18, 24).percent).toBeCloseTo(75)
    expect(goalProgress(18, 24).status).toBe("progress")
  })
})

describe("last activity and weekly goal headlines", () => {
  it("formats recent activity as relative or Today", () => {
    const now = new Date("2026-08-25T22:43:00.000Z")
    expect(formatLastActivity("2026-08-25T22:09:00.000Z", "UTC", now)).toBe("34 min ago")
    expect(formatLastActivity("2026-08-25T18:43:00.000Z", "UTC", now)).toBe("Today, 6:43 PM")
    expect(formatLastActivity(null)).toBe("No activity yet")
  })

  it("shows uncapped weekly percents plus Goal Met / Exceeded", () => {
    const hours = goalProgress(0.5, 24)
    const questions = goalProgress(80, 240)
    expect(weeklyGoalsHeadline(hours, questions).line).toBe("2% hours · 33% questions")
    expect(weeklyGoalsHeadline(hours, questions).status).toBeNull()
    expect(weeklyGoalsHeadline(goalProgress(24, 24), goalProgress(240, 240)).status).toBe("Goal Met")
    expect(weeklyGoalsHeadline(goalProgress(30, 24), goalProgress(240, 240)).status).toBe("Goal Exceeded")
  })
})

describe("settings and subject-health labels", () => {
  it("humanizes camelCase setting keys", () => {
    expect(humanizeSettingKey("recentAccuracy")).toBe("Recent Accuracy")
    expect(humanizeSettingKey("reviewHygiene")).toBe("Review Hygiene")
    expect(humanizeSettingKey("courseProgress")).toBe("Course Progress")
  })

  it("labels subject health as n / 100 without calling it exam ready", () => {
    expect(subjectHealthCopy(63)).toBe("63 / 100")
    expect(subjectHealthCopy(null)).toBe("—")
  })

  it("warms judgmental session copy", () => {
    expect(warmCopy("Keep logging honest sessions. Mock exams can wait until volume is more stable.")).toBe(
      "Keep building your study record. Mock exams can wait until volume is more stable."
    )
  })
})
