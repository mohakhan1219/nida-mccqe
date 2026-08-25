import { isSameDay, parseISO, subDays } from "date-fns"
import { formatInTimeZone, toZonedTime } from "date-fns-tz"
import type { EvidenceConfidence, ReadinessState, SubjectStatus } from "@/lib/types"
import type { SubjectHealth } from "@/lib/stats"
import type { ReadinessReport } from "@/lib/readiness"

export function showReadinessPercent(report: Pick<ReadinessReport, "state" | "confidence">) {
  return report.state !== "building_baseline" && report.confidence !== "insufficient"
}

export function evidenceBandLabel(c: EvidenceConfidence): "Low" | "Moderate" | "High" {
  if (c === "moderate") return "Moderate"
  if (c === "high") return "High"
  return "Low"
}

export function overallStageLabel(
  state: ReadinessState,
  examDate: string | null
): "Building Foundation" | "Progressing" | "Getting Close" | "Ready to Book" | "Exam Ready" {
  if (state === "ready_to_book") return examDate ? "Exam Ready" : "Ready to Book"
  if (state === "getting_close") return "Getting Close"
  if (state === "progressing") return "Progressing"
  return "Building Foundation"
}

export function examTrackLabel(report: ReadinessReport): "On track" | "Attention needed" | null {
  if (!report.examDate) return null
  if (report.state === "ready_to_book" || report.state === "getting_close") return "On track"
  return "Attention needed"
}

export type SubjectDisplayStatus = "Not Started" | "Started" | "In Progress" | "Needs Review" | "Strong"

export function subjectDisplayStatus(status: SubjectStatus): SubjectDisplayStatus {
  switch (status) {
    case "not_started":
      return "Not Started"
    case "not_enough_data":
      return "Started"
    case "needs_focus":
      return "Needs Review"
    case "strong":
      return "Strong"
    default:
      return "In Progress"
  }
}

export type OpsSubjectChip = "Strong" | "Improving" | "Needs Review" | "Stale" | "Not Started"

export function opsSubjectChip(s: SubjectHealth): OpsSubjectChip {
  if (s.status === "not_started") return "Not Started"
  if (s.daysSince != null && s.daysSince > 14) return "Stale"
  if (s.status === "needs_focus") return "Needs Review"
  if (s.status === "strong") return "Strong"
  if (s.trend === "up") return "Improving"
  if (s.trend === "down") return "Needs Review"
  return "Improving"
}

export type GoalStatus = "progress" | "met" | "exceeded"

export function goalProgress(actual: number, goal: number) {
  if (!(goal > 0)) {
    return { actual, goal, percent: 0, bar: 0, status: "progress" as GoalStatus }
  }
  const percent = (actual / goal) * 100
  const status: GoalStatus = actual > goal ? "exceeded" : actual >= goal ? "met" : "progress"
  return {
    actual,
    goal,
    percent,
    bar: Math.min(100, percent),
    status,
  }
}

export function formatHoursAmount(hours: number) {
  const rounded = Math.round(hours * 10) / 10
  if (Math.abs(rounded) < 0.05) return "0h"
  return `${rounded.toFixed(1)}h`
}

export function goalHoursCopy(actual: number, goal: number) {
  const g = goalProgress(actual, goal)
  const base = `${formatHoursAmount(g.actual)} of ${formatHoursAmount(g.goal)}`
  const pct = `${Math.round(g.percent)}%`
  if (g.status === "exceeded") return `${base} · ${pct} · Goal exceeded`
  if (g.status === "met") return `${base} · ${pct} · Goal met`
  return `${base} · ${pct}`
}

export function goalCountCopy(actual: number, goal: number, unit = "") {
  const g = goalProgress(actual, goal)
  const suffix = unit ? ` ${unit}` : ""
  const base = `${Math.round(g.actual)} of ${Math.round(g.goal)}${suffix}`
  const pct = `${Math.round(g.percent)}%`
  if (g.status === "exceeded") return `${base} · ${pct} · Goal exceeded`
  if (g.status === "met") return `${base} · ${pct} · Goal met`
  return `${base} · ${pct}`
}

export function formatLastActivity(iso: string | null, timeZone = "America/Toronto", now = new Date()) {
  if (!iso) return "No activity yet"
  const d = parseISO(iso)
  if (!Number.isFinite(d.getTime())) return "—"
  const mins = Math.round((now.getTime() - d.getTime()) / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min ago`
  const zonedNow = toZonedTime(now, timeZone)
  const zonedThen = toZonedTime(d, timeZone)
  const time = formatInTimeZone(d, timeZone, "h:mm a")
  if (isSameDay(zonedThen, zonedNow)) return `Today, ${time}`
  if (isSameDay(zonedThen, subDays(zonedNow, 1))) return `Yesterday, ${time}`
  if (mins < 36 * 60) return `${Math.round(mins / 60)}h ago`
  return formatInTimeZone(d, timeZone, "MMM d, h:mm a")
}

export function weeklyGoalsHeadline(
  hours: ReturnType<typeof goalProgress>,
  questions: ReturnType<typeof goalProgress>
) {
  const line = `${Math.round(hours.percent)}% hours · ${Math.round(questions.percent)}% questions`
  const status: "Goal Exceeded" | "Goal Met" | null =
    hours.status === "exceeded" || questions.status === "exceeded"
      ? "Goal Exceeded"
      : hours.status === "met" || questions.status === "met"
        ? "Goal Met"
        : null
  return { line, status }
}

export function subjectHealthCopy(value: number | null) {
  if (value == null) return "—"
  return `${Math.round(value)} / 100`
}

export function humanizeSettingKey(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())
}

export function warmCopy(text: string) {
  return text
    .replace(
      /Keep logging honest sessions\. Mock exams can wait until volume is more stable\./g,
      "Keep building your study record. Mock exams can wait until volume is more stable."
    )
    .replace(/Keep logging honest sessions\.?/g, "Keep building your study record.")
}

export function reviewCycle(row: {
  firstReviewAt: string | null
  secondReviewAt: string | null
  thirdReviewAt: string | null
  status: string
}) {
  if (row.status === "completed") {
    return { cycle: 3 as const, label: "Cycle 3 of 3", next: null as string | null }
  }
  const today = new Date().toISOString().slice(0, 10)
  const dates = [row.firstReviewAt, row.secondReviewAt, row.thirdReviewAt]
  let cycle = 1
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i]
    if (d && d < today) cycle = Math.min(3, i + 2)
    else if (d) {
      cycle = i + 1
      break
    }
  }
  const next = dates.find((d) => d && d >= today) ?? dates.filter(Boolean).at(-1) ?? null
  return { cycle: cycle as 1 | 2 | 3, label: `Cycle ${cycle} of 3`, next }
}
