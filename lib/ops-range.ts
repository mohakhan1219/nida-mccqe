import { addDaysKey, dayKey, todayKey } from "@/lib/dates"
import type { WorkspaceSnapshot } from "@/lib/types"

export type OpsRange = "today" | "7d" | "30d" | "all"

export type OpsFilters = {
  range: OpsRange
  subjectId: string
  sourceId: string
  assessmentTypeId: string
}

export function defaultOpsFilters(): OpsFilters {
  return { range: "7d", subjectId: "", sourceId: "", assessmentTypeId: "" }
}

export function rangeWindow(snapshot: WorkspaceSnapshot, range: OpsRange) {
  const tz = snapshot.settings.timezone
  const end = todayKey(tz)
  if (range === "today") return { start: end, end }
  if (range === "7d") return { start: addDaysKey(end, -6), end }
  if (range === "30d") return { start: addDaysKey(end, -29), end }
  const dates = [
    ...snapshot.sessions.map((s) => dayKey(s.startAt, tz)),
    ...snapshot.blocks.map((b) => dayKey(b.startAt, tz)),
    ...snapshot.tests.map((t) => dayKey(t.startAt, tz)),
  ].sort()
  return { start: dates[0] ?? addDaysKey(end, -6), end }
}

export function applyOpsFilters(snapshot: WorkspaceSnapshot, filters: OpsFilters): WorkspaceSnapshot {
  const { start, end } = rangeWindow(snapshot, filters.range)
  const tz = snapshot.settings.timezone
  const inWin = (iso: string) => {
    const k = dayKey(iso, tz)
    return k >= start && k <= end
  }
  const sub = (id: string) => !filters.subjectId || id === filters.subjectId
  const src = (id: string) => !filters.sourceId || id === filters.sourceId
  const type = (id: string) => !filters.assessmentTypeId || id === filters.assessmentTypeId
  return {
    ...snapshot,
    sessions: snapshot.sessions.filter((s) => inWin(s.startAt) && sub(s.subjectId) && src(s.sourceId)),
    blocks: snapshot.blocks.filter(
      (b) => inWin(b.startAt) && sub(b.subjectId) && src(b.sourceId) && type(b.assessmentTypeId)
    ),
    tests: snapshot.tests.filter(
      (t) => inWin(t.startAt) && sub(t.subjectId) && src(t.sourceId) && type(t.assessmentTypeId)
    ),
    reviews: snapshot.reviews.filter((r) => {
      const created = r.createdAt.slice(0, 10)
      return created >= start && created <= end && sub(r.subjectId) && src(r.providerId)
    }),
  }
}
