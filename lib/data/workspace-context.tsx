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

    const settings = {
      ...DEFAULT_SETTINGS,
      ...((settingsRes.data?.data as Partial<Settings>) ?? {}),
    }

    let schedule = (scheduleRes.data ?? []).map(mapSchedule)
    const qbankSnapshots = (qbankRes.error ? [] : qbankRes.data ?? []).map(mapQBankSnapshot)
    let highYieldTopics = (highYieldRes.error ? [] : highYieldRes.data ?? []).map(mapHighYieldTopic)
    const practiceAssessments = (practiceRes.error ? [] : practiceRes.data ?? []).map(mapPracticeAssessment)
    const hyMerge = mergeFilipeSantosCatalog(highYieldTopics)
    highYieldTopics = hyMerge.topics
    if (!highYieldRes.error && (hyMerge.added || hyMerge.updatedMeta)) {
      const { error: hyUpsertErr } = await supabase
        .from("high_yield_topics")
        .upsert(highYieldTopics.map((t) => highYieldRow(t, wid)))
      // Catalog stays in memory even if catalog_key migration is not applied yet.
      if (hyUpsertErr) {
        console.warn("high_yield_topics catalog sync deferred:", hyUpsertErr.message)
      }
    }
    let sessions = (sessionsRes.data ?? []).map(mapSession)
    const reconciled: StudySession[] = []
    sessions = sessions.map((s) => {
      const next = reconcilePausedSession(s, settings)
      if (next !== s && next.status === "completed") reconciled.push(next)
      return next
    })
    for (const row of reconciled) {
      await supabase.from("study_sessions").update(sessionRow(row, wid)).eq("id", row.id)
    }

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
      sessions,
      blocks: (blocksRes.data ?? []).map(mapBlock),
      tests: (testsRes.data ?? []).map(mapTest),
      reviews: (reviewsRes.data ?? []).map(mapReview),
      courses,
      schedule,
      quotes,
      qbankSnapshots,
      highYieldTopics,
      practiceAssessments,
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

    let nextSettings = seeded.snapshot.settings
    const planningProbe = computeExamPlanning(
      { ...seeded.snapshot, schedule, courses, settings: nextSettings },
      deriveStats({ ...seeded.snapshot, schedule, courses, settings: nextSettings })
    )
    if (planningProbe.shouldCreateSuggestedTarget && planningProbe.proposedSuggestedDate) {
      nextSettings = withSuggestedExamTarget(nextSettings, planningProbe.proposedSuggestedDate)
      await supabase.from("settings").upsert({ workspace_id: wid, data: nextSettings, updated_at: nowIso() })
    }

    setSnapshot({
      ...seeded.snapshot,
      schedule,
      courses,
      settings: nextSettings,
      qbankSnapshots,
      highYieldTopics,
      practiceAssessments,
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
    if (running) throw new Error("A session is already active. End it first.")
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
      pauseLog: [],
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
    const updated = withSessionEnded(current, endAt, {
      notes: input?.notes ?? current.notes,
      topic: input?.topic ?? current.topic,
    })
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

  const pauseSession: Ctx["pauseSession"] = async () => {
    const current = runningSession(snapshot)
    if (!current) throw new Error("No active session")
    if (current.status === "paused") throw new Error("Session is already paused.")
    const updated = withPauseStarted(current, nowIso())
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

  const resumeSession: Ctx["resumeSession"] = async () => {
    const current = runningSession(snapshot)
    if (!current) throw new Error("No active session")
    const maybeEnded = reconcilePausedSession(current, snapshot.settings)
    if (maybeEnded.status === "completed") {
      const next = {
        ...snapshot,
        sessions: snapshot.sessions.map((s) => (s.id === maybeEnded.id ? maybeEnded : s)),
      }
      await commit(next)
      if (configured) {
        const supabase = createClient()
        await supabase.from("study_sessions").update(sessionRow(maybeEnded, snapshot.workspaceId)).eq("id", maybeEnded.id)
      }
      throw new Error("This session was auto-ended after 60 minutes paused.")
    }
    const updated = withResume(current, nowIso())
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
      pauseLog: [],
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
        pauseLog: [],
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
        await supaba