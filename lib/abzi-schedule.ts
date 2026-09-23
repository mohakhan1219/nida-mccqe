import type { Course, ScheduleEvent, WorkspaceSnapshot } from "@/lib/types"

/** Course wall-clock timezone for the 2026 ABZI schedule (IANA — respects DST). */
export const ABZI_COURSE_TIMEZONE = "America/New_York"

export const ABZI_COURSE_ID = "course:abzi"
export const ABZI_SOURCE_ID = "source:abzi"
export const ABZI_EXAM_TYPE_ID = "assessment_type:abzi-exam"

export const ABZI_CLASS_COUNT = 22
export const ABZI_TEST_COUNT = 11
export const ABZI_EVENT_COUNT = 33

const CLASS_START = "20:00"
const CLASS_END = "23:00"

type SeedKind = "class" | "test"

type SeedDef = {
  date: string
  kind: SeedKind
  /** Display title (single-topic class or MCQ Test). */
  title: string
  /** Topic labels shown independently; multi-topic class dates share one time block. */
  topics: string[]
  /** Catalog subject when a clear match exists; never invent a mapping for "New Objectives". */
  subjectId: string | null
}

/**
 * Initial ABZI 2026 schedule — 22 teaching dates + 11 Friday tests = 33 events.
 * Nov 01 and Nov 03 are one class date each with two topics (not two concurrent 3h blocks).
 */
export const ABZI_SEED_DEFS: SeedDef[] = [
  { date: "2026-09-27", kind: "class", title: "Cardiology", topics: ["Cardiology"], subjectId: "subject:cardiology" },
  { date: "2026-09-29", kind: "class", title: "Endocrinology", topics: ["Endocrinology"], subjectId: "subject:endocrinology" },
  { date: "2026-10-02", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
  { date: "2026-10-04", kind: "class", title: "Hematology", topics: ["Hematology"], subjectId: "subject:hematology" },
  { date: "2026-10-06", kind: "class", title: "Pulmonology", topics: ["Pulmonology"], subjectId: "subject:pulmonology" },
  { date: "2026-10-09", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
  { date: "2026-10-11", kind: "class", title: "Neurology", topics: ["Neurology"], subjectId: "subject:neurology" },
  { date: "2026-10-13", kind: "class", title: "Ophthalmology", topics: ["Ophthalmology"], subjectId: "subject:ophthalmology" },
  { date: "2026-10-16", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
  { date: "2026-10-18", kind: "class", title: "Orthopedics", topics: ["Orthopedics"], subjectId: "subject:orthopedics" },
  { date: "2026-10-20", kind: "class", title: "Rheumatology", topics: ["Rheumatology"], subjectId: "subject:rheumatology" },
  { date: "2026-10-23", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
  { date: "2026-10-25", kind: "class", title: "Gastroenterology", topics: ["Gastroenterology"], subjectId: "subject:gastroenterology" },
  { date: "2026-10-27", kind: "class", title: "Dermatology", topics: ["Dermatology"], subjectId: "subject:dermatology" },
  { date: "2026-10-30", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
  {
    date: "2026-11-01",
    kind: "class",
    title: "ENT / Statistics",
    topics: ["ENT", "Statistics"],
    subjectId: null,
  },
  {
    date: "2026-11-03",
    kind: "class",
    title: "New Objectives / Public Health",
    topics: ["New Objectives", "Public Health"],
    subjectId: null,
  },
  { date: "2026-11-06", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
  { date: "2026-11-08", kind: "class", title: "Ethics", topics: ["Ethics"], subjectId: "subject:ethics" },
  { date: "2026-11-10", kind: "class", title: "Ethics", topics: ["Ethics"], subjectId: "subject:ethics" },
  { date: "2026-11-13", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
  { date: "2026-11-15", kind: "class", title: "Psychiatry", topics: ["Psychiatry"], subjectId: "subject:psychiatry" },
  { date: "2026-11-17", kind: "class", title: "Psychiatry", topics: ["Psychiatry"], subjectId: "subject:psychiatry" },
  { date: "2026-11-20", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
  { date: "2026-11-22", kind: "class", title: "Obstetrics (OB)", topics: ["Obstetrics"], subjectId: "subject:obstetrics" },
  { date: "2026-11-24", kind: "class", title: "Gynecology (Gyn)", topics: ["Gynecology"], subjectId: null },
  { date: "2026-11-27", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
  { date: "2026-11-29", kind: "class", title: "Pediatrics", topics: ["Pediatrics"], subjectId: "subject:pediatrics" },
  { date: "2026-12-01", kind: "class", title: "Pediatrics", topics: ["Pediatrics"], subjectId: "subject:pediatrics" },
  { date: "2026-12-04", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
  { date: "2026-12-06", kind: "class", title: "Emergency Medicine", topics: ["Emergency Medicine"], subjectId: "subject:emergency-medicine" },
  { date: "2026-12-08", kind: "class", title: "General Surgery", topics: ["General Surgery"], subjectId: "subject:general-surgery" },
  { date: "2026-12-11", kind: "test", title: "MCQ Test", topics: ["MCQ Test"], subjectId: null },
]

export function abziExternalId(date: string, kind: SeedKind): string {
  return `abzi:2026:${date}:${kind}`
}

/** Deterministic UUID so cloud + preview seeds stay idempotent across devices. */
export function deterministicUuid(key: string): string {
  const bytes = new Uint8Array(16)
  let h = 2166136261 >>> 0
  const input = `nida-abzi-v1:${key}`
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 16777619) >>> 0
    bytes[i % 16] ^= (h >>> ((i % 4) * 8)) & 0xff
  }
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 16; i++) {
      h = Math.imul(h ^ bytes[i] ^ round, 16777619) >>> 0
      bytes[i] = (bytes[i] + (h & 0xff)) & 0xff
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function buildAbziSeedEvents(): ScheduleEvent[] {
  return ABZI_SEED_DEFS.map((def) => {
    const externalId = abziExternalId(def.date, def.kind)
    return normalizeScheduleEvent({
      id: deterministicUuid(externalId),
      date: def.date,
      startTime: CLASS_START,
      endTime: CLASS_END,
      timezone: ABZI_COURSE_TIMEZONE,
      eventType: def.kind === "class" ? "Class" : "MCQ Test",
      subjectId: def.subjectId,
      courseId: ABZI_COURSE_ID,
      status: "scheduled",
      notes: "",
      title: def.title,
      topics: def.topics,
      externalId,
      attendance: null,
      prepDone: false,
      practiceDone: false,
      reviewDone: false,
      timeTentative: def.kind === "test",
      linkedAssessmentId: null,
    })
  })
}

export function normalizeScheduleEvent(row: Partial<ScheduleEvent> & Pick<ScheduleEvent, "id" | "date">): ScheduleEvent {
  const topics = Array.isArray(row.topics)
    ? row.topics.map(String).filter(Boolean)
    : row.title
      ? [String(row.title)]
      : []
  return {
    id: row.id,
    date: row.date,
    startTime: row.startTime ?? "20:00",
    endTime: row.endTime ?? "23:00",
    timezone: row.timezone ?? ABZI_COURSE_TIMEZONE,
    eventType: row.eventType ?? "Class",
    subjectId: row.subjectId ?? null,
    courseId: row.courseId ?? null,
    status: row.status ?? "scheduled",
    notes: row.notes ?? "",
    title: row.title ?? topics[0] ?? row.eventType ?? "Event",
    topics: topics.length ? topics : [row.title ?? row.eventType ?? "Event"],
    externalId: row.externalId ?? null,
    attendance: row.attendance ?? null,
    prepDone: Boolean(row.prepDone),
    practiceDone: Boolean(row.practiceDone),
    reviewDone: Boolean(row.reviewDone),
    timeTentative: Boolean(row.timeTentative),
    linkedAssessmentId: row.linkedAssessmentId ?? null,
  }
}

/**
 * Insert missing ABZI seed rows by externalId. Never overwrites existing rows
 * (user edits to time/title/notes/attendance survive reload and re-seed).
 */
export function mergeAbziSchedule(existing: ScheduleEvent[]): {
  schedule: ScheduleEvent[]
  inserted: ScheduleEvent[]
} {
  const normalized = existing.map((row) => normalizeScheduleEvent(row))
  const byExternal = new Map(
    normalized.filter((r) => r.externalId).map((r) => [r.externalId as string, r] as const)
  )
  const inserted: ScheduleEvent[] = []
  for (const seed of buildAbziSeedEvents()) {
    if (seed.externalId && byExternal.has(seed.externalId)) continue
    inserted.push(seed)
    if (seed.externalId) byExternal.set(seed.externalId, seed)
  }
  if (!inserted.length) {
    return { schedule: normalized, inserted }
  }
  const schedule = [...normalized, ...inserted].sort(compareScheduleEvents)
  return { schedule, inserted }
}

export function compareScheduleEvents(a: ScheduleEvent, b: ScheduleEvent) {
  return `${a.date}${a.startTime}${a.title}`.localeCompare(`${b.date}${b.startTime}${b.title}`)
}

export function isAbziEvent(row: ScheduleEvent) {
  return row.courseId === ABZI_COURSE_ID || Boolean(row.externalId?.startsWith("abzi:"))
}

export function isAbziClass(row: ScheduleEvent) {
  return isAbziEvent(row) && row.eventType !== "MCQ Test"
}

export function isAbziTest(row: ScheduleEvent) {
  return isAbziEvent(row) && row.eventType === "MCQ Test"
}

export function eventDisplayTitle(row: ScheduleEvent) {
  if (row.title?.trim()) return row.title.trim()
  if (row.topics?.length) return row.topics.join(" / ")
  return row.eventType
}

export function formatEventClockRange(row: ScheduleEvent) {
  const start = toDisplayClock(row.startTime)
  const end = toDisplayClock(row.endTime)
  return `${start}–${end}`
}

function toDisplayClock(hhmm: string) {
  const [hs, ms] = hhmm.split(":").map(Number)
  const h = hs ?? 0
  const m = ms ?? 0
  const suffix = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, "0")} ${suffix}`
}

export function classCompleted(row: ScheduleEvent) {
  return isAbziClass(row) && row.attendance === "attended"
}

export function testRecorded(row: ScheduleEvent) {
  return isAbziTest(row) && (Boolean(row.linkedAssessmentId) || row.attendance === "attended")
}

export type AbziProgress = {
  classesTotal: number
  classesAttended: number
  testsTotal: number
  testsRecorded: number
  upcoming: ScheduleEvent | null
  thisWeek: ScheduleEvent[]
  pastOpen: ScheduleEvent[]
  all: ScheduleEvent[]
}

export function abziEvents(schedule: ScheduleEvent[]) {
  return schedule.filter(isAbziEvent).sort(compareScheduleEvents)
}

export function computeAbziProgress(schedule: ScheduleEvent[], todayKey: string, weekStart: string, weekEndExclusive: string): AbziProgress {
  const all = abziEvents(schedule)
  const classes = all.filter(isAbziClass)
  const tests = all.filter(isAbziTest)
  const upcoming =
    all.find((row) => row.status !== "cancelled" && row.date >= todayKey && !classCompleted(row) && !testRecorded(row)) ??
    all.find((row) => row.status !== "cancelled" && row.date >= todayKey) ??
    null
  const thisWeek = all.filter(
    (row) => row.status !== "cancelled" && row.date >= weekStart && row.date < weekEndExclusive
  )
  const pastOpen = all.filter(
    (row) =>
      row.status !== "cancelled" &&
      row.date < todayKey &&
      !classCompleted(row) &&
      !testRecorded(row)
  )
  return {
    classesTotal: classes.length || ABZI_CLASS_COUNT,
    classesAttended: classes.filter(classCompleted).length,
    testsTotal: tests.length || ABZI_TEST_COUNT,
    testsRecorded: tests.filter(testRecorded).length,
    upcoming,
    thisWeek,
    pastOpen,
    all,
  }
}

export function ensureAbziCourseMeta(courses: Course[]): Course[] {
  return courses.map((c) => {
    if (c.id !== ABZI_COURSE_ID) return c
    return {
      ...c,
      startDate: c.startDate ?? "2026-09-27",
      targetEndDate: c.targetEndDate ?? "2026-12-11",
      status: c.status === "not_started" ? "active" : c.status,
      notes:
        c.notes === "Schedule not added yet." || !c.notes.trim()
          ? "ABZI 2026 course schedule (33 events: 22 classes + 11 Friday MCQ tests). Attendance and test logs are tracked separately from study hours and readiness."
          : c.notes,
    }
  })
}

export function applyAbziSeedToSnapshot(snapshot: WorkspaceSnapshot): {
  snapshot: WorkspaceSnapshot
  inserted: ScheduleEvent[]
} {
  const { schedule, inserted } = mergeAbziSchedule(snapshot.schedule)
  return {
    snapshot: {
      ...snapshot,
      schedule,
      courses: ensureAbziCourseMeta(snapshot.courses),
    },
    inserted,
  }
}
