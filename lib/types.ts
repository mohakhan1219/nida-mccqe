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
  /** Suggested preparation target (not a booking). Persisted once when eligible. */
  suggestedExamDate: string | null
  suggestedExamCreatedAt: string | null
  timezone: string
  weekStartsOn: 1
  dailyHourGoal: number
  dailyQuestionGoal: number
  weeklyHourGoal: number
  weeklyQuestionGoal: number
  /** Readiness-engine accuracy goal (existing composite). */
  accuracyGoal: number
  /** Personal eligible-question performance benchmark (Phase 1: 72%). */
  questionAccuracyGoal: number
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
  /** Auto-end a paused session after this many minutes (effective end = pause time). */
  pauseAutoEndMinutes: number
  /** Calendar days ahead for a suggested exam target once evidence gates pass. */
  suggestedExamHorizonDays: number
  /** Provisional evidence gates for auto-suggesting an exam target. */
  /** Minimum eligible answered questions before a 100-day target may be suggested (default 4000). */
  minEligibleQuestionsForTarget: number
  minSubjectsForTarget: number
  minMocksForTarget: number
}

export type SessionPauseInterval = {
  pausedAt: string
  resumedAt: string | null
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
  status: "running" | "paused" | "completed"
  notes: string
  linkedAssessmentId: string | null
  planned: boolean
  confidence: number | null
  energy: number | null
  confirmedThroughAt: string | null
  /** Completed and open pause intervals; break time is excluded from study credit. */
  pauseLog: SessionPauseInterval[]
  createdAt: string
  updatedAt: string
}

export type QBankSnapshot = {
  id: string
  sourceId: string
  asOfDate: string
  totalAvailable: number | null
  used: number | null
  unused: number | null
  correct: number | null
  incorrect: number | null
  skipped: number | null
  notes: string
  createdAt: string
  updatedAt: string
}

export type HighYieldPriority = "very_high" | "high" | "medium" | "low"
export type HighYieldStatus = "not_started" | "in_progress" | "completed" | "needs_review"

export type HighYieldTopic = {
  id: string
  subject: string
  topic: string
  priority: HighYieldPriority
  status: HighYieldStatus
  notes: string
  source: string
  sortOrder: number
  updatedAt: string
  createdAt: string
}

export type ExamPlanningState =
  | "not_ready_to_plan"
  | "building_evidence"
  | "target_eligible"
  | "target_date_suggested"
  | "exam_booked"

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
  qbankSnapshots: QBankSnapshot[]
  highYieldTopics: HighYieldTopic[]
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
