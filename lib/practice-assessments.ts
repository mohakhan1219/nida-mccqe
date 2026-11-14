import type { PracticeAssessment, PracticeAssessmentProvider } from "@/lib/types"

export const PRACTICE_ASSESSMENT_PROVIDERS: {
  id: PracticeAssessmentProvider
  label: string
}[] = [
  { id: "mccqe1_official_practice", label: "MCCQE1 official practice (full-length)" },
  { id: "uworld", label: "UWorld" },
  { id: "ace", label: "ACE QBank" },
  { id: "abzi", label: "ABZI" },
  { id: "mcc", label: "MCC practice" },
  { id: "other", label: "Other practice assessment" },
]

export function practiceProviderLabel(provider: PracticeAssessmentProvider) {
  return PRACTICE_ASSESSMENT_PROVIDERS.find((p) => p.id === provider)?.label ?? provider
}

export function upcomingPracticeAssessments(
  rows: PracticeAssessment[],
  today: string,
  limit = 8
) {
  return rows
    .filter((r) => r.status === "scheduled" && r.scheduledDate >= today)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .slice(0, limit)
}

export function completedPracticeAssessments(rows: PracticeAssessment[]) {
  return rows
    .filter((r) => r.status === "completed")
    .sort((a, b) => (b.completedDate ?? "").localeCompare(a.completedDate ?? ""))
}

/** Score % from totals when not entered explicitly. */
export function scorePctFromTotals(total: number | null, correct: number | null) {
  if (total == null || correct == null || total <= 0) return null
  return Math.round((correct / total) * 1000) / 10
}
