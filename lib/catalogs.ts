import type { CatalogItem, MotivationMessage, Settings } from "@/lib/types"
import { QUOTES } from "@/lib/quotes"

function item(
  kind: CatalogItem["kind"],
  slug: string,
  name: string,
  sortOrder: number,
  meta: CatalogItem["meta"] = {},
  active = true
): CatalogItem {
  return {
    id: `${kind}:${slug}`,
    kind,
    slug,
    name,
    active,
    sortOrder,
    meta,
  }
}

export const SUBJECTS: CatalogItem[] = [
  ["cardiology", "Cardiology", true],
  ["dermatology", "Dermatology", true],
  ["emergency-medicine", "Emergency Medicine", true],
  ["endocrinology", "Endocrinology", true],
  ["ent", "ENT", true],
  ["ethics", "Ethics", true],
  ["family-medicine", "Family Medicine", true],
  ["gastroenterology", "Gastroenterology", true],
  ["general-surgery", "General Surgery", true],
  ["geriatrics", "Geriatrics", true],
  ["hematology", "Hematology", true],
  ["infectious-diseases", "Infectious Diseases", true],
  ["nephrology", "Nephrology", true],
  ["neurology", "Neurology", true],
  ["obstetrics", "Obstetrics", true],
  ["oncology", "Oncology", true],
  ["ophthalmology", "Ophthalmology", true],
  ["orthopedics", "Orthopedics", true],
  ["pediatrics", "Pediatrics", true],
  ["psychiatry", "Psychiatry", true],
  ["public-health", "Public Health", true],
  ["pulmonology", "Pulmonology", true],
  ["rheumatology", "Rheumatology", true],
  ["urology", "Urology", true],
  ["womens-health", "Women's Health", true],
  ["biostatistics", "Biostatistics", true],
  ["preventive-medicine", "Preventive Medicine", true],
  ["communication", "Communication", true],
  ["other", "Other", false],
  ["mixed", "Mixed / Full exam", false],
].map(([slug, name, core], i) =>
  item("subject", String(slug), String(name), i, {
    weight: core ? 1 : slug === "other" ? 0.25 : 0,
    scored: slug !== "mixed",
    core: Boolean(core),
  })
)

export const SOURCES: CatalogItem[] = [
  item("source", "uworld", "UWorld", 0, { sourceKind: "qbank" }),
  item("source", "abzi", "Abzi", 1, { sourceKind: "course" }),
  item("source", "toronto-notes", "Toronto Notes", 2, { sourceKind: "course" }),
  item("source", "medcognito", "Medcognito", 3, { sourceKind: "course" }),
  item("source", "self-study", "Self Study", 4, { sourceKind: "self" }),
  item("source", "canadaqbank", "CanadaQBank", 5, { sourceKind: "qbank" }),
  item("source", "mcc-practice", "MCC Practice", 6, { sourceKind: "qbank" }),
  item("source", "other", "Other", 7, { sourceKind: "other" }),
]

export const ACTIVITIES: CatalogItem[] = [
  item("activity", "lecture", "Lecture", 0),
  item("activity", "reading", "Reading", 1),
  item("activity", "video", "Video", 2),
  item("activity", "content-review", "Content Review", 3),
  item("activity", "notes", "Notes", 4),
  item("activity", "question-practice", "Question practice", 5),
  item("activity", "incorrect-review", "Incorrect Review", 6),
  item("activity", "flashcards", "Flashcards", 7),
  item("activity", "tutor-discussion", "Tutor Discussion", 8),
  item("activity", "revision", "Revision", 9),
  item("activity", "other", "Other", 10),
]

export const ASSESSMENT_TYPES: CatalogItem[] = [
  item("assessment_type", "uworld-block", "UWorld block", 0, {
    defaultCountAsStudySession: true,
  }),
  item("assessment_type", "abzi-exam", "Abzi exam", 1, {
    defaultCountAsStudySession: true,
  }),
  item("assessment_type", "weekly-test", "Weekly Test", 2, {
    countsAsMock: false,
    defaultCountAsStudySession: true,
  }),
  item("assessment_type", "subject-test", "Subject Test", 3, {
    defaultCountAsStudySession: true,
  }),
  item("assessment_type", "uworld-sa", "UWorld Self-Assessment", 4, {
    countsAsMock: true,
    defaultCountAsStudySession: true,
  }),
  item("assessment_type", "mcc-practice-test", "MCC Practice Test", 5, {
    countsAsMock: true,
    defaultCountAsStudySession: true,
  }),
  item("assessment_type", "full-mock", "Full Mock Exam", 6, {
    countsAsMock: true,
    defaultCountAsStudySession: true,
  }),
  item("assessment_type", "practice-test", "Practice Test", 7, {
    defaultCountAsStudySession: true,
  }),
  item("assessment_type", "course-test", "Course Test", 8, {
    defaultCountAsStudySession: true,
  }),
  item("assessment_type", "other", "Other", 9, {
    defaultCountAsStudySession: true,
  }),
]

export const ERROR_TYPES: CatalogItem[] = [
  item("error_type", "knowledge-gap", "Knowledge Gap", 0),
  item("error_type", "misread", "Misread Question", 1),
  item("error_type", "diagnostic", "Diagnostic Error", 2),
  item("error_type", "management", "Management Error", 3),
  item("error_type", "ethics-comm", "Ethics or Communication", 4),
  item("error_type", "time-pressure", "Time Pressure", 5),
  item("error_type", "changed-answer", "Changed Correct Answer", 6),
  item("error_type", "guess", "Guess", 7),
  item("error_type", "other", "Other", 8),
]

export const DEFAULT_CATALOGS: CatalogItem[] = [
  ...SUBJECTS,
  ...SOURCES,
  ...ACTIVITIES,
  ...ASSESSMENT_TYPES,
  ...ERROR_TYPES,
]

export const DEFAULT_SETTINGS: Settings = {
  studentName: "Dr. Nida",
  examName: "MCCQE1",
  examDate: null,
  timezone: "America/Toronto",
  weekStartsOn: 1,
  dailyHourGoal: 4,
  dailyQuestionGoal: 40,
  weeklyHourGoal: 24,
  weeklyQuestionGoal: 240,
  accuracyGoal: 0.75,
  reviewIntervals: [1, 7, 21],
  minQuestionsForSubject: 15,
  minQuestionsForBaseline: 80,
  minStudyDaysForBaseline: 5,
  volumeHalfLife: 400,
  accuracyPriorStrength: 40,
  minMocksForReady: 2,
  mockScoreBar: 0.75,
  readyScoreThreshold: 78,
  gettingCloseThreshold: 65,
  progressingThreshold: 45,
  weakSubjectFloor: 60,
  overdueReviewCap: 8,
  coverageReadyRatio: 0.7,
  highConfidenceMin: 75,
  moderateConfidenceMin: 50,
  warnSessionHours: 8,
  longSessionWarningHours: 3,
  confirmSessionHours: 4,
  weights: {
    accuracy: 18,
    recentAccuracy: 18,
    trend: 8,
    coverage: 14,
    weakFloor: 12,
    mocks: 15,
    reviewHygiene: 7,
    consistency: 8,
    courseProgress: 5,
  },
}

export const DEFAULT_COURSES = [
  {
    id: "course:abzi",
    name: "Abzi",
    type: "course" as const,
    startDate: null,
    targetEndDate: null,
    totalUnits: null,
    completedUnits: 0,
    totalQuestions: null,
    completedQuestions: 0,
    currentSubjectId: null,
    status: "not_started" as const,
    notes: "ABZI 2026 course schedule (33 events). Attendance tracked separately from study hours.",
  },
  {
    id: "course:medcognito",
    name: "Medcognito",
    type: "course" as const,
    startDate: null,
    targetEndDate: null,
    totalUnits: null,
    completedUnits: 0,
    totalQuestions: null,
    completedQuestions: 0,
    currentSubjectId: null,
    status: "not_started" as const,
    notes: "",
  },
  {
    id: "course:toronto-notes",
    name: "Toronto Notes",
    type: "notes" as const,
    startDate: null,
    targetEndDate: null,
    totalUnits: null,
    completedUnits: 0,
    totalQuestions: null,
    completedQuestions: 0,
    currentSubjectId: null,
    status: "not_started" as const,
    notes: "",
  },
  {
    id: "course:uworld",
    name: "UWorld",
    type: "qbank" as const,
    startDate: null,
    targetEndDate: null,
    totalUnits: null,
    completedUnits: 0,
    totalQuestions: null,
    completedQuestions: 0,
    currentSubjectId: null,
    status: "not_started" as const,
    notes: "",
  },
  {
    id: "course:felipe",
    name: "Felipe schedule",
    type: "schedule" as const,
    startDate: null,
    targetEndDate: null,
    totalUnits: null,
    completedUnits: 0,
    totalQuestions: null,
    completedQuestions: 0,
    currentSubjectId: null,
    status: "not_started" as const,
    notes: "",
  },
  {
    id: "course:other",
    name: "Other resources",
    type: "resource" as const,
    startDate: null,
    targetEndDate: null,
    totalUnits: null,
    completedUnits: 0,
    totalQuestions: null,
    completedQuestions: 0,
    currentSubjectId: null,
    status: "not_started" as const,
    notes: "",
  },
]

export function defaultQuotes(): MotivationMessage[] {
  return QUOTES.map((q, i) => ({
    id: `quote:${i + 1}`,
    index: i + 1,
    theme: q.theme,
    message: q.message,
  }))
}

export function emptySnapshot(): import("@/lib/types").WorkspaceSnapshot {
  return {
    workspaceId: "preview-workspace",
    profile: {
      userId: "preview-user",
      email: "",
      displayName: "Dr. Nida",
      role: "primary",
    },
    settings: structuredClone(DEFAULT_SETTINGS),
    catalogs: structuredClone(DEFAULT_CATALOGS),
    sessions: [],
    blocks: [],
    tests: [],
    reviews: [],
    courses: structuredClone(DEFAULT_COURSES),
    schedule: [],
    quotes: defaultQuotes(),
  }
}

export function catalogByKind(items: CatalogItem[], kind: CatalogItem["kind"]) {
  return items
    .filter((c) => c.kind === kind && c.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function findCatalog(items: CatalogItem[], id: string) {
  return items.find((c) => c.id === id)
}
