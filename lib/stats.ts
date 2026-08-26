import type {
  CatalogItem,
  Course,
  IncorrectReview,
  QuestionBlock,
  Settings,
  StudySession,
  TestMock,
  WorkspaceSnapshot,
} from "@/lib/types"
import { dayKey, daysBetweenKeys, todayKey, weekStartKey } from "@/lib/dates"
import { accuracyOf, isMockType, scoreOf } from "@/lib/metrics"
import { creditedDurationMinutes } from "@/lib/session-safety"

export type SubjectHealth = {
  id: string
  name: string
  weight: number
  scored: boolean
  core: boolean
  hours: number
  questions: number
  correct: number
  incorrect: number
  skipped: number
  accuracy: number | null
  testsTaken: number
  avgTestScore: number | null
  pendingReviews: number
  lastStudied: string | null
  daysSince: number | null
  recentAccuracy: number | null
  trend: "up" | "down" | "flat" | "unknown"
  status: "not_started" | "not_enough_data" | "needs_focus" | "developing" | "progressing" | "strong"
  readiness: number | null
}

export type PeriodTotals = {
  key: string
  hours: number
  sessions: number
  questions: number
  correct: number
  incorrect: number
  skipped: number
  accuracy: number | null
  tests: number
  avgTestScore: number | null
  reviewsCompleted: number
  activeDays: number
}

export type Rhythm = {
  streak: number
  bestStreak: number
  longestBreak: number
  lastStudyDate: string | null
  studyDaysThisWeek: number
  studyDaysLast28: number
}

export type DerivedStats = {
  todayHours: number
  todayQuestions: number
  todayCorrect: number
  todayIncorrect: number
  todayAccuracy: number | null
  todaySubjectId: string | null
  week: PeriodTotals
  lastWeek: PeriodTotals
  month: PeriodTotals
  lastMonth: PeriodTotals
  lifetimeHours: number
  lifetimeQuestions: number
  lifetimeAccuracy: number | null
  recentQuestions: number
  recentAccuracy: number | null
  priorRecentAccuracy: number | null
  trend: "up" | "down" | "flat" | "unknown"
  subjects: SubjectHealth[]
  rhythm: Rhythm
  pendingReviews: number
  overdueReviews: number
  highPriorityReviews: number
  mocks: TestMock[]
  mockCount: number
  latestMockScore: number | null
  priorMockScore: number | null
  mockTrend: "up" | "down" | "flat" | "unknown"
  achievements: { id: string; label: string; unlocked: boolean }[]
}

function activeDays(
  sessions: StudySession[],
  blocks: QuestionBlock[],
  tests: TestMock[],
  timeZone: string
) {
  const set = new Set<string>()
  for (const s of sessions) {
    if (s.status === "completed") set.add(dayKey(s.startAt, timeZone))
  }
  for (const b of blocks) set.add(dayKey(b.startAt, timeZone))
  for (const t of tests) set.add(dayKey(t.startAt, timeZone))
  return set
}

function inRange(iso: string, startKey: string, endKey: string, tz: string) {
  const k = dayKey(iso, tz)
  return k >= startKey && k <= endKey
}

function period(
  key: string,
  start: string,
  end: string,
  snapshot: WorkspaceSnapshot,
  now: Date
): PeriodTotals {
  const tz = snapshot.settings.timezone
  const sessions = snapshot.sessions.filter((s) => {
    if (!inRange(s.startAt, start, end, tz)) return false
    if (s.status === "completed") return true
    return s.status === "running" && creditedDurationMinutes(s, snapshot.settings, now) > 0
  })
  const blocks = snapshot.blocks.filter((b) => inRange(b.startAt, start, end, tz))
  const tests = snapshot.tests.filter((t) => inRange(t.startAt, start, end, tz))
  const hours = sessions.reduce((a, s) => a + creditedDurationMinutes(s, snapshot.settings, now), 0) / 60
  const questions = blocks.reduce((a, b) => a + b.total, 0)
  const correct = blocks.reduce((a, b) => a + b.correct, 0)
  const incorrect = blocks.reduce((a, b) => a + b.incorrect, 0)
  const skipped = blocks.reduce((a, b) => a + b.skipped, 0)
  const attempted = correct + incorrect
  const testScores = tests.map((t) => scoreOf(t)).filter((n): n is number => n != null)
  const days = activeDays(sessions, blocks, tests, tz)
  return {
    key,
    hours,
    sessions: sessions.length,
    questions,
    correct,
    incorrect,
    skipped,
    accuracy: attempted > 0 ? correct / attempted : null,
    tests: tests.length,
    avgTestScore: testScores.length ? testScores.reduce((a, b) => a + b, 0) / testScores.length : null,
    reviewsCompleted: snapshot.reviews.filter(
      (r) => r.status === "completed" && r.updatedAt && inRange(r.updatedAt, start, end, tz)
    ).length,
    activeDays: days.size,
  }
}

function trendOf(recent: number | null, prior: number | null): "up" | "down" | "flat" | "unknown" {
  if (recent == null || prior == null) return "unknown"
  const delta = recent - prior
  if (Math.abs(delta) < 0.03) return "flat"
  return delta > 0 ? "up" : "down"
}

function subjectTrend(
  blocks: QuestionBlock[],
  tz: string,
  today: string
): "up" | "down" | "flat" | "unknown" {
  const recentStart = addKeys(today, -13)
  const priorStart = addKeys(today, -27)
  const priorEnd = addKeys(today, -14)
  const recent = blocks.filter((b) => inRange(b.startAt, recentStart, today, tz))
  const prior = blocks.filter((b) => inRange(b.startAt, priorStart, priorEnd, tz))
  const rA = accuracyOf(sumCI(recent))
  const pA = accuracyOf(sumCI(prior))
  return trendOf(rA, pA)
}

function sumCI(rows: Array<{ correct: number; incorrect: number }>) {
  return rows.reduce(
    (a, r) => ({ correct: a.correct + r.correct, incorrect: a.incorrect + r.incorrect }),
    { correct: 0, incorrect: 0 }
  )
}

function addKeys(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function deriveStats(snapshot: WorkspaceSnapshot, now = new Date()): DerivedStats {
  const { settings, catalogs, sessions, blocks, tests, reviews } = snapshot
  const tz = settings.timezone
  const today = todayKey(tz)
  const weekStart = weekStartKey(now, tz)
  const weekEnd = addKeys(weekStart, 6)
  const lastWeekStart = addKeys(weekStart, -7)
  const lastWeekEnd = addKeys(weekStart, -1)
  const month = today.slice(0, 7)
  const monthStart = `${month}-01`
  const lastMonthDate = new Date(`${monthStart}T12:00:00Z`)
  lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1)
  const lastMonth = lastMonthDate.toISOString().slice(0, 7)
  const lastMonthStart = `${lastMonth}-01`
  const lastMonthEnd = addKeys(monthStart, -1)
  const monthEnd = today

  const completed = sessions.filter((s) => s.status === "completed")
  const todaySessions = sessions.filter((s) => dayKey(s.startAt, tz) === today && (s.status === "completed" || s.status === "running"))
  const todayBlocks = blocks.filter((b) => dayKey(b.startAt, tz) === today)
  const todayHours = todaySessions.reduce((a, s) => a + creditedDurationMinutes(s, settings, now), 0) / 60
  const todayQ = todayBlocks.reduce((a, b) => a + b.total, 0)
  const todayCI = sumCI(todayBlocks)

  const running = sessions.find((s) => s.status === "running")
  const lastCompleted = [...todaySessions].sort((a, b) => b.startAt.localeCompare(a.startAt))[0]
  const todaySubjectId = running?.subjectId ?? lastCompleted?.subjectId ?? todayBlocks[0]?.subjectId ?? null

  const recentStart = addKeys(today, -13)
  const priorStart = addKeys(today, -27)
  const priorEnd = addKeys(today, -14)
  const recentBlocks = blocks.filter((b) => inRange(b.startAt, recentStart, today, tz))
  const priorBlocks = blocks.filter((b) => inRange(b.startAt, priorStart, priorEnd, tz))
  const recentCI = sumCI(recentBlocks)
  const priorCI = sumCI(priorBlocks)

  const lifeCI = sumCI(blocks)
  const lifetimeHours = sessions.reduce((a, s) => a + creditedDurationMinutes(s, settings, now), 0) / 60

  const mockTests = tests
    .filter((t) => isMockType(t.assessmentTypeId, catalogs))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
  const latestMock = mockTests.at(-1)
  const priorMock = mockTests.at(-2)

  const subjects = catalogs
    .filter((c) => c.kind === "subject")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((subject) =>
      subjectHealth(subject, snapshot, {
        today,
        tz,
        settings,
      })
    )

  const days = [...activeDays(completed, blocks, tests, tz)].sort()
  const rhythm = computeRhythm(days, today)

  const pending = reviews.filter((r) => r.status !== "completed")
  const overdue = pending.filter((r) => r.firstReviewAt && r.firstReviewAt.slice(0, 10) < today)

  const week = period(weekStart, weekStart, weekEnd, snapshot, now)
  const lastWeek = period(lastWeekStart, lastWeekStart, lastWeekEnd, snapshot, now)
  const monthT = period(month, monthStart, monthEnd, snapshot, now)
  const lastMonthT = period(lastMonth, lastMonthStart, lastMonthEnd, snapshot, now)

  return {
    todayHours,
    todayQuestions: todayQ,
    todayCorrect: todayCI.correct,
    todayIncorrect: todayCI.incorrect,
    todayAccuracy: accuracyOf(todayCI),
    todaySubjectId,
    week,
    lastWeek,
    month: monthT,
    lastMonth: lastMonthT,
    lifetimeHours,
    lifetimeQuestions: blocks.reduce((a, b) => a + b.total, 0),
    lifetimeAccuracy: accuracyOf(lifeCI),
    recentQuestions: recentBlocks.reduce((a, b) => a + b.total, 0),
    recentAccuracy: accuracyOf(recentCI),
    priorRecentAccuracy: accuracyOf(priorCI),
    trend: trendOf(accuracyOf(recentCI), accuracyOf(priorCI)),
    subjects,
    rhythm,
    pendingReviews: pending.reduce((a, r) => a + r.questionCount, 0),
    overdueReviews: overdue.reduce((a, r) => a + r.questionCount, 0),
    highPriorityReviews: pending.filter((r) => r.priority === "high").reduce((a, r) => a + r.questionCount, 0),
    mocks: mockTests,
    mockCount: mockTests.length,
    latestMockScore: latestMock ? scoreOf(latestMock) : null,
    priorMockScore: priorMock ? scoreOf(priorMock) : null,
    mockTrend: trendOf(latestMock ? scoreOf(latestMock) : null, priorMock ? scoreOf(priorMock) : null),
    achievements: [
      { id: "first-session", label: "First study session", unlocked: completed.length > 0 },
      { id: "q100", label: "100 questions", unlocked: blocks.reduce((a, b) => a + b.total, 0) >= 100 },
      { id: "q500", label: "500 questions", unlocked: blocks.reduce((a, b) => a + b.total, 0) >= 500 },
      { id: "q1000", label: "1000 questions", unlocked: blocks.reduce((a, b) => a + b.total, 0) >= 1000 },
      { id: "first-mock", label: "First mock exam", unlocked: mockTests.length > 0 },
      { id: "streak-30", label: "30-day study streak", unlocked: rhythm.bestStreak >= 30 },
      { id: "hours-50", label: "50 study hours", unlocked: lifetimeHours >= 50 },
      { id: "hours-100", label: "100 study hours", unlocked: lifetimeHours >= 100 },
    ],
  }
}

function subjectHealth(
  subject: CatalogItem,
  snapshot: WorkspaceSnapshot,
  ctx: { today: string; tz: string; settings: Settings }
): SubjectHealth {
  const sessions = snapshot.sessions.filter(
    (s) => s.subjectId === subject.id && (s.status === "completed" || s.status === "running")
  )
  const blocks = snapshot.blocks.filter((b) => b.subjectId === subject.id)
  const tests = snapshot.tests.filter((t) => t.subjectId === subject.id)
  const hours = sessions.reduce((a, s) => a + creditedDurationMinutes(s, ctx.settings), 0) / 60
  const questions = blocks.reduce((a, b) => a + b.total, 0)
  const correct = blocks.reduce((a, b) => a + b.correct, 0)
  const incorrect = blocks.reduce((a, b) => a + b.incorrect, 0)
  const skipped = blocks.reduce((a, b) => a + b.skipped, 0)
  const accuracy = accuracyOf({ correct, incorrect })
  const testScores = tests.map((t) => scoreOf(t)).filter((n): n is number => n != null)
  const pendingReviews = snapshot.reviews
    .filter((r) => r.subjectId === subject.id && r.status !== "completed")
    .reduce((a, r) => a + r.questionCount, 0)
  const lastDates = [
    ...sessions.map((s) => dayKey(s.startAt, ctx.tz)),
    ...blocks.map((b) => dayKey(b.startAt, ctx.tz)),
    ...tests.map((t) => dayKey(t.startAt, ctx.tz)),
  ].sort()
  const lastStudied = lastDates.at(-1) ?? null
  const daysSince = lastStudied ? daysBetweenKeys(lastStudied, ctx.today) : null
  const recentStart = addKeys(ctx.today, -13)
  const recent = blocks.filter((b) => inRange(b.startAt, recentStart, ctx.today, ctx.tz))
  const recentAccuracy = accuracyOf(sumCI(recent))
  const trend = subjectTrend(blocks, ctx.tz, ctx.today)

  const started = hours > 0 || questions > 0 || tests.length > 0
  let status: SubjectHealth["status"] = "not_started"
  let readiness: number | null = null

  if (!started) {
    status = "not_started"
  } else if (questions < ctx.settings.minQuestionsForSubject && tests.length === 0) {
    status = "not_enough_data"
    readiness = Math.round(volumeSoft(questions, ctx.settings.minQuestionsForSubject) * 35)
  } else {
    const acc = accuracy ?? (testScores[0] ?? ctx.settings.accuracyGoal * 0.8)
    const accScore = Math.min(100, (acc / ctx.settings.accuracyGoal) * 70)
    const recencyScore =
      daysSince == null ? 40 : daysSince <= 7 ? 100 : daysSince <= 14 ? 70 : daysSince <= 28 ? 40 : 15
    const reviewPenalty = Math.min(25, pendingReviews * 2)
    const testBoost = testScores.length ? (average(testScores) / ctx.settings.accuracyGoal) * 15 : 0
    readiness = clamp(
      Math.round(accScore * 0.55 + recencyScore * 0.2 + testBoost * 0.15 + (100 - reviewPenalty) * 0.1),
      0,
      100
    )
    if (acc < ctx.settings.accuracyGoal - 0.1 || pendingReviews > 8 || (daysSince ?? 0) > 21) {
      status = "needs_focus"
    } else if (acc >= ctx.settings.accuracyGoal && pendingReviews <= 2 && (daysSince ?? 99) <= 10) {
      status = "strong"
    } else if (readiness >= 60) {
      status = "progressing"
    } else {
      status = "developing"
    }
  }

  return {
    id: subject.id,
    name: subject.name,
    weight: subject.meta.weight ?? 1,
    scored: subject.meta.scored !== false && subject.slug !== "mixed",
    core: Boolean(subject.meta.core),
    hours,
    questions,
    correct,
    incorrect,
    skipped,
    accuracy,
    testsTaken: tests.length,
    avgTestScore: testScores.length ? average(testScores) : null,
    pendingReviews,
    lastStudied,
    daysSince,
    recentAccuracy,
    trend,
    status,
    readiness,
  }
}

function volumeSoft(n: number, min: number) {
  return Math.min(1, n / Math.max(min, 1))
}

function average(ns: number[]) {
  return ns.reduce((a, b) => a + b, 0) / ns.length
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function computeRhythm(days: string[], today: string): Rhythm {
  if (days.length === 0) {
    return { streak: 0, bestStreak: 0, longestBreak: 0, lastStudyDate: null, studyDaysThisWeek: 0, studyDaysLast28: 0 }
  }
  const set = new Set(days)
  let streak = 0
  let cursor = today
  if (!set.has(today)) {
    cursor = addKeys(today, -1)
  }
  while (set.has(cursor)) {
    streak += 1
    cursor = addKeys(cursor, -1)
  }
  let best = 0
  let run = 0
  let prev: string | null = null
  let longestBreak = 0
  for (const d of days) {
    if (prev && daysBetweenKeys(prev, d) === 1) run += 1
    else run = 1
    best = Math.max(best, run)
    if (prev) longestBreak = Math.max(longestBreak, daysBetweenKeys(prev, d) - 1)
    prev = d
  }
  const weekStart = (() => {
    const [y, m, d] = today.split("-").map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    const dow = dt.getUTCDay()
    const diff = dow === 0 ? 6 : dow - 1
    return addKeys(today, -diff)
  })()
  const studyDaysThisWeek = days.filter((d) => d >= weekStart && d <= today).length
  const from28 = addKeys(today, -27)
  const studyDaysLast28 = days.filter((d) => d >= from28 && d <= today).length
  return {
    streak,
    bestStreak: Math.max(best, streak),
    longestBreak,
    lastStudyDate: days.at(-1) ?? null,
    studyDaysThisWeek,
    studyDaysLast28,
  }
}

export function runningSession(snapshot: WorkspaceSnapshot) {
  return snapshot.sessions.find((s) => s.status === "running") ?? null
}

export function catalogName(snapshot: WorkspaceSnapshot, id: string) {
  return snapshot.catalogs.find((c) => c.id === id)?.name ?? "—"
}

export type { Course, IncorrectReview }
