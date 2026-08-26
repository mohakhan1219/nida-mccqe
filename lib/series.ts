import { creditedDurationMinutes } from "@/lib/session-safety"
import { addDaysKey, dayKey, todayKey } from "@/lib/dates"
import { accuracyOf, isMockType, scoreOf } from "@/lib/metrics"
import { computeReadiness } from "@/lib/readiness"
import { deriveStats } from "@/lib/stats"
import { showReadinessPercent } from "@/lib/display"
import type { WorkspaceSnapshot } from "@/lib/types"

export function enumerateDays(startKey: string, endKey: string) {
  const days: string[] = []
  let cursor = startKey
  let guard = 0
  while (cursor <= endKey && guard < 400) {
    days.push(cursor)
    cursor = addDaysKey(cursor, 1)
    guard += 1
  }
  return days
}

export function dailyStudyHours(snapshot: WorkspaceSnapshot, startKey: string, endKey: string) {
  const tz = snapshot.settings.timezone
  const byDay = new Map<string, number>()
  for (const s of snapshot.sessions) {
    const minutes = creditedDurationMinutes(s, snapshot.settings)
    if (minutes <= 0) continue
    const k = dayKey(s.startAt, tz)
    if (k < startKey || k > endKey) continue
    byDay.set(k, (byDay.get(k) ?? 0) + minutes / 60)
  }
  return enumerateDays(startKey, endKey).map((date) => ({
    date,
    hours: Math.round((byDay.get(date) ?? 0) * 100) / 100,
  }))
}

export function dailyQuestions(snapshot: WorkspaceSnapshot, startKey: string, endKey: string) {
  const tz = snapshot.settings.timezone
  const byDay = new Map<string, number>()
  for (const b of snapshot.blocks) {
    const k = dayKey(b.startAt, tz)
    if (k < startKey || k > endKey) continue
    byDay.set(k, (byDay.get(k) ?? 0) + b.total)
  }
  for (const t of snapshot.tests) {
    const k = dayKey(t.startAt, tz)
    if (k < startKey || k > endKey) continue
    byDay.set(k, (byDay.get(k) ?? 0) + t.total)
  }
  return enumerateDays(startKey, endKey).map((date) => ({
    date,
    questions: byDay.get(date) ?? 0,
  }))
}

export function accuracySeries(snapshot: WorkspaceSnapshot, limit = 12) {
  const rows = [
    ...snapshot.blocks.map((b) => ({
      at: b.startAt,
      accuracy: accuracyOf(b),
      label: b.startAt.slice(0, 10),
    })),
    ...snapshot.tests.map((t) => ({
      at: t.startAt,
      accuracy: accuracyOf(t),
      label: t.startAt.slice(0, 10),
    })),
  ]
    .filter((r) => r.accuracy != null)
    .sort((a, b) => a.at.localeCompare(b.at))
  return rows.slice(-limit).map((r, i) => ({
    i: i + 1,
    date: r.label,
    accuracy: Math.round((r.accuracy ?? 0) * 1000) / 10,
  }))
}

export function mockSeries(snapshot: WorkspaceSnapshot) {
  return snapshot.tests
    .filter((t) => isMockType(t.assessmentTypeId, snapshot.catalogs))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((t, i) => ({
      i: i + 1,
      date: t.startAt.slice(0, 10),
      name: t.testName || "Mock",
      score: Math.round((scoreOf(t) ?? 0) * 1000) / 10,
    }))
}

export function snapshotAsOf(snapshot: WorkspaceSnapshot, day: string): WorkspaceSnapshot {
  const tz = snapshot.settings.timezone
  const keep = (iso: string) => dayKey(iso, tz) <= day
  return {
    ...snapshot,
    sessions: snapshot.sessions.filter((s) => keep(s.startAt)),
    blocks: snapshot.blocks.filter((b) => keep(b.startAt)),
    tests: snapshot.tests.filter((t) => keep(t.startAt)),
    reviews: snapshot.reviews.filter((r) => r.createdAt.slice(0, 10) <= day),
  }
}

export function readinessTrend(snapshot: WorkspaceSnapshot, startKey: string, endKey: string) {
  return enumerateDays(startKey, endKey)
    .map((date) => {
      const cut = snapshotAsOf(snapshot, date)
      const stats = deriveStats(cut, new Date(`${date}T17:00:00Z`))
      const report = computeReadiness(cut, stats)
      return {
        date,
        score: showReadinessPercent(report) ? report.score : null,
      }
    })
    .filter((r) => r.score != null)
}

export function currentWeekKeys(snapshot: WorkspaceSnapshot) {
  const tz = snapshot.settings.timezone
  const today = todayKey(tz)
  const start = (() => {
    const [y, m, d] = today.split("-").map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    const dow = dt.getUTCDay()
    const diff = dow === 0 ? 6 : dow - 1
    return addDaysKey(today, -diff)
  })()
  return { start, end: addDaysKey(start, 6), today }
}
