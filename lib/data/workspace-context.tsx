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
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
    if (pErr) throw pErr
    if (!profile) {
      setError(
        "This login is not a member of the household workspace. Create Nida in Supabase Auth first, or add this user to public.profiles."
      )
      return
    }
    const wid = profile.workspace_id as string

    const [
      settingsRes,
      catalogsRes,
      sessionsRes,
      blocksRes,
      testsRes,
      reviewsRes,
      coursesRes,
      scheduleRes,
      quotesRes,
      qbankRes,
      highYieldRes,
      practiceRes,
    ] = await Promise.all([
      supabase.from("settings").select("data").eq("workspace_id", wid).maybeSingle(),
      supabase.from("catalog_items").select("*").eq("workspace_id", wid),
      supabase.from("study_sessions").select("*").eq("workspace_id", wid).order("start_at"),
      supabase.from("question_blocks").select("*").eq("workspace_id", wid).order("start_at"),
      supabase.from("tests_mocks").select("*").eq("workspace_id", wid).order("start_at"),
      supabase.from("incorrect_reviews").select("*").eq("workspace_id", wid).order("created_at"),
      supabase.from("courses").select("*").eq("workspace_id", wid),
      supabase.from("schedule_events").select("*").eq("workspace_id", wid).order("event_date"),
      supabase.from("motivation_messages").select("*").eq("workspace_id", wid).order("idx"),
      supabase.from("qbank_snapshots").select("*").eq("workspace_id", wid).order("as_of_date"),
      supabase.from("high_yield_topics").select("*").eq("workspace_id", wid).order("sort_order"),
      supabase.from("practice_assessments").select("*").eq("workspace_id", wid).order("scheduled_date"),
    ])

    let catalogs = (catalogsRes.data ?? []).map(mapCatalog)
    if (catalogs.length === 0) {
      await supabase.from("catalog_items").upsert(
        DEFAULT_CATALOGS.map((c) => ({
          workspace_id: wid,
          id: c.id,
          kind: c.kind,
          slug: c.slug,
          name: c.name,
          active: c.active,
          sort_order: c.sortOrder,
          meta: c.meta,
        }))
      )
      catalogs = DEFAULT_CATALOGS
    } else {
      const missing = DEFAULT_CATALOGS.filter((c) => !catalogs.some((x) => x.id === c.id))
      if (missing.length) {
        await supabase.from("catalog_items").upsert(
          missing.map((c) => ({
            workspace_id: wid,
            id: c.id,
            kind: c.kind,
            slug: c.slug,
            name: c.name,
            active: c.active,
            sort_order: c.sortOrder,
            meta: c.meta,
          }))
        )
        catalogs = [...catalogs, ...missing]
      }
    }

    let courses = (coursesRes.data ?? []).map(mapCourse)
    if (courses.length === 0) {
      await supabase.from("courses").upsert(
        DEFAULT_COURSES.map((c) => ({
          workspace_id: wid,
          id: c.id,
          slug: c.id.replace("course:", ""),
          name: c.name,
          type: c.type,
          start_date: c.startDate,
          target_end_date: c.targetEndDate,
          total_units: c.totalUnits,
          completed_units: c.completedUnits,
          total_questions: c.totalQuestions,
          completed_questions: c.completedQuestions,
          current_subject_id: c.currentSubjectId,
          status: c.status,
          notes: c.notes,
        }))
      )
      courses = DEFAULT_COURSES
    }

    let quotes = (quotesRes.data ?? []).map((q: Record<string, unknown>) => ({
      id: String(q.id),
      index: Number(q.idx),
      theme: String(q.theme),
      message: String(q.message),
    }))
    if (quotes.length === 0) {
      const seeded = defaultQuotes()
      await supabase.from("motivation_messages").upsert(
        seeded.map((q) => ({
          workspace_id: wid,
          id: q.id,
          idx: q.index,
          theme: q.theme,
          message: q.message,
        }))
      )
      quotes = seeded
    }

    const 