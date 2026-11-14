import { describe, expect, it } from "vitest"
import { isOfficialExamBooked, officialExamDate, unconfirmedExamDateOnFile } from "@/lib/official-exam"

describe("official exam booking", () => {
  it("requires explicit confirmation", () => {
    expect(
      isOfficialExamBooked({ examDate: "2026-01-16", examBookedConfirmed: false })
    ).toBe(false)
    expect(officialExamDate({ examDate: "2026-01-16", examBookedConfirmed: false })).toBeNull()
    expect(unconfirmedExamDateOnFile({ examDate: "2026-01-16", examBookedConfirmed: false })).toBe(
      "2026-01-16"
    )
  })

  it("returns the date only when confirmed", () => {
    expect(
      officialExamDate({ examDate: "2027-05-01", examBookedConfirmed: true })
    ).toBe("2027-05-01")
    expect(unconfirmedExamDateOnFile({ examDate: "2027-05-01", examBookedConfirmed: true })).toBeNull()
  })
})
