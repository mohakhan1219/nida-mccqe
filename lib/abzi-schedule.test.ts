import { describe, expect, it } from "vitest"
import {
  ABZI_CLASS_COUNT,
  ABZI_COURSE_TIMEZONE,
  ABZI_EVENT_COUNT,
  ABZI_SEED_DEFS,
  ABZI_TEST_COUNT,
  buildAbziSeedEvents,
  classCompleted,
  computeAbziProgress,
  mergeAbziSchedule,
  normalizeScheduleEvent,
  testRecorded,
} from "@/lib/abzi-schedule"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

describe("ABZI 2026 schedule seed", () => {
  it("seeds exactly 33 events: 22 classes and 11 tests in chronological order", () => {
    const events = buildAbziSeedEvents()
    expect(ABZI_SEED_DEFS).toHaveLength(ABZI_EVENT_COUNT)
    expect(events).toHaveLength(ABZI_EVENT_COUNT)
    expect(events.filter((e) => e.eventType === "Class")).toHaveLength(ABZI_CLASS_COUNT)
    expect(events.filter((e) => e.eventType === "MCQ Test")).toHaveLength(ABZI_TEST_COUNT)

    const dates = events.map((e) => e.date)
    expect([...dates].sort()).toEqual(dates)

    const nov01 = events.find((e) => e.date === "2026-11-01")
    const nov03 = events.find((e) => e.date === "2026-11-03")
    expect(nov01?.topics).toEqual(["ENT", "Statistics"])
    expect(nov03?.topics).toEqual(["New Objectives", "Public Health"])
    expect(nov03?.title).toContain("New Objectives")
    expect(events.filter((e) => e.date === "2026-11-01")).toHaveLength(1)
    expect(events.filter((e) => e.date === "2026-11-03")).toHaveLength(1)
  })

  it("stores Eastern wall times with America/New_York across the Nov DST transition", () => {
    const events = buildAbziSeedEvents()
    for (const e of events) {
      expect(e.timezone).toBe(ABZI_COURSE_TIMEZONE)
      expect(e.startTime).toBe("20:00")
      expect(e.endTime).toBe("23:00")
    }

    const before = fromZonedTime("2026-10-30T20:00:00", ABZI_COURSE_TIMEZONE)
    expect(formatInTimeZone(before, ABZI_COURSE_TIMEZONE, "yyyy-MM-dd HH:mm")).toBe("2026-10-30 20:00")
    expect(formatInTimeZone(before, "UTC", "yyyy-MM-dd HH:mm")).toBe("2026-10-31 00:00")

    const after = fromZonedTime("2026-11-06T20:00:00", ABZI_COURSE_TIMEZONE)
    expect(formatInTimeZone(after, ABZI_COURSE_TIMEZONE, "yyyy-MM-dd HH:mm")).toBe("2026-11-06 20:00")
    expect(formatInTimeZone(after, "UTC", "yyyy-MM-dd HH:mm")).toBe("2026-11-07 01:00")

    expect(events.find((e) => e.date === "2026-11-01")?.date).toBe("2026-11-01")
    expect(events.find((e) => e.date === "2026-11-06")?.date).toBe("2026-11-06")
  })

  it("does not duplicate or overwrite user edits on re-seed", () => {
    const first = mergeAbziSchedule([])
    expect(first.inserted).toHaveLength(ABZI_EVENT_COUNT)
    expect(first.schedule).toHaveLength(ABZI_EVENT_COUNT)

    const edited = first.schedule.map((e) =>
      e.date === "2026-10-02"
        ? normalizeScheduleEvent({
            ...e,
            startTime: "19:30",
            endTime: "22:30",
            timeTentative: false,
            notes: "Confirmed by Abzi",
          })
        : e
    )
    const second = mergeAbziSchedule(edited)
    expect(second.inserted).toHaveLength(0)
    expect(second.schedule).toHaveLength(ABZI_EVENT_COUNT)
    const oct2 = second.schedule.find((e) => e.date === "2026-10-02")
    expect(oct2?.startTime).toBe("19:30")
    expect(oct2?.endTime).toBe("22:30")
    expect(oct2?.notes).toBe("Confirmed by Abzi")
    expect(oct2?.timeTentative).toBe(false)
  })

  it("counts attendance without inventing completion from calendar date alone", () => {
    const { schedule } = mergeAbziSchedule([])
    const cardiology = schedule.find((e) => e.date === "2026-09-27")!
    expect(classCompleted(cardiology)).toBe(false)

    const attended = normalizeScheduleEvent({ ...cardiology, attendance: "attended" })
    expect(classCompleted(attended)).toBe(true)

    const progress = computeAbziProgress(
      schedule.map((e) => (e.id === attended.id ? attended : e)),
      "2026-10-01",
      "2026-09-28",
      "2026-10-05"
    )
    expect(progress.classesAttended).toBe(1)
    expect(progress.testsRecorded).toBe(0)
    expect(progress.pastOpen.some((e) => e.date === "2026-09-29")).toBe(true)

    const friday = schedule.find((e) => e.date === "2026-10-02")!
    expect(testRecorded(friday)).toBe(false)
    const linked = normalizeScheduleEvent({ ...friday, linkedAssessmentId: "block-1" })
    expect(testRecorded(linked)).toBe(true)
  })
})
