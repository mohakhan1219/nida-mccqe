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
  IncorrectReview,
  QuestionBlock,
  ScheduleEvent,
  Settings,
  StudySession,
  TestMock,
  WorkspaceSnapshot,
} from "@/lib/types"
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
import { newId } from "@/lib/format"
import { countsValid } from "@/lib/metrics"
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
  confirmStillStudying: () => Promise<void>
  discardRunning: () => Promise<void>
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
    })),
    blocks: raw.blocks ?? [],
    tests: raw.tests ?? [],
    reviews: raw.reviews ?? [],
    schedule: (raw.schedule ?? []).map((row) => normalizeScheduleEvent(row)),
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
      const { snapshot: seeded } = applyAbziSeedToSnapshot(merged)
      persistLocal(seeded)
    } catch {
      const { snapshot: seeded } = applyAbziSeedToSnapshot(emptySnapshot())
      persistLocal(seeded)
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

    const settings = {
      ...DEFAULT_SETTINGS,
      ...((settingsRes.data?.data as Partial<Settings>) ?? {}),
    }

    let schedule = (scheduleRes.data ?? []).map(mapSchedule)
    const seeded = applyAbziSeedToSnapshot({
      workspaceId: wid,
      profile: {
        userId: user.id,
        email: user.email ?? "",
        displayName: profile.display_name,
        role: profile.role,
      },
      settings,
      catalogs,
      sessions: (sessionsRes.data ?? []).map(mapSession),
      blocks: (blocksRes.data ?? []).map(mapBlock),
      tests: (testsRes.data ?? []).map(mapTest),
      reviews: (reviewsRes.data ?? []).map(mapReview),
      courses,
      schedule,
      quotes,
    })
    if (seeded.inserted.length) {
      await supabase.from("schedule_events").upsert(seeded.inserted.map((r) => scheduleRow(r, wid)))
      schedule = seeded.snapshot.schedule
    } else {
      schedule = seeded.snapshot.schedule
    }
    const abziBefore = courses.find((c) => c.id === "course:abzi")
    courses = seeded.snapshot.courses
    const abziAfter = courses.find((c) => c.id === "course:abzi")
    if (
      abziAfter &&
      (abziBefore?.notes !== abziAfter.notes ||
        abziBefore?.startDate !== abziAfter.startDate ||
        abziBefore?.targetEndDate !== abziAfter.targetEndDate ||
        abziBefore?.status !== abziAfter.status)
    ) {
      await supabase.from("courses").upsert({
        workspace_id: wid,
        id: abziAfter.id,
        slug: abziAfter.id.replace(/^course:/, ""),
        name: abziAfter.name,
        type: abziAfter.type,
        start_date: abziAfter.startDate,
        target_end_date: abziAfter.targetEndDate,
        total_units: abziAfter.totalUnits,
        completed_units: abziAfter.completedUnits,
        total_questions: abziAfter.totalQuestions,
        completed_questions: abziAfter.completedQuestions,
        current_subject_id: abziAfter.currentSubjectId,
        status: abziAfter.status,
        notes: abziAfter.notes,
      })
    }

    setSnapshot({
      ...seeded.snapshot,
      schedule,
      courses,
    })
    setError(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!configured) {
      loadLocal()
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      await loadCloud()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workspace")
    } finally {
      setLoading(false)
    }
  }, [configured, loadCloud, loadLocal])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!configured) return
    const supabase = createClient()
    const channel = supabase
      .channel("nida-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "study_sessions" },
        () => {
          void loadCloud()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "question_blocks" },
        () => {
          void loadCloud()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tests_mocks" },
        () => {
          void loadCloud()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incorrect_reviews" },
        () => {
          void loadCloud()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        () => {
          void loadCloud()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_events" },
        () => {
          void loadCloud()
        }
      )
      .subscribe()
    const onFocus = () => {
      void loadCloud()
    }
    window.addEventListener("focus", onFocus)
    return () => {
      void supabase.removeChannel(channel)
      window.removeEventListener("focus", onFocus)
    }
  }, [configured, loadCloud])

  const commit = useCallback(
    async (next: WorkspaceSnapshot) => {
      if (!configured) {
        persistLocal(next)
        return
      }
      setSnapshot(next)
    },
    [configured, persistLocal]
  )

  const stats = useMemo(() => deriveStats(snapshot), [snapshot])
  const readiness = useMemo(() => computeReadiness(snapshot, stats), [snapshot, stats])
  const running = runningSession(snapshot)

  const punchIn: Ctx["punchIn"] = async (input) => {
    if (running) throw new Error("A session is already running. End it first.")
    const row: StudySession = {
      id: newId(),
      subjectId: input.subjectId,
      sourceId: input.sourceId,
      activityId: input.activityId,
      topic: input.topic ?? "",
      startAt: nowIso(),
      endAt: null,
      durationMinutes: null,
      entryMode: "timer",
      status: "running",
      notes: "",
      linkedAssessmentId: null,
      planned: false,
      confidence: null,
      energy: null,
      confirmedThroughAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    const next = { ...snapshot, sessions: [...snapshot.sessions, row] }
    await commit(next)
    if (configured) {
      const supabase = createClient()
      const { error: err } = await supabase.from("study_sessions").insert(sessionRow(row, snapshot.workspaceId))
      if (err) {
        await loadCloud()
        throw err
      }
    }
  }

  const punchOut: Ctx["punchOut"] = async (input) => {
    const current = runningSession(snapshot)
    if (!current) throw new Error("No active session")
    const endAt = input?.endAt ?? nowIso()
    if (new Date(endAt) <= new Date(current.startAt)) {
      throw new Error("End time must be after start time.")
    }
    const updated: StudySession = {
      ...current,
      endAt,
      durationMinutes: durationMinutes(current.startAt, endAt),
      status: "completed",
      notes: input?.notes ?? current.notes,
      topic: input?.topic ?? current.topic,
      confirmedThroughAt: endAt,
      updatedAt: nowIso(),
    }
    const next = {
      ...snapshot,
      sessions: snapshot.sessions.map((s) => (s.id === updated.id ? updated : s)),
    }
    await commit(next)
    if (configured) {
      const supabase = createClient()
      const { error: err } = await supabase
        .from("study_sessions")
        .update(sessionRow(updated, snapshot.workspaceId))
        .eq("id", updated.id)
      if (err) throw err
    }
  }

  const confirmStillStudying: Ctx["confirmStillStudying"] = async () => {
    const current = runningSession(snapshot)
    if (!current) return
    const at = nowIso()
    const updated: StudySession = {
      ...current,
      confirmedThroughAt: at,
      updatedAt: at,
    }
    const next = {
      ...snapshot,
      sessions: snapshot.sessions.map((s) => (s.id === updated.id ? updated : s)),
    }
    await commit(next)
    if (configured) {
      const supabase = createClient()
      const { error: err } = await supabase
        .from("study_sessions")
        .update(sessionRow(updated, snapshot.workspaceId))
        .eq("id", updated.id)
      if (err) throw err
    }
  }

  const discardRunning: Ctx["discardRunning"] = async () => {
    const current = runningSession(snapshot)
    if (!current) return
    const next = { ...snapshot, sessions: snapshot.sessions.filter((s) => s.id !== current.id) }
    await commit(next)
    if (configured) {
      const supabase = createClient()
      await supabase.from("study_sessions").delete().eq("id", current.id)
    }
  }

  const saveManualSession: Ctx["saveManualSession"] = async (input) => {
    if (running) throw new Error("End the live session before saving a manual one.")
    if (new Date(input.endAt) <= new Date(input.startAt)) {
      throw new Error("End time must be after start time.")
    }
    const row: StudySession = {
      id: newId(),
      subjectId: input.subjectId,
      sourceId: input.sourceId,
      activityId: input.activityId,
      topic: input.topic ?? "",
      startAt: input.startAt,
      endAt: input.endAt,
      durationMinutes: durationMinutes(input.startAt, input.endAt),
      entryMode: "manual",
      status: "completed",
      notes: input.notes ?? "",
      linkedAssessmentId: null,
      planned: false,
      confidence: null,
      energy: null,
      confirmedThroughAt: input.endAt,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    const next = { ...snapshot, sessions: [...snapshot.sessions, row] }
    await commit(next)
    if (configured) {
      const supabase = createClient()
      const { error: err } = await supabase.from("study_sessions").insert(sessionRow(row, snapshot.workspaceId))
      if (err) throw err
    }
  }

  const saveAssessment: Ctx["saveAssessment"] = async (input) => {
    if (!countsValid(input)) {
      throw new Error("Correct + Incorrect + Skipped must equal Total questions.")
    }
    if (new Date(input.endAt) <= new Date(input.startAt)) {
      throw new Error("End time must be after start time.")
    }
    const duration = durationMinutes(input.startAt, input.endAt)
    const id = newId()
    const qPractice = snapshot.catalogs.find((c) => c.slug === "question-practice")
    let linkedSessionId: string | null = null
    let sessions = snapshot.sessions

    const current = runningSession(snapshot)
    if (input.countAsStudySession && !current && qPractice) {
      const session: StudySession = {
        id: newId(),
        subjectId: input.subjectId,
        sourceId: input.sourceId,
        activityId: qPractice.id,
        topic: input.topic ?? "",
        startAt: input.startAt,
        endAt: input.endAt,
        durationMinutes: duration,
        entryMode: "manual",
        status: "completed",
        notes: "",
        linkedAssessmentId: id,
        planned: false,
        confidence: null,
        energy: null,
        confirmedThroughAt: input.endAt,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      linkedSessionId = session.id
      sessions = [...sessions, session]
      if (configured) {
        const supabase = createClient()
        await supabase.from("study_sessions").insert(sessionRow(session, snapshot.workspaceId))
      }
    }

    let blocks = snapshot.blocks
    let tests = snapshot.tests
    if (input.kind === "test") {
      const row: TestMock = {
        id,
        subjectId: input.subjectId,
        sourceId: input.sourceId,
        assessmentTypeId: input.assessmentTypeId,
        testName: input.testName ?? "",
        startAt: input.startAt,
        endAt: input.endAt,
        durationMinutes: duration,
        total: input.total,
        correct: input.correct,
        incorrect: input.incorrect,
        skipped: input.skipped,
        rank: "",
        strongAreas: "",
        weakAreas: "",
        reviewCompleted: false,
        notes: input.notes ?? "",
        linkedSessionId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      tests = [...tests, row]
      if (configured) {
        const supabase = createClient()
        await supabase.from("tests_mocks").insert(testRow(row, snapshot.workspaceId))
      }
    } else {
      const row: QuestionBlock = {
        id,
        subjectId: input.subjectId,
        sourceId: input.sourceId,
        assessmentTypeId: input.assessmentTypeId,
        topic: input.topic ?? "",
        startAt: input.startAt,
        endAt: input.endAt,
        durationMinutes: duration,
        total: input.total,
        correct: input.correct,
        incorrect: input.incorrect,
        skipped: input.skipped,
        timedMode: input.timedMode ?? "timed",
        attemptState: input.attemptState ?? "first_pass",
        notes: input.notes ?? "",
        linkedSessionId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      blocks = [...blocks, row]
      if (configured) {
        const supabase = createClient()
        await supabase.from("question_blocks").insert(blockRow(row, snapshot.workspaceId))
      }
    }

    let reviews = snapshot.reviews
    if (input.sendIncorrectsToReview && input.incorrect > 0) {
      const [d1, d7, d21] = snapshot.settings.reviewIntervals
      const start = input.endAt.slice(0, 10)
      const add = (days: number) => {
        const dt = new Date(`${start}T12:00:00Z`)
        dt.setUTCDate(dt.getUTCDate() + days)
        return dt.toISOString().slice(0, 10)
      }
      const errorType =
        snapshot.catalogs.find((c) => c.kind === "error_type" && c.slug === "knowledge-gap")?.id ??
        snapshot.catalogs.find((c) => c.kind === "error_type")?.id ??
        "error_type:other"
      const review: IncorrectReview = {
        id: newId(),
        sourceKind: input.kind === "test" ? "test" : "block",
        sourceId: id,
        subjectId: input.subjectId,
        providerId: input.sourceId,
        topic: input.topic ?? "",
        questionCount: input.incorrect,
        errorTypeId: errorType,
        reason: "",
        correctConcept: "",
        priority: "high",
        status: "pending",
        firstReviewAt: add(d1),
        secondReviewAt: add(d7),
        thirdReviewAt: add(d21),
        tutorQuestion: "",
        flashcardCreated: false,
        notes: "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      reviews = [...reviews, review]
      if (configured) {
        const supabase = createClient()
        await supabase.from("incorrect_reviews").insert(reviewRow(review, snapshot.workspaceId))
      }
    }

    let schedule = snapshot.schedule
    if (input.scheduleEventId) {
      const event = schedule.find((s) => s.id === input.scheduleEventId)
      if (event && !event.linkedAssessmentId) {
        const linked = normalizeScheduleEvent({
          ...event,
          linkedAssessmentId: id,
          attendance: event.attendance ?? "attended",
        })
        schedule = schedule.map((s) => (s.id === linked.id ? linked : s))
        if (configured) {
          const supabase = createClient()
          await supabase.from("schedule_events").upsert(scheduleRow(linked, snapshot.workspaceId))
        }
      }
    }

    await commit({ ...snapshot, sessions, blocks, tests, reviews, schedule })
  }

  async function writeSession(row: StudySession, del = false) {
    if (!configured) return
    const supabase = createClient()
    if (del) await supabase.from("study_sessions").delete().eq("id", row.id)
    else await supabase.from("study_sessions").upsert(sessionRow(row, snapshot.workspaceId))
  }

  const updateSession: Ctx["updateSession"] = async (row) => {
    if (row.endAt && row.startAt) {
      row = {
        ...row,
        durationMinutes: durationMinutes(row.startAt, row.endAt),
        confirmedThroughAt: row.endAt,
        updatedAt: nowIso(),
      }
    }
    await commit({
      ...snapshot,
      sessions: snapshot.sessions.map((s) => (s.id === row.id ? row : s)),
    })
    await writeSession(row)
  }

  const deleteSession: Ctx["deleteSession"] = async (id) => {
    const row = snapshot.sessions.find((s) => s.id === id)
    await commit({ ...snapshot, sessions: snapshot.sessions.filter((s) => s.id !== id) })
    if (row) await writeSession(row, true)
  }

  const updateBlock: Ctx["updateBlock"] = async (row) => {
    if (!countsValid(row)) throw new Error("Correct + Incorrect + Skipped must equal Total.")
    row = {
      ...row,
      durationMinutes: durationMinutes(row.startAt, row.endAt),
      updatedAt: nowIso(),
    }
    await commit({
      ...snapshot,
      blocks: snapshot.blocks.map((s) => (s.id === row.id ? row : s)),
    })
    if (configured) {
      const supabase = createClient()
      await supabase.from("question_blocks").upsert(blockRow(row, snapshot.workspaceId))
    }
  }

  const deleteBlock: Ctx["deleteBlock"] = async (id) => {
    await commit({ ...snapshot, blocks: snapshot.blocks.filter((s) => s.id !== id) })
    if (configured) {
      const supabase = createClient()
      await supabase.from("question_blocks").delete().eq("id", id)
    }
  }

  const updateTest: Ctx["updateTest"] = async (row) => {
    if (!countsValid(row)) throw new Error("Correct + Incorrect + Skipped must equal Total.")
    row = { ...row, durationMinutes: durationMinutes(row.startAt, row.endAt), updatedAt: nowIso() }
    await commit({ ...snapshot, tests: snapshot.tests.map((s) => (s.id === row.id ? row : s)) })
    if (configured) {
      const supabase = createClient()
      await supabase.from("tests_mocks").upsert(testRow(row, snapshot.workspaceId))
    }
  }

  const deleteTest: Ctx["deleteTest"] = async (id) => {
    await commit({ ...snapshot, tests: snapshot.tests.filter((s) => s.id !== id) })
    if (configured) {
      const supabase = createClient()
      await supabase.from("tests_mocks").delete().eq("id", id)
    }
  }

  const upsertReview: Ctx["upsertReview"] = async (row) => {
    const exists = snapshot.reviews.some((r) => r.id === row.id)
    const reviews = exists
      ? snapshot.reviews.map((r) => (r.id === row.id ? { ...row, updatedAt: nowIso() } : r))
      : [...snapshot.reviews, { ...row, createdAt: row.createdAt || nowIso(), updatedAt: nowIso() }]
    await commit({ ...snapshot, reviews })
    if (configured) {
      const supabase = createClient()
      await supabase.from("incorrect_reviews").upsert(reviewRow({ ...row, updatedAt: nowIso() }, snapshot.workspaceId))
    }
  }

  const deleteReview: Ctx["deleteReview"] = async (id) => {
    await commit({ ...snapshot, reviews: snapshot.reviews.filter((r) => r.id !== id) })
    if (configured) {
      const supabase = createClient()
      await supabase.from("incorrect_reviews").delete().eq("id", id)
    }
  }

  const updateSettings: Ctx["updateSettings"] = async (patch) => {
    const settings = { ...snapshot.settings, ...patch }
    await commit({ ...snapshot, settings })
    if (configured) {
      const supabase = createClient()
      await supabase.from("settings").upsert({ workspace_id: snapshot.workspaceId, data: settings, updated_at: nowIso() })
    }
  }

  const updateCatalogItem: Ctx["updateCatalogItem"] = async (item) => {
    const catalogs = snapshot.catalogs.map((c) => (c.id === item.id ? item : c))
    await commit({ ...snapshot, catalogs })
    if (configured) {
      const supabase = createClient()
      await supabase.from("catalog_items").upsert({
        workspace_id: snapshot.workspaceId,
        id: item.id,
        kind: item.kind,
        slug: item.slug,
        name: item.name,
        active: item.active,
        sort_order: item.sortOrder,
        meta: item.meta,
      })
    }
  }

  const addCatalogItem: Ctx["addCatalogItem"] = async (item) => {
    const catalogs = [...snapshot.catalogs, item]
    await commit({ ...snapshot, catalogs })
    if (configured) {
      const supabase = createClient()
      await supabase.from("catalog_items").insert({
        workspace_id: snapshot.workspaceId,
        id: item.id,
        kind: item.kind,
        slug: item.slug,
        name: item.name,
        active: item.active,
        sort_order: item.sortOrder,
        meta: item.meta,
      })
    }
  }

  const updateCourse: Ctx["updateCourse"] = async (row) => {
    const courses = snapshot.courses.map((c) => (c.id === row.id ? row : c))
    await commit({ ...snapshot, courses })
    if (configured) {
      const supabase = createClient()
      await supabase.from("courses").upsert({
        workspace_id: snapshot.workspaceId,
        id: row.id,
        slug: row.id.replace("course:", ""),
        name: row.name,
        type: row.type,
        start_date: row.startDate,
        target_end_date: row.targetEndDate,
        total_units: row.totalUnits,
        completed_units: row.completedUnits,
        total_questions: row.totalQuestions,
        completed_questions: row.completedQuestions,
        current_subject_id: row.currentSubjectId,
        status: row.status,
        notes: row.notes,
      })
    }
  }

  const upsertSchedule: Ctx["upsertSchedule"] = async (row) => {
    const normalized = normalizeScheduleEvent(row)
    const exists = snapshot.schedule.some((s) => s.id === normalized.id)
    const schedule = exists
      ? snapshot.schedule.map((s) => (s.id === normalized.id ? normalized : s))
      : [...snapshot.schedule, normalized]
    await commit({ ...snapshot, schedule })
    if (configured) {
      const supabase = createClient()
      const { error: err } = await supabase.from("schedule_events").upsert(scheduleRow(normalized, snapshot.workspaceId))
      if (err) throw err
    }
  }

  const deleteSchedule: Ctx["deleteSchedule"] = async (id) => {
    await commit({ ...snapshot, schedule: snapshot.schedule.filter((s) => s.id !== id) })
    if (configured) {
      const supabase = createClient()
      await supabase.from("schedule_events").delete().eq("id", id)
    }
  }

  const updateQuotes: Ctx["updateQuotes"] = async (quotes) => {
    await commit({ ...snapshot, quotes })
    if (configured) {
      const supabase = createClient()
      await supabase.from("motivation_messages").upsert(
        quotes.map((q) => ({
          workspace_id: snapshot.workspaceId,
          id: q.id,
          idx: q.index,
          theme: q.theme,
          message: q.message,
        }))
      )
    }
  }

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(snapshotToBackup(snapshot), null, 2)], {
      type: "application/json",
    })
    return blob
  }

  const restoreBackup: Ctx["restoreBackup"] = async (file) => {
    const partial = backupToPartial(file)
    const { snapshot: seeded } = applyAbziSeedToSnapshot({ ...snapshot, ...partial })
    const next = seeded
    await commit(next)
    if (configured) {
      const supabase = createClient()
      const wid = snapshot.workspaceId
      await supabase.from("settings").upsert({ workspace_id: wid, data: next.settings })
      await supabase.from("catalog_items").upsert(
        next.catalogs.map((c) => ({
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
      for (const table of ["study_sessions", "question_blocks", "tests_mocks", "incorrect_reviews", "schedule_events"] as const) {
        await supabase.from(table).delete().eq("workspace_id", wid)
      }
      if (next.sessions.length) {
        await supabase.from("study_sessions").insert(next.sessions.map((r) => sessionRow(r, wid)))
      }
      if (next.blocks.length) {
        await supabase.from("question_blocks").insert(next.blocks.map((r) => blockRow(r, wid)))
      }
      if (next.tests.length) {
        await supabase.from("tests_mocks").insert(next.tests.map((r) => testRow(r, wid)))
      }
      if (next.reviews.length) {
        await supabase.from("incorrect_reviews").insert(next.reviews.map((r) => reviewRow(r, wid)))
      }
      if (next.schedule.length) {
        await supabase.from("schedule_events").insert(next.schedule.map((r) => scheduleRow(r, wid)))
      }
      await supabase.from("courses").upsert(
        next.courses.map((row) => ({
          workspace_id: wid,
          id: row.id,
          slug: row.id.replace("course:", ""),
          name: row.name,
          type: row.type,
          start_date: row.startDate,
          target_end_date: row.targetEndDate,
          total_units: row.totalUnits,
          completed_units: row.completedUnits,
          total_questions: row.totalQuestions,
          completed_questions: row.completedQuestions,
          current_subject_id: row.currentSubjectId,
          status: row.status,
          notes: row.notes,
        }))
      )
      await supabase.from("motivation_messages").upsert(
        next.quotes.map((q) => ({
          workspace_id: wid,
          id: q.id,
          idx: q.index,
          theme: q.theme,
          message: q.message,
        }))
      )
    }
  }

  const signOut = async () => {
    if (configured) {
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = "/login"
    }
  }

  const value: Ctx = {
    mode,
    configured,
    loading,
    error,
    snapshot,
    stats,
    readiness,
    running,
    refresh,
    punchIn,
    punchOut,
    confirmStillStudying,
    discardRunning,
    saveManualSession,
    saveAssessment,
    updateSession,
    deleteSession,
    updateBlock,
    deleteBlock,
    updateTest,
    deleteTest,
    upsertReview,
    deleteReview,
    updateSettings,
    updateCatalogItem,
    addCatalogItem,
    updateCourse,
    upsertSchedule,
    deleteSchedule,
    updateQuotes,
    exportBackup,
    restoreBackup,
    signOut,
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return ctx
}

function mapCatalog(row: Record<string, unknown>): CatalogItem {
  return {
    id: String(row.id),
    kind: row.kind as CatalogItem["kind"],
    slug: String(row.slug),
    name: String(row.name),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order),
    meta: (row.meta as CatalogItem["meta"]) ?? {},
  }
}

function mapSession(row: Record<string, unknown>): StudySession {
  return {
    id: String(row.id),
    subjectId: String(row.subject_id),
    sourceId: String(row.source_id),
    activityId: String(row.activity_id),
    topic: String(row.topic ?? ""),
    startAt: String(row.start_at),
    endAt: row.end_at ? String(row.end_at) : null,
    durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes),
    entryMode: row.entry_mode as StudySession["entryMode"],
    status: row.status as StudySession["status"],
    notes: String(row.notes ?? ""),
    linkedAssessmentId: row.linked_assessment_id ? String(row.linked_assessment_id) : null,
    planned: Boolean(row.planned),
    confidence: row.confidence == null ? null : Number(row.confidence),
    energy: row.energy == null ? null : Number(row.energy),
    confirmedThroughAt: row.confirmed_through_at ? String(row.confirmed_through_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapBlock(row: Record<string, unknown>): QuestionBlock {
  return {
    id: String(row.id),
    subjectId: String(row.subject_id),
    sourceId: String(row.source_id),
    assessmentTypeId: String(row.assessment_type_id),
    topic: String(row.topic ?? ""),
    startAt: String(row.start_at),
    endAt: String(row.end_at),
    durationMinutes: Number(row.duration_minutes),
    total: Number(row.total),
    correct: Number(row.correct),
    incorrect: Number(row.incorrect),
    skipped: Number(row.skipped),
    timedMode: (row.timed_mode as QuestionBlock["timedMode"]) ?? "timed",
    attemptState: (row.attempt_state as QuestionBlock["attemptState"]) ?? "first_pass",
    notes: String(row.notes ?? ""),
    linkedSessionId: row.linked_session_id ? String(row.linked_session_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapTest(row: Record<string, unknown>): TestMock {
  return {
    id: String(row.id),
    subjectId: String(row.subject_id),
    sourceId: String(row.source_id),
    assessmentTypeId: String(row.assessment_type_id),
    testName: String(row.test_name ?? ""),
    startAt: String(row.start_at),
    endAt: String(row.end_at),
    durationMinutes: Number(row.duration_minutes),
    total: Number(row.total),
    correct: Number(row.correct),
    incorrect: Number(row.incorrect),
    skipped: Number(row.skipped),
    rank: String(row.rank ?? ""),
    strongAreas: String(row.strong_areas ?? ""),
    weakAreas: String(row.weak_areas ?? ""),
    reviewCompleted: Boolean(row.review_completed),
    notes: String(row.notes ?? ""),
    linkedSessionId: row.linked_session_id ? String(row.linked_session_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapReview(row: Record<string, unknown>): IncorrectReview {
  return {
    id: String(row.id),
    sourceKind: row.source_kind as IncorrectReview["sourceKind"],
    sourceId: row.source_id ? String(row.source_id) : null,
    subjectId: String(row.subject_id),
    providerId: String(row.provider_id),
    topic: String(row.topic ?? ""),
    questionCount: Number(row.question_count),
    errorTypeId: String(row.error_type_id),
    reason: String(row.reason ?? ""),
    correctConcept: String(row.correct_concept ?? ""),
    priority: row.priority as IncorrectReview["priority"],
    status: row.status as IncorrectReview["status"],
    firstReviewAt: row.first_review_at ? String(row.first_review_at) : null,
    secondReviewAt: row.second_review_at ? String(row.second_review_at) : null,
    thirdReviewAt: row.third_review_at ? String(row.third_review_at) : null,
    tutorQuestion: String(row.tutor_question ?? ""),
    flashcardCreated: Boolean(row.flashcard_created),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapSchedule(row: Record<string, unknown>): WorkspaceSnapshot["schedule"][number] {
  const topicsRaw = row.topics
  const topics = Array.isArray(topicsRaw)
    ? topicsRaw.map(String)
    : typeof topicsRaw === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(topicsRaw)
            return Array.isArray(parsed) ? parsed.map(String) : []
          } catch {
            return []
          }
        })()
      : []
  return normalizeScheduleEvent({
    id: String(row.id),
    date: String(row.event_date),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    timezone: String(row.timezone),
    eventType: String(row.event_type),
    subjectId: row.subject_id ? String(row.subject_id) : null,
    courseId: row.course_id ? String(row.course_id) : null,
    status: row.status as WorkspaceSnapshot["schedule"][number]["status"],
    notes: String(row.notes ?? ""),
    title: String(row.title ?? ""),
    topics,
    externalId: row.external_id ? String(row.external_id) : null,
    attendance: (row.attendance as WorkspaceSnapshot["schedule"][number]["attendance"]) ?? null,
    prepDone: Boolean(row.prep_done),
    practiceDone: Boolean(row.practice_done),
    reviewDone: Boolean(row.review_done),
    timeTentative: Boolean(row.time_tentative),
    linkedAssessmentId: row.linked_assessment_id ? String(row.linked_assessment_id) : null,
  })
}

function mapCourse(row: Record<string, unknown>): Course {
  return {
    id: String(row.id),
    name: String(row.name),
    type: row.type as Course["type"],
    startDate: row.start_date ? String(row.start_date) : null,
    targetEndDate: row.target_end_date ? String(row.target_end_date) : null,
    totalUnits: row.total_units == null ? null : Number(row.total_units),
    completedUnits: Number(row.completed_units ?? 0),
    totalQuestions: row.total_questions == null ? null : Number(row.total_questions),
    completedQuestions: Number(row.completed_questions ?? 0),
    currentSubjectId: row.current_subject_id ? String(row.current_subject_id) : null,
    status: row.status as Course["status"],
    notes: String(row.notes ?? ""),
  }
}

function sessionRow(row: StudySession, workspaceId: string) {
  return {
    id: row.id,
    workspace_id: workspaceId,
    subject_id: row.subjectId,
    source_id: row.sourceId,
    activity_id: row.activityId,
    topic: row.topic,
    start_at: row.startAt,
    end_at: row.endAt,
    duration_minutes: row.durationMinutes,
    entry_mode: row.entryMode,
    status: row.status,
    notes: row.notes,
    linked_assessment_id: row.linkedAssessmentId,
    planned: row.planned,
    confidence: row.confidence,
    energy: row.energy,
    confirmed_through_at: row.confirmedThroughAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function blockRow(row: QuestionBlock, workspaceId: string) {
  return {
    id: row.id,
    workspace_id: workspaceId,
    subject_id: row.subjectId,
    source_id: row.sourceId,
    assessment_type_id: row.assessmentTypeId,
    topic: row.topic,
    start_at: row.startAt,
    end_at: row.endAt,
    duration_minutes: row.durationMinutes,
    total: row.total,
    correct: row.correct,
    incorrect: row.incorrect,
    skipped: row.skipped,
    timed_mode: row.timedMode,
    attempt_state: row.attemptState,
    notes: row.notes,
    linked_session_id: row.linkedSessionId,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function testRow(row: TestMock, workspaceId: string) {
  return {
    id: row.id,
    workspace_id: workspaceId,
    subject_id: row.subjectId,
    source_id: row.sourceId,
    assessment_type_id: row.assessmentTypeId,
    test_name: row.testName,
    start_at: row.startAt,
    end_at: row.endAt,
    duration_minutes: row.durationMinutes,
    total: row.total,
    correct: row.correct,
    incorrect: row.incorrect,
    skipped: row.skipped,
    rank: row.rank,
    strong_areas: row.strongAreas,
    weak_areas: row.weakAreas,
    review_completed: row.reviewCompleted,
    notes: row.notes,
    linked_session_id: row.linkedSessionId,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function scheduleRow(row: ScheduleEvent, workspaceId: string) {
  const normalized = normalizeScheduleEvent(row)
  return {
    id: normalized.id,
    workspace_id: workspaceId,
    event_date: normalized.date,
    start_time: normalized.startTime,
    end_time: normalized.endTime,
    timezone: normalized.timezone,
    event_type: normalized.eventType,
    subject_id: normalized.subjectId,
    course_id: normalized.courseId,
    status: normalized.status,
    notes: normalized.notes,
    title: normalized.title,
    topics: normalized.topics,
    external_id: normalized.externalId,
    attendance: normalized.attendance,
    prep_done: normalized.prepDone,
    practice_done: normalized.practiceDone,
    review_done: normalized.reviewDone,
    time_tentative: normalized.timeTentative,
    linked_assessment_id: normalized.linkedAssessmentId,
  }
}

function reviewRow(row: IncorrectReview, workspaceId: string) {
  return {
    id: row.id,
    workspace_id: workspaceId,
    source_kind: row.sourceKind,
    source_id: row.sourceId,
    subject_id: row.subjectId,
    provider_id: row.providerId,
    topic: row.topic,
    question_count: row.questionCount,
    error_type_id: row.errorTypeId,
    reason: row.reason,
    correct_concept: row.correctConcept,
    priority: row.priority,
    status: row.status,
    first_review_at: row.firstReviewAt,
    second_review_at: row.secondReviewAt,
    third_review_at: row.thirdReviewAt,
    tutor_question: row.tutorQuestion,
    flashcard_created: row.flashcardCreated,
    notes: row.notes,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}
