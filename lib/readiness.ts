import type {
  EvidenceConfidence,
  ReadinessState,
  Settings,
  WorkspaceSnapshot,
} from "@/lib/types"
import type { DerivedStats, SubjectHealth } from "@/lib/stats"
import { shrinkAccuracy, volumeFactor } from "@/lib/metrics"
import { countdownDays, todayKey } from "@/lib/dates"

export type ReadinessReport = {
  score: number | null
  confidence: EvidenceConfidence
  confidenceScore: number
  state: ReadinessState
  why: string
  nextFocus: string
  blockers: string[]
  examDate: string | null
  countdown: number | null
  components: { key: string; label: string; value: number | null; weight: number }[]
}

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n))
}

function weightedMean(
  parts: { value: number | null; weight: number }[]
) {
  const usable = parts.filter((p) => p.value != null && p.weight > 0) as {
    value: number
    weight: number
  }[]
  const w = usable.reduce((a, p) => a + p.weight, 0)
  if (w <= 0) return null
  return usable.reduce((a, p) => a + p.value * p.weight, 0) / w
}

function confidenceBand(score: number, settings: Settings): EvidenceConfidence {
  if (score < 25) return "insufficient"
  if (score < settings.moderateConfidenceMin) return "low"
  if (score < settings.highConfidenceMin) return "moderate"
  return "high"
}

function scoredSubjects(subjects: SubjectHealth[]) {
  return subjects.filter((s) => s.scored && s.core)
}

export function computeReadiness(
  snapshot: WorkspaceSnapshot,
  stats: DerivedStats
): ReadinessReport {
  const s = snapshot.settings
  const scored = scoredSubjects(stats.subjects)
  const withData = scored.filter((x) => x.status !== "not_started")
  const enough = scored.filter(
    (x) => x.status !== "not_started" && x.status !== "not_enough_data"
  )
  const totalWeight = scored.reduce((a, x) => a + x.weight, 0) || 1
  const coveredWeight = enough.reduce((a, x) => a + x.weight, 0)
  const coverageRatio = coveredWeight / totalWeight

  const lifetimeAttempted =
    stats.subjects.reduce((a, x) => a + x.correct + x.incorrect, 0) ||
    Math.round((stats.lifetimeAccuracy ?? 0) * stats.lifetimeQuestions)
  const recentAttempted = Math.round(
    (stats.recentAccuracy ?? 0) > 0 ? stats.recentQuestions * 0.85 : stats.recentQuestions
  )

  const shrunkLife = shrinkAccuracy(
    Math.round((stats.lifetimeAccuracy ?? 0) * Math.max(lifetimeAttempted, 0)),
    Math.max(lifetimeAttempted, stats.lifetimeQuestions > 0 ? Math.round(stats.lifetimeQuestions * 0.8) : 0),
    s.accuracyGoal,
    s.accuracyPriorStrength
  )
  const shrunkRecent = shrinkAccuracy(
    Math.round((stats.recentAccuracy ?? 0) * Math.max(recentAttempted, 0)),
    stats.recentQuestions,
    s.accuracyGoal,
    Math.max(12, Math.round(s.accuracyPriorStrength / 2))
  )

  const volume = volumeFactor(stats.lifetimeQuestions, s.volumeHalfLife)
  const lifeComponent =
    shrunkLife == null
      ? null
      : clamp((shrunkLife / s.accuracyGoal) * 85 * (0.35 + 0.65 * volume))
  const recentComponent =
    stats.recentQuestions < 10 || shrunkRecent == null
      ? null
      : clamp((shrunkRecent / s.accuracyGoal) * 90)

  const trendComponent =
    stats.trend === "unknown"
      ? null
      : stats.trend === "up"
        ? 88
        : stats.trend === "flat"
          ? 72
          : 38

  const coverageComponent =
    withData.length === 0 ? null : clamp(coverageRatio * 100)

  const floors = enough.map((x) => x.readiness).filter((n): n is number => n != null)
  const weakFloor = floors.length ? Math.min(...floors) : null
  const weakComponent = weakFloor

  const mockComponent = (() => {
    if (stats.mockCount === 0) return null
    const latest = stats.latestMockScore
    if (latest == null) return null
    const countScore = Math.min(1, stats.mockCount / s.minMocksForReady)
    const latestScore = Math.min(1.1, latest / s.mockScoreBar)
    const trendAdj = stats.mockTrend === "down" ? 0.82 : stats.mockTrend === "up" ? 1.05 : 1
    return clamp(100 * (0.45 * countScore + 0.55 * latestScore) * trendAdj)
  })()

  const pending = stats.pendingReviews
  const overdue = stats.overdueReviews
  const reviewComponent = clamp(100 - pending * 1.8 - overdue * 3)

  const weekGoalDays = Math.max(4, Math.round((s.weeklyHourGoal / Math.max(s.dailyHourGoal, 0.5)) * 0.7))
  const consistencyComponent = clamp(
    (stats.rhythm.studyDaysThisWeek / Math.max(weekGoalDays, 1)) * 50 +
      (stats.rhythm.studyDaysLast28 / 16) * 35 +
      Math.min(15, stats.rhythm.streak)
  )

  const targetedCourses = snapshot.courses.filter(
    (c) => (c.totalUnits && c.totalUnits > 0) || (c.totalQuestions && c.totalQuestions > 0)
  )
  const courseComponent =
    targetedCourses.length === 0
      ? null
      : clamp(
          average(
            targetedCourses.map((c) => {
              const unit =
                c.totalUnits && c.totalUnits > 0 ? c.completedUnits / c.totalUnits : null
              const q =
                c.totalQuestions && c.totalQuestions > 0
                  ? c.completedQuestions / c.totalQuestions
                  : null
              const parts = [unit, q].filter((n): n is number => n != null)
              return parts.length ? average(parts) * 100 : 0
            })
          )
        )

  const w = s.weights
  const components = [
    { key: "accuracy", label: "Accuracy (volume-adjusted)", value: lifeComponent, weight: w.accuracy },
    { key: "recent", label: "Recent accuracy", value: recentComponent, weight: w.recentAccuracy },
    { key: "trend", label: "Performance trend", value: trendComponent, weight: w.trend },
    { key: "coverage", label: "Subject coverage", value: coverageComponent, weight: w.coverage },
    { key: "weak", label: "Weakest subject floor", value: weakComponent, weight: w.weakFloor },
    { key: "mocks", label: "Mock exams", value: mockComponent, weight: w.mocks },
    { key: "review", label: "Incorrect-review hygiene", value: reviewComponent, weight: pending + overdue > 0 || stats.lifetimeQuestions > 0 ? w.reviewHygiene : 0 },
    { key: "consistency", label: "Study consistency", value: stats.rhythm.lastStudyDate ? consistencyComponent : null, weight: w.consistency },
    { key: "courses", label: "Course / Q-bank progress", value: courseComponent, weight: courseComponent == null ? 0 : w.courseProgress },
  ]

  const scoreRaw = weightedMean(components)
  const score = scoreRaw == null ? null : Math.round(scoreRaw)

  const uniqueSubjects = withData.length
  const activeWeeks = Math.max(1, Math.round(stats.rhythm.studyDaysLast28 / 3))
  const recency =
    stats.rhythm.lastStudyDate == null
      ? 0
      : daysAgo(stats.rhythm.lastStudyDate, todayKey(s.timezone)) <= 7
        ? 1
        : daysAgo(stats.rhythm.lastStudyDate, todayKey(s.timezone)) <= 21
          ? 0.6
          : 0.25
  const mockConf = Math.min(1, stats.mockCount / Math.max(s.minMocksForReady, 1))
  const breadth = Math.min(1, uniqueSubjects / 8)
  const history = Math.min(1, stats.rhythm.studyDaysLast28 / 20)
  const confidenceScore = Math.round(
    100 *
      (0.34 * volume +
        0.18 * breadth +
        0.2 * mockConf +
        0.16 * history +
        0.12 * recency)
  )
  const confidence = confidenceBand(confidenceScore, s)

  const studyDays = new Set(
    [
      ...snapshot.sessions.filter((x) => x.status === "completed").map((x) => x.startAt.slice(0, 10)),
      ...snapshot.blocks.map((x) => x.startAt.slice(0, 10)),
      ...snapshot.tests.map((x) => x.startAt.slice(0, 10)),
    ]
  ).size

  const baseline =
    stats.lifetimeQuestions < s.minQuestionsForBaseline ||
    studyDays < s.minStudyDaysForBaseline ||
    confidence === "insufficient"

  const readyGates = {
    confidenceHigh: confidence === "high",
    score: (score ?? 0) >= s.readyScoreThreshold,
    mocks: stats.mockCount >= s.minMocksForReady,
    latestMock: (stats.latestMockScore ?? 0) >= s.mockScoreBar,
    mockTrend: stats.mockTrend !== "down",
    weakFloor: weakFloor == null ? false : weakFloor >= s.weakSubjectFloor,
    reviews: overdue <= s.overdueReviewCap,
    coverage: coverageRatio >= s.coverageReadyRatio,
  }

  const blockers: string[] = []
  if (!readyGates.confidenceHigh) blockers.push("Not enough evidence yet for a high-confidence recommendation")
  if (!readyGates.mocks) {
    blockers.push(
      stats.mockCount === 0
        ? "Complete your first mock exam to unlock mock readiness"
        : `Sit at least ${s.minMocksForReady} mock exams before booking`
    )
  } else if (!readyGates.latestMock) {
    blockers.push("Recent mock performance is still below your mock bar")
  } else if (!readyGates.mockTrend) {
    blockers.push("Recent mock scores are declining")
  }
  if (score != null && score < s.readyScoreThreshold) {
    blockers.push("Overall readiness is still below the ready-to-book threshold")
  }
  if (enough.length && !readyGates.weakFloor) {
    const weakest = [...enough].sort((a, b) => (a.readiness ?? 0) - (b.readiness ?? 0))[0]
    blockers.push(`${weakest.name} is still holding the floor down`)
  }
  if (overdue > s.overdueReviewCap) {
    blockers.push("The incorrect-review backlog is overdue")
  }
  if (!readyGates.coverage) {
    blockers.push("Study more subjects to unlock a reliable subject-balance analysis")
  }

  let state: ReadinessState
  if (baseline || score == null) state = "building_baseline"
  else if (
    readyGates.confidenceHigh &&
    readyGates.score &&
    readyGates.mocks &&
    readyGates.latestMock &&
    readyGates.mockTrend &&
    readyGates.weakFloor &&
    readyGates.reviews &&
    readyGates.coverage
  ) {
    state = "ready_to_book"
  } else if (score >= s.gettingCloseThreshold && (confidence === "moderate" || confidence === "high")) {
    state = "getting_close"
  } else if (score >= s.progressingThreshold) {
    state = "progressing"
  } else {
    state = "not_ready"
  }

  if (state === "ready_to_book") blockers.length = 0

  const { why, nextFocus } = explain(state, stats, blockers, enough, s)

  const examDate = s.examDate
  const countdown =
    examDate && examDate.length >= 10 ? countdownDays(examDate, s.timezone) : null

  return {
    score,
    confidence,
    confidenceScore,
    state,
    why,
    nextFocus,
    blockers: state === "ready_to_book" ? [] : blockers.slice(0, 4),
    examDate,
    countdown,
    components,
  }
}

function explain(
  state: ReadinessState,
  stats: DerivedStats,
  blockers: string[],
  enough: SubjectHealth[],
  settings: Settings
) {
  const weakest = [...enough].sort((a, b) => (a.readiness ?? 101) - (b.readiness ?? 101)).slice(0, 2)
  const weakNames = weakest.map((w) => w.name).join(" and ")

  if (state === "building_baseline") {
    if (stats.lifetimeQuestions === 0 && stats.rhythm.lastStudyDate == null) {
      return {
        why: "Your journey starts here. There is not yet enough evidence to estimate exam readiness.",
        nextFocus: "Complete your first study session, then your first question block to begin measuring accuracy.",
      }
    }
    if (stats.lifetimeQuestions === 0) {
      return {
        why: "Hours are on the record, but accuracy cannot be measured until questions are logged.",
        nextFocus: "Complete your first question block to begin measuring accuracy.",
      }
    }
    return {
      why: "A baseline is still forming. Small samples can look better or worse than they are.",
      nextFocus:
        stats.mockCount === 0
          ? "Keep building your study record. Mock exams can wait until volume is more stable."
          : "Continue building question volume across more subjects.",
    }
  }

  if (state === "ready_to_book") {
    return {
      why: "Performance has remained stable across subjects and recent mock exams, with enough volume to trust the picture.",
      nextFocus: "Protect sleep, finish overdue incorrects, and keep one timed block in the rhythm until the date is set.",
    }
  }

  const lead = blockers[0]
  if (state === "getting_close") {
    return {
      why:
        lead ??
        (stats.recentAccuracy != null && stats.recentAccuracy >= settings.accuracyGoal
          ? "Strong recent question accuracy, but more mock-exam evidence is needed."
          : "The overall picture is strengthening, with a few remaining gaps."),
      nextFocus: weakNames
        ? `Focus next on ${weakNames}.${stats.overdueReviews > 0 ? " Your incorrect-review backlog also needs attention." : ""}`
        : lead ?? "Sit a full mock under timed conditions.",
    }
  }

  if (state === "progressing") {
    return {
      why: lead ?? "Work is accumulating, and the record is beginning to show direction.",
      nextFocus: weakNames
        ? `Give ${weakNames} a named session this week.`
        : "Keep weekly hours and questions close to your targets.",
    }
  }

  return {
    why: lead ?? "The current evidence does not yet support exam booking.",
    nextFocus: weakNames
      ? `Focus next on ${weakNames}.`
      : "Log consistent question blocks and keep the review queue current.",
  }
}

function average(ns: number[]) {
  return ns.reduce((a, b) => a + b, 0) / ns.length
}

function daysAgo(day: string, today: string) {
  const a = Date.parse(`${day}T12:00:00Z`)
  const b = Date.parse(`${today}T12:00:00Z`)
  return Math.round((b - a) / 86400000)
}

export function stateLabel(state: ReadinessState) {
  switch (state) {
    case "building_baseline":
      return "Building Baseline"
    case "not_ready":
      return "Not Ready Yet"
    case "progressing":
      return "Progressing"
    case "getting_close":
      return "Getting Close"
    case "ready_to_book":
      return "Ready to Book"
  }
}

export function confidenceLabel(c: EvidenceConfidence) {
  switch (c) {
    case "insufficient":
      return "Insufficient"
    case "low":
      return "Low"
    case "moderate":
      return "Moderate"
    case "high":
      return "High"
  }
}
