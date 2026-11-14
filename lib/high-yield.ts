import { FILIPE_SANTOS_CATALOG_META, FILIPE_SANTOS_CATALOG_TOPICS } from "@/lib/data/filipe-santos-catalog"
import { newId } from "@/lib/format"
import type { HighYieldPriority, HighYieldStatus, HighYieldTopic } from "@/lib/types"

/**
 * Filipe Santos high-yield topic catalog (Most Important Topics for the MCCQE1,
 * Dr. Filipe Nadir Caparica Santos, MD — February 2026, First Edition).
 * Topics were extracted from the licensed PDF; nothing was invented.
 */
export const FILIPE_SANTOS_SOURCE = FILIPE_SANTOS_CATALOG_META.source
export const FILIPE_SANTOS_CATALOG_TITLE = FILIPE_SANTOS_CATALOG_META.title
export const FILIPE_SANTOS_CATALOG = FILIPE_SANTOS_CATALOG_TOPICS

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
  const byPriority = new Map<HighYieldPriority, { total: number; completed: number }>()
  for (const t of topics) {
    const cur = bySubject.get(t.subject) ?? { total: 0, completed: 0 }
    cur.total += 1
    if (t.status === "completed") cur.completed += 1
    bySubject.set(t.subject, cur)
    const p = byPriority.get(t.priority) ?? { total: 0, completed: 0 }
    p.total += 1
    if (t.status === "completed") p.completed += 1
    byPriority.set(t.priority, p)
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
    byPriority: [...byPriority.entries()].map(([priority, v]) => ({ priority, ...v })),
    sourceMissing: total === 0 && FILIPE_SANTOS_CATALOG.length === 0,
    catalogReady: FILIPE_SANTOS_CATALOG.length > 0,
    catalogCount: FILIPE_SANTOS_CATALOG.length,
  }
}

function topicMatchKey(t: Pick<HighYieldTopic, "catalogKey" | "source" | "subject" | "topic">) {
  if (t.catalogKey) return `key:${t.catalogKey}`
  return `st:${t.source}::${t.subject}::${t.topic}`
}

/**
 * Idempotent merge of the Filipe Santos catalog into existing tracker rows.
 * - Never duplicates catalog topics already present (by catalogKey or subject+topic+source).
 * - Never overwrites Nida's status, notes, or progress on existing rows.
 * - Updates sort order / priority from the catalog when a row already exists (metadata only).
 */
export function mergeFilipeSantosCatalog(
  existing: HighYieldTopic[],
  now = new Date().toISOString()
): { topics: HighYieldTopic[]; added: number; updatedMeta: number } {
  const byKey = new Map<string, HighYieldTopic>()
  for (const row of existing) {
    byKey.set(topicMatchKey(row), row)
  }

  let added = 0
  let updatedMeta = 0
  const next = [...existing]

  for (const item of FILIPE_SANTOS_CATALOG) {
    const key = `key:${item.catalogKey}`
    const alt = `st:${FILIPE_SANTOS_SOURCE}::${item.subject}::${item.topic}`
    const found = byKey.get(key) ?? byKey.get(alt)
    if (found) {
      const idx = next.findIndex((t) => t.id === found.id)
      if (idx >= 0) {
        const cur = next[idx]
        if (
          cur.priority !== item.priority ||
          cur.sortOrder !== item.sortOrder ||
          cur.catalogKey !== item.catalogKey ||
          cur.source !== FILIPE_SANTOS_SOURCE
        ) {
          next[idx] = {
            ...cur,
            priority: item.priority,
            sortOrder: item.sortOrder,
            catalogKey: item.catalogKey,
            source: FILIPE_SANTOS_SOURCE,
            updatedAt: now,
          }
          updatedMeta += 1
        }
      }
      continue
    }
    const row: HighYieldTopic = {
      id: newId(),
      subject: item.subject,
      topic: item.topic,
      priority: item.priority,
      status: "not_started",
      notes: "",
      source: FILIPE_SANTOS_SOURCE,
      catalogKey: item.catalogKey,
      sortOrder: item.sortOrder,
      createdAt: now,
      updatedAt: now,
    }
    next.push(row)
    byKey.set(key, row)
    byKey.set(alt, row)
    added += 1
  }

  return { topics: next, added, updatedMeta }
}

export function filterHighYieldTopics(
  topics: HighYieldTopic[],
  opts: { subject?: string; priority?: HighYieldPriority | "all" | "" }
) {
  return topics
    .filter((t) => (opts.subject ? t.subject === opts.subject : true))
    .filter((t) => (opts.priority && opts.priority !== "all" ? t.priority === opts.priority : true))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.topic.localeCompare(b.topic))
}

export function highYieldSubjects(topics: HighYieldTopic[]) {
  return [...new Set(topics.map((t) => t.subject))].sort((a, b) => a.localeCompare(b))
}
