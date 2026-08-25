import { describe, expect, it } from "vitest"
import {
  evidenceBandLabel,
  goalCountCopy,
  goalHoursCopy,
  goalProgress,
  overallStageLabel,
  showReadinessPercent,
  subjectDisplayStatus,
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
