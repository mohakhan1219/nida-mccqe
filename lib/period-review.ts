import { dayKey, todayKey } from "@/lib/dates"
import { accuracyOf } from "@/lib/metrics"
import { creditedDurationMinutes } from "@/lib/session-safety"
import type { WorkspaceSnapshot } from "@/lib/types"
import { catalogName } from "@/lib/stats"

export type PeriodReviewWindow = 30 | 60 | 90

export type PeriodReview = {
  windowDays: PeriodReviewWindow
  startKey: string
  endKey: string
  studyHours: number
  studyDays: number
  eligibleQuestions: number
  correct: number
  incorrect: number
  skipped: number
  accuracy: number | null
  bySource: { name: string; answered: number; accuracy: number | null }[]
  bySubject: { name: string; answered: number; accuracy: number | null; hours: number }[]
  strongestSubjects: string[]
  weakestSubjects: string[]
  abziTests: { name: string; score: number | null; date: string }[]
  pendingReviews: number
  consistencyDays: number
  priorAccuracy: number | null
  accuracyDeltaPts: number | null
  insights: string[]
  insufficient: boolean
}

function addKeys(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

function inRange(iso: string, start: string, end: string, tz: string) {
  const k = dayKey(iso, tz)
  return k >= start && k <= end
}

export function buildPeriodReview(
  snapshot: WorkspaceSnapshot,
  windowDays: PeriodReviewWindow,
  now = new Date()
): PeriodReview {
  const tz = snapshot.settings.timezone
  const endKey = todayKey(tz, now)
  const startKey = addKeys(endKey, -(windowDays - 1))
  const priorEnd = addKeys(startKey, -1)
  const priorStart = addKeys(priorEnd, -(windowDays - 1))

  const sessions = snapshot.sessions.filter(
    (s) =>
      inRange(s.startAt, startKey, endKey, tz) &&
      (s.status === "completed" || s.status === "running" || s.status === "paused")
  )
  const blocks = snapshot.blocks.filter((b) => inRange(b.startAt, startKey, endKey, tz))
  const tests = snapshot.tests.filter((t) => inRange(t.startAt, startKey, endKey, tz))
  const priorBlocks = snapshot.blocks.filter((b) => inRange(b.startAt, priorStart, priorEnd, tz))
  const priorTests = snapshot.tests.filter((t) => inRange(t.startAt, priorStart, priorEnd, tz))

  const studyHours =
    sessions.reduce((a, s) => a + creditedDurationMinutes(s, snapshot.settings, now), 0) / 60
  const studyDaySet = new Set<string>()
  for (const s of sessions) {
    if (creditedDurationMinutes(s, snapshot.settings, now) > 0) studyDaySet.add(dayKey(s.startAt, tz))
  }
  for (const b of blocks) studyDaySet.add(dayKey(b.startAt, tz))
  for (const t of tests) studyDaySet.add(dayKey(t.startAt, tz))

  const correct = blocks.reduce((a, b) => a + b.correct, 0) + tests.reduce((a, t) => a + t.correct, 0)
  const incorrect =
    blocks.reduce((a, b) => a + b.incorrect, 0) + tests.reduce((a, t) => a + t.incorrect, 0)
  const skipped = blocks.reduce((a, b) => a + b.skipped, 0) + tests.reduce((a, t) => a + t.skipped, 0)
  const accuracy = accuracyOf({ correct, incorrect })

  const priorCorrect =
    priorBlocks.reduce((a, b) => a + b.correct, 0) + priorTests.reduce((a, t) => a + t.correct, 0)
  const priorIncorrect =
    priorBlocks.reduce((a, b) => a + b.incorrect, 0) + priorTests.reduce((a, t) => a + t.incorrect, 0)
  const priorAccuracy = accuracyOf({ correct: priorCorrect, incorrect: priorIncorrect })

  const bySourceMap = new Map<string, { correct: number; incorrect: number }>()
  const bump = (sourceId: string, c: number, i: number) => {
    const cur = bySourceMap.get(sourceId) ?? { correct: 0, incorrect: 0 }
    bySourceMap.set(sourceId, { correct: cur.correct + c, incorrect: cur.incorrect + i })
  }
  for (const b of blocks) bump(b.sourceId, b.correct, b.incorrect)
  for (const t of tests) bump(t.sourceId, t.correct, t.incorrect)

  const bySource = [...bySourceMap.entries()]
    .map(([id, v]) => ({
      name: catalogName(snapshot, id),
      answered: v.correct + v.incorrect,
      accuracy: accuracyOf(v),
    }))
    .sort((a, b) => b.answered - a.answered)

  const bySubjectMap = new Map<string, { correct: number; incorrect: number; hours: number }>()
  for (const b of blocks) {
    const cur = bySubjectMap.get(b.subjectId) ?? { correct: 0, incorrect: 0, hours: 0 }
    bySubjectMap.set(b.subjectId, {
      correct: cur.correct + b.correct,
      incorrect: cur.incorrect + b.incorrect,
      hours: cur.hours,
    })
  }
  for (const t of tests) {
    const cur = bySubjectMap.get(t.subjectId) ?? { correct: 0, incorrect: 0, hours: 0 }
    bySubjectMap.set(t.subjectId, {
      correct: cur.correct + t.correct,
      incorrect: cur.incorrect + t.incorrect,
      hours: cur.hours,
    })
  }
  for (const s of sessions) {
    const cur = bySubjectMap.get(s.subjectId) ?? { correct: 0, incorrect: 0, hours: 0 }
    bySubjectMap.set(s.subjectId, {
      ...cur,
      hours: cur.hours + creditedDurationMinutes(s, snapshot.settings, now) / 60,
    })
  }

  const bySubject = [...bySubjectMap.entries()]
    .map(([id, v]) => ({
      name: catalogName(snapshot, id),
      answered: v.correct + v.incorrect,
      accuracy: accuracyOf(v),
      hours: Math.round(v.hours * 10) / 10,
    }))
    .sort((a, b) => b.answered - a.answered)

  const ranked = bySubject.filter((s) => s.answered >= 10 && s.accuracy != null)
  const strongestSubjects = [...ranked]
    .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))
    .slice(0, 3)
    .map((s) => s.name)
  const weakestSubjects = [...ranked]
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
    .slice(0, 3)
    .map((s) => s.name)

  const abziTests = tests
    .filter((t) => t.sourceId.includes("abzi") || t.assessmentTypeId.includes("abzi"))
    .map((t) => ({
      name: t.testName || "ABZI test",
      score: accuracyOf(t),
      date: dayKey(t.startAt, tz),
    }))

  const pendingReviews = snapshot.reviews.filter((r) => r.status !== "completed").length
  const answered = correct + incorrect
  const insufficient = answered < 15 && studyDaySet.size < 3

  const insights: string[] = []
  if (insufficient) {
    insights.push("Insufficient data for this window.")
  } else {
    if (priorAccuracy != null && accuracy != null && answered >= 20 && priorCorrect + priorIncorrect >= 20) {
      const a = Math.round(priorAccuracy * 100)
      const b = Math.round(accuracy * 100)
      if (Math.abs(b - a) >= 3) {
        insights.push(
          b > a
            ? `Overall accuracy improved from ${a}% to ${b}%.`
            : `Overall accuracy eased from ${a}% to ${b}%.`
        )
      }
    }
    for (const s of ranked.slice(0, 8)) {
      const prior = [...priorBlocks, ...priorTests].filter(
        (row) => catalogName(snapshot, row.subjectId) === s.name
      )
      const pc = prior.reduce((a, r) => a + r.correct, 0)
      const pi = prior.reduce((a, r) => a + r.incorrect, 0)
      const pa = accuracyOf({ correct: pc, incorrect: pi })
      if (pa != null && s.accuracy != null && pc + pi >= 10 && s.answered >= 10) {
        const a = Math.round(pa * 100)
        const b = Math.round(s.accuracy * 100)
        if (Math.abs(b - a) >= 5) {
          insights.push(
            b > a
              ? `${s.name} accuracy improved from ${a}% to ${b}%.`
              : `${s.name} accuracy eased from ${a}% to ${b}%.`
          )
        }
      }
    }
    if (!insights.length) insights.push("Enough activity to review, without a clear accuracy shift yet.")
  }

  const accuracyDeltaPts =
    priorAccuracy != null && accuracy != null
      ? Math.round((accuracy - priorAccuracy) * 1000) / 10
      : null

  return {
    windowDays,
    startKey,
    endKey,
    studyHours: Math.round(studyHours * 10) / 10,
    studyDays: studyDaySet.size,
    eligibleQuestions: answered,
    correct,
    incorrect,
    skipped,
    accuracy,
    bySource,
    bySubject,
    strongestSubjects,
    weakestSubjects,
    abziTests,
    pendingReviews,
    consistencyDays: studyDaySet.size,
    priorAccuracy,
    accuracyDeltaPts,
    insights: insights.slice(0, 5),
    insufficient,
  }
}
