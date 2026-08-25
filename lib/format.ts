export function newId() {
  return crypto.randomUUID()
}

export function cnHours(minutes: number | null | undefined) {
  if (minutes == null || Number.isNaN(minutes)) return "—"
  const h = minutes / 60
  if (h < 0.05) return `${Math.round(minutes)}m`
  const rounded = Math.round(h * 10) / 10
  return `${rounded.toFixed(1)}h`
}

export function formatDurationClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":")
}

export function formatPercent(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—"
  return `${(n * 100).toFixed(digits)}%`
}

export function formatScore(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—"
  return `${Math.round(n)}`
}

export function titleCaseState(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
