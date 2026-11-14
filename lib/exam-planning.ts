import { addDaysKey, todayKey } from "@/lib/dates"
import { computeEligibleQuestionPerformance } from "@/lib/question-performance"
import type { ExamPlanningState, Settings, WorkspaceSnapshot } from "@/lib/types"
import type { DerivedStats } from "@/lib/stats"

export type ExamPlanningReport = {
  state: ExamPlanningState
  label: string
  bookedExamDate: string | null
  suggestedExamDate: string | null
  countdownCopy: string
  countdownDays: number | null
  eligibleAccuracyPct: number | null
  eligibleAnswered: number
  meetsAccuracyBenchmark: boolean
  evidenceReady: boolean
  missingEvidence: string[]
  shouldCreateSuggestedTarget: boolean
  proposedSuggestedDate: string | null
}

export function examCountdownCopy(
  examDate: string | null,
  days: number | null
): { copy: string; days: number | null } {
  if (!examDate) return { copy: "Exam not booked yet.", days: null }
  if (days == null) return { copy: "Exam not booked yet.", days: null }
  if (days < 0) return { copy: "Exam date passed — update exam date.", days }
  if (days === 0) return { copy: "Exam is today.", days }
  return { copy: `${days} day${days === 1 ? "" : "s"} remaining`, days }
}

export function examPlanningLabel(state: ExamPlanningState) {
  switch (state) {
    case "not_ready_to_plan":
      return "Not ready to plan"
    case "building_evidence":
      return "Building evidence"
    case "target_eligible":
      return "Target eligible"
    case "target_date_suggested":
      return "Target date suggested"
    case "exam_booked":
      return "Exam booked"
  }
}

export function computeExamPlanning(
  snapshot: WorkspaceSnapshot,
  stats: DerivedStats,
  countdown: number | null = null
): ExamPlanningReport {
  const settings = snapshot.settings
  const booked = settings.examDate
  const suggested = settings.suggestedExamDate
  const perf = computeEligibleQuestionPerformance(snapshot, settings)
  const subjectsWithData = stats.subjects.filter(
    (s) => s.scored && s.core && s.status !== "not_started" && s.status !== "not_enough_data"
  ).length

  const missingEvidence: string[] = []
  if (perf.answered < settings.minEligibleQuestionsForTarget) {
    missingEvidence.push(
      `Need at least ${settings.minEligibleQuestionsForTarget} eligible answered questions (currently ${perf.answered}).`
    )
  }
  if (!perf.meetsBenchmark) {
    missingEvidence.push(
      `Need at least ${Math.round(settings.questionAccuracyGoal * 100)}% combined eligible accuracy` +
        (perf.accuracyPct != null ? ` (currently ${perf.accuracyPct}%).` : " (no accuracy yet).")
    )
  }
  if (subjectsWithData < settings.minSubjectsForTarget) {
    missingEvidence.push(
      `Need subject coverage on at least ${settings.minSubjectsForTarget} core subjects (currently ${subjectsWithData}).`
    )
  }
  if (stats.mockCount < settings.minMocksForTarget) {
    missingEvidence.push(
      `Need at least ${settings.minMocksForTarget} formal mock/practice assessment` +
        (settings.minMocksForTarget === 1 ? "" : "s") +
        ` (currently ${stats.mockCount}).`
    )
  }

  const evidenceReady = missingEvidence.length === 0
  const { copy, days } = examCountdownCopy(booked, countdown)

  let state: ExamPlanningState
  if (booked) state = "exam_booked"
  else if (suggested) state = "target_date_suggested"
  else if (evidenceReady) state = "target_eligible"
  else if (perf.answered > 0 || stats.rhythm.studyDaysLast28 > 0) state = "building_evidence"
  else state = "not_ready_to_plan"

  const shouldCreateSuggestedTarget = !booked && !suggested && evidenceReady
  const proposedSuggestedDate = shouldCreateSuggestedTarget
    ? addDaysKey(todayKey(settings.timezone), settings.suggestedExamHorizonDays)
    : null

  return {
    state,
    label: examPlanningLabel(state),
    bookedExamDate: booked,
    suggestedExamDate: suggested,
    countdownCopy: copy,
    countdownDays: days,
    eligibleAccuracyPct: perf.accuracyPct,
    eligibleAnswered: perf.answered,
    meetsAccuracyBenchmark: perf.meetsBenchmark,
    evidenceReady,
    missingEvidence,
    shouldCreateSuggestedTarget,
    proposedSuggestedDate,
  }
}

export function withSuggestedExamTarget(
  settings: Settings,
  date: string,
  createdAt = new Date().toISOString()
): Settings {
  if (settings.suggestedExamDate) return settings
  return {
    ...settings,
    suggestedExamDate: date,
    suggestedExamCreatedAt: createdAt,
  }
}
