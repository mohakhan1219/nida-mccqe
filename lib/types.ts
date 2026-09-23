export type Role = "primary" | "admin"

export type CatalogKind =
  | "subject"
  | "source"
  | "activity"
  | "assessment_type"
  | "error_type"
  | "review_status"
  | "priority"

export type CatalogItem = {
  id: string
  kind: CatalogKind
  slug: string
  name: string
  active: boolean
  sortOrder: number
  meta: {
    weight?: number
    scored?: boolean
    countsAsMock?: boolean
    defaultCountAsStudySession?: boolean
    sourceKind?: "qbank" | "course" | "self" | "other"
    core?: boolean
  }
}

export type ReadinessWeights = {
  accuracy: number
  recentAccuracy: number
  trend: number
  coverage: number
  weakFloor: number
  mocks: number
  reviewHygiene: number
  consistency: number
  courseProgress: number
}

export type Settings = {
  studentName: string
  examName: string
  examDate: string | null
  timezone: string
  weekStartsOn: 1
  dailyHourGoal: number
  dailyQuestionGoal: number
  weeklyHourGoal: number
  weeklyQuestionGoal: number
  accuracyGoal: number
  reviewIntervals: [number, number, number]
  minQuestionsForSubject: number
  minQuestionsForBaseline: number
  minStudyDaysForBaseline: number
  volumeHalfLife: number
  accuracyPriorStrength: number
  minMocksForReady: number
  mockScoreBar: number
  readyScoreThreshold: number
  gettingCloseThreshold: number
  progressingThreshold: number
  weakSubjectFloor: number
  overdueReviewCap: number
  coverageReadyRatio: number
  highConfidenceMin: number
  moderateConfidenceMin: number
  weights: ReadinessWeights
  warnSessionHours: number
  longSessionWarningHours: number
  confirmSessionHours: number
}

export type StudySession = {
  id: string
  subjectId: string
  sourceId: string
  activityId: string
  topic: string
  startAt: string
  endAt: string | null
  durationMinutes: number | null
  entryMode: "timer" | "manual"
  status: "running" | "completed"
  notes: string
  linkedAssessmentId: string | null
  planned: boolean
  confidence: number | null
  energy: number | null
  confirmedThroughAt: string | null
  createdAt: string
  updatedAt: string
}

export type QuestionBlock = {
  id: string
  subjectId: string
  sourceId: string
  assessmentTypeId: string
  topic: string
  startAt: string
  endAt: string
  durationMinutes: number
  total: number
  correct: number
  incorrect: number
  skipped: number
  timedMode: "timed" | "tutor"
  attemptState: "first_pass" | "repeat" | "review"
  notes: string
  linkedSessionId: string | null
  createdAt: string
  updatedAt: string
}

export type TestMock = {
  id: string
  subjectId: string
  sourceId: string
  assessmentTypeId: string
  testName: string
  startAt: string
  endAt: string
  durationMinutes: number
  total: number
  correct: number
  incorrect: number
  skipped: number
  rank: string
  strongAreas: string
  weakAreas: string
  reviewCompleted: boolean
  notes: string
  linkedSessionId: string | null
  createdAt: string
  updatedAt: string
}

export type IncorrectReview = {
  id: string
  sourceKind: "block" | "test" | "manual"
  sourceId: string | null
  subjectId: string
  providerId: string
  topic: string
  questionCount: number
  errorTypeId: string
  reason: string
  correctConcept: string
  priority: "high" | "medium" | "low"
  status: "pending" | "in_review" | "completed"
  firstReviewAt: string | null
  secondReviewAt: string | null
  thirdReviewAt: string | null
  tutorQuestion: string
  flashcardCreated: boolean
  notes: string
  createdAt: string
  updatedAt: string
}

export type Course = {
  id: string
  name: string
  type: "course" | "notes" | "qbank" | "schedule" | "resource"
  startDate: string | null
  targetEndDate: string | null
  totalUnits: number | null
  completedUnits: number
  totalQuestions: number | null
  completedQuestions: number
  currentSubjectId: string | null
  status: "not_started" | "active" | "paused" | "completed"
  notes: string
}

export type ScheduleAttendance = "attended" | "missed" | null

export type ScheduleEvent = {
  id: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  eventType: string
  subjectId: string | null
  courseId: string | null
  status: "scheduled" | "completed" | "cancelled"
  notes: string
  /** Display title (e.g. Cardiology, MCQ Test, ENT / Statistics). */
  title: string
  /** Topic labels for multi-topic class dates; one shared time block. */
  topics: string[]
  /** Deterministic seed key — used for idempotent import; never overwrite on re-seed. */
  externalId: string | null
  /** Class attendance; independent of calendar date and study-session hours. */
  attendance: ScheduleAttendance
  prepDone: boolean
  practiceDone: boolean
  reviewDone: boolean
  /** Friday MCQ times are provisional until confirmed. */
  timeTentative: boolean
  /** Link to an existing question block / Abzi exam assessment id. */
  linkedAssessmentId: string | null
}

export type MotivationMessage = {
  id: string
  index: number
  theme: string
  message: string
}

export type WorkspaceSnapshot = {
  workspaceId: string
  profile: {
    userId: string
    email: string
    displayName: string
    role: Role
  }
  settings: Settings
  catalogs: CatalogItem[]
  sessions: StudySession[]
  blocks: QuestionBlock[]
  tests: TestMock[]
  reviews: IncorrectReview[]
  courses: Course[]
  schedule: ScheduleEvent[]
  quotes: MotivationMessage[]
}

export type BackupFile = {
  version: 1
  exportedAt: string
  snapshot: Omit<WorkspaceSnapshot, "profile" | "workspaceId"> & {
    workspaceName: string
  }
}

export type ReadinessState =
  | "building_baseline"
  | "not_ready"
  | "progressing"
  | "getting_close"
  | "ready_to_book"

export type EvidenceConfidence = "insufficient" | "low" | "moderate" | "high"

export type SubjectStatus =
  | "not_started"
  | "not_enough_data"
  | "developing"
  | "progressing"
  | "strong"
  | "needs_focus"
