import type { QuestionBlock, TestMock } from "@/lib/types"

export function attemptedCount(row: { correct: number; incorrect: number }) {
  return row.correct + row.incorrect
}

export function accuracyOf(row: { correct: number; incorrect: number }): number | null {
  const attempted = attemptedCount(row)
  if (attempted <= 0) return null
  return row.correct / attempted
}

export function scoreOf(row: { correct: number; total: number }): number | null {
  if (row.total <= 0) return null
  return row.correct / row.total
}

export function countsValid(row: {
  total: number
  correct: number
  incorrect: number
  skipped: number
}) {
  return (
    row.total > 0 &&
    row.correct >= 0 &&
    row.incorrect >= 0 &&
    row.skipped >= 0 &&
    row.correct + row.incorrect + row.skipped === row.total
  )
}

export function performanceBand(
  accuracy: number | null,
  goal: number
): "strong" | "fair" | "needs_review" | null {
  if (accuracy == null) return null
  if (accuracy >= goal) return "strong"
  if (accuracy >= goal - 0.1) return "fair"
  return "needs_review"
}

export function isMockType(
  assessmentTypeId: string,
  catalogs: { id: string; meta: { countsAsMock?: boolean } }[]
) {
  return Boolean(catalogs.find((c) => c.id === assessmentTypeId)?.meta.countsAsMock)
}

export function shrinkAccuracy(
  correct: number,
  attempted: number,
  prior: number,
  priorStrength: number
) {
  if (attempted <= 0 && priorStrength <= 0) return null
  return (correct + priorStrength * prior) / (attempted + priorStrength)
}

export function volumeFactor(n: number, halfLife: number) {
  if (halfLife <= 0) return n > 0 ? 1 : 0
  return 1 - Math.exp(-n / halfLife)
}

export function sumQuestions(rows: Array<Pick<QuestionBlock | TestMock, "total" | "correct" | "incorrect">>) {
  return rows.reduce(
    (acc, r) => {
      acc.total += r.total
      acc.correct += r.correct
      acc.incorrect += r.incorrect
      return acc
    },
    { total: 0, correct: 0, incorrect: 0 }
  )
}
