"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type {
  CatalogItem,
  Course,
  HighYieldTopic,
  IncorrectReview,
  PracticeAssessment,
  QBankSnapshot,
  QuestionBlock,
  ScheduleEvent,
  Settings,
  StudySession,
  TestMock,
  WorkspaceSnapshot,
} from "@/lib/types"
import { mergeFilipeSantosCatalog } from "@/lib/high-yield"
import { scorePctFromTotals } from "@/lib/practice-assessments"
import {
  DEFAULT_CATALOGS,
  DEFAULT_COURSES,
  DEFAULT_SETTINGS,
  defaultQuotes,
  emptySnapshot,
} from "@/lib/catalogs"
import { applyAbziSeedToSnapshot, normalizeScheduleEvent } from "@/lib/abzi-schedule"
import { backupToPartial, snapshotToBackup } from "@/lib/backup"
import { durationMinutes, nowIso } from "@/lib/dates"
import { computeExamPlanning, withSuggestedExamTarget } from "@/lib/exam-planning"
import { newId } from "@/lib/format"
import { countsValid } from "@/lib/metrics"
import {
  reconcilePausedSession,
  withPauseStarted,
  withResume,
  withSessionEnded,
} from "@/lib/session-pause"
import { studyCreditMinutes } from "@/lib/session-pause"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/browser"
import { deriveStats, runningSession } from "@/lib/stats"
import { computeReadiness } from "@/lib/readiness"
import type { BackupFile } from "@/lib/types"

const LOCAL_KEY = "nida-medical-os-preview-v1"

type SaveBlockInput = {
  subjectId: string
  sourceId: string
  assessmentTypeId: string
  topic?: string
  startAt: string
  endAt: string
  total: number
  correct: number
  incorrect: number
  skipped: number
  timedMode?: QuestionBlock["timedMode"]
  attemptState?: QuestionBlock["attemptState"]
  notes?: string
  countAsStudySession: boolean
  sendIncorrectsToReview: boolean
  kind: "block" | "test"
  testName?: string
  /** Optional link from a Friday ABZI event to this assessment. */
  scheduleEventId?: string
}

type Ctx = {
  mode: "cloud" | "preview"
  configured: boolean
  loading: boolean
  error: string | null
  snapshot: WorkspaceSnapshot
  stats: ReturnType<typeof deriveStats>
  readiness: ReturnType<typeof computeReadiness>
  running: StudySession | null
  refresh: () => Promise<void>
  punchIn: (input: {
    subjectId: string
    sourceId: string
    activityId: string
    topic?: string
  }) => Promise<void>
  punchOut: (input?: { endAt?: string; notes?: string; topic?: string }) => Promise<void>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  confirmStillStudying: () => Promise<void>
  discardRunning: () => Promise<void>
  saveQBankSnapshot: (row: Omit<QBankSnapshot, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<void>
  deleteQBankSnapshot: (id: string) => Promise<void>
  upsertHighYieldTopic: (row: HighYieldTopic) => Promise<void>
  deleteHighYieldTopic: (id: string) => Promise<void>
  ensureHighYieldCatalogImported: () => Promise<{ added: number; updatedMeta: number }>
  upsertPracticeAssessment: (row: PracticeAssessment) => Promise<void>
  completePracticeAssessment: (
    id: string,
    results: {
      completedDate: string
      total: number
      correct: number
      incorrect: number
      scorePct?: number | null
      notes?: string
    }
  ) => Promise<void>
  deletePracticeAssessment: (id: string) => Promise<void>
  confirmOfficialExamBooking: (examDate: string) => Promise<void>
  clearMistakenExamDate: () => Promise<void>
  resetSuggestedExamTarget: () => Promise<void>
  saveManualSession: (input: {
    subjectId: string
    sourceId: string
    activityId: string
    topic?: string
    startAt: string
    endAt: string
    notes?: string
  }) => Promise<void>
  saveAssessment: (input: SaveBlockInput) => Promise<void>
  updateSession: (row: StudySession) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  updateBlock: (row: QuestionBlock) => Promise<void>
  deleteBlock: (id: string) => Promise<void>
  updateTest: (row: TestMock) => Promise<void>
  deleteTest: (id: string) => Promise<void>
  upsertReview: (row: IncorrectReview) => Promise<void>
  deleteReview: (id: string) => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  updateCatalogItem: (item: CatalogItem) => Promise<void>
  addCatalogItem: (item: CatalogItem) => Promise<void>
  updateCourse: (row: Course) => Promise<void>
  upsertSchedule: (row: ScheduleEvent) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>
  updateQuotes: (quotes: WorkspaceSnapshot["quotes"]) => Promise<void>
  exportBackup: () => Blob
  restoreBackup: (file: BackupFile) => Promise<void>
  signOut: () => Promise<void>
}

const WorkspaceContext = createContext<Ctx | null>(null)

function mergeSnapshot(raw: Partial<WorkspaceSnapshot> | null): WorkspaceSnapshot {
  const base = emptySnapshot()
  if (!raw) return base
  return {
    ...base,
    ...raw,
    settings: { ...DEFAULT_SETTINGS, ...raw.settings },
    catalogs: raw.catalogs?.length ? raw.catalogs : DEFAULT_CATALOGS,
    courses: raw.courses?.length ? raw.courses : DEFAULT_COURSES,
    quotes: raw.quotes?.length ? raw.quotes : defaultQuotes(),
    sessions: (raw.sessions ?? []).map((s) => ({
      ...s,
      confirmedThroughAt: s.confirmedThroughAt ?? null,
      pauseLog: Array.isArray(s.pauseLog) ? s.pauseLog : [],
    })),
    blocks: raw.blocks ?? [],
    tests: raw.tests ?? [],
    reviews: raw.reviews ?? [],
    schedule: (raw.schedule ?? []).map((row) => normalizeScheduleEvent(row)),
    qbankSnapshots: raw.qbankSnapshots ?? [],
    highYieldTopics: (raw.highYieldTopics ?? []).map((t) => ({
      ...t,
      catalogKey: t.catalogKey ?? null,
    })),
    practiceAssessments: raw.practiceAssessments ?? [],
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured()
  const mode: "cloud" | "preview" = configured ? "cloud" : "preview"
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const persistLocal = useCallback((next: WorkspaceSnapshot) => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
    setSnapshot(next)
  }, [])

  const loadLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      const merged = mergeSnapshot(raw ? JSON.parse(raw) : null)
      const missingCats = DEFAULT_CATALOGS.filter((c) => !merged.catalogs.some((x) => x.id === c.id))
      const withCats = missingCats.length
        ? { ...merged, catalogs: [...merged.catalogs, ...missingCats] }
        : merged
      const sessions = withCats.sessions.map((s) => reconcilePausedSession(s, withCats.settings))
      let settings = withCats.settings
      const { snapshot: seeded } = applyAbziSeedToSnapshot({ ...withCats, sessions })
      const planning = computeExamPlanning(seeded, deriveStats(seeded))
      if (planning.shouldCreateSuggestedTarget && planning.proposedSuggestedDate) {
        settings = withSuggestedExamTarget(settings, planning.proposedSuggestedDate)
      }
      const hy = mergeFilipeSantosCatalog(seeded.highYieldTopics)
      persistLocal({
        ...seeded,
        settings,
        highYieldTopics: hy.topics,
        practiceAssessments: seeded.practiceAssessments ?? [],
      })
    } catch {
      const { snapshot: seeded } = applyAbziSeedToSnapshot(emptySnapshot())
      const hy = mergeFilipeSantosCatalog(seeded.highYieldTopics)
      persistLocal({
        ...seeded,
        highYieldTopics: hy.topics,
        practiceAssessments: seeded.practiceAssessments ?? [],
      })
    }
  }, [persistLocal])

  const loadCloud = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError("Please sign in.")
      return
    }
    const { data: profile, e