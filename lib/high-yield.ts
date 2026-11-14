import type { HighYieldPriority, HighYieldStatus, HighYieldTopic } from "@/lib/types"

/**
 * Filipe Santos high-yield topic catalog.
 * Source material was not present in this repository — keep empty and import-ready.
 */
export const FILIPE_SANTOS_SOURCE = "filipe-santos-mccqe1"
export const FILIPE_SANTOS_CATALOG: Omit<HighYieldTopic, "id" | "createdAt" | "updatedAt" | "status" | "notes">[] = []

export function highYieldStatusLabel(status: HighYieldStatus) {
  switch (status) {
    case "not_started":
      return "Not started"
    case "in_progress":
      return "In progress"
    case "completed":
      return "Completed"
    case "needs_review":
      return "Needs review"
  }
}

export function highYieldPriorityLabel(priority: HighYieldPriority) {
  switch (priority) {
    case "very_high":
      return "Very high"
    case "high":
      return "High"
    case "medium":
      return "Medium"
    case "low":
      return "Low"
  }
}

export function summarizeHighYield(topics: HighYieldTopic[]) {
  const total = topics.length
  const completed = topics.filter((t) => t.status === "completed").length
  const needsReview = topics.filter((t) => t.status === "needs_review").length
  const remainingVeryHigh = topics.filter(
    (t) => t.priority === "very_high" && t.status !== "completed"
  ).length
  const remainingHigh = topics.filter((t) => t.priority === "high" && t.status !== "completed").length
  const bySubject = new Map<string, { total: number; completed: number }>()
  for (const t of topics) {
    const cur = bySubject.get(t.subject) ?? { total: 0, completed: 0 }
    cur.total += 1
    if (t.status === "completed") cur.completed += 1
    bySubject.set(t.subject, cur)
  }
  return {
    total,
    completed,
    needsReview,
    remainingVeryHigh,
    remainingHigh,
    bySubject: [...bySubject.entries()]
      .map(([subject, v]) => ({ subject, ...v }))
      .sort((a, b) => a.subject.localeCompare(b.subject)),
    sourceMissing: total === 0,
  }
}
