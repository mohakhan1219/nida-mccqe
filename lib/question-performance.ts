import { dayKey } from "@/lib/dates"
import { accuracyOf } from "@/lib/metrics"
import type {
  QBankSnapshot,
  QuestionBlock,
  Settings,
  TestMock,
  WorkspaceSnapshot,
} from "@/lib/types"

export type EligibleTotals = {
  correct: number
  incorrect: number
  skipped: number
  answered: number
  accuracy: number | null
  accuracyPct: number | null
  meetsBenchmark: boolean
}

export type SourceReconcileRow = {
  sourceId: string
  sourceName: string
  snapshot: QBankSnapshot | null
  appLoggedAnswered: number
  appLoggedCorrect: number
  appLoggedIncorrect: number
  appLoggedSkipped: number
  appOverlapAnswered: number
  appAfterSnapshotAnswered: number
  reconciledAnswered: number
  reconciledCorrect: number
  reconciledIncorrect: number
  reconciledSkipped: number
  accuracy: number | null
  overlapFlag: "none" | "possible_overlap" | "no_snapshot"
  explanation: string
}

/** Cumulative platform-style QBanks (snapshots supersede overlapping app logs). */
const QBANK_SOURCE_SLUGS = new Set(["uworld", "ace-qbank", "canadaqbank"])

/** All sources that feed the 72% / 4,000-question eligible pool. */
const ELIGIBLE_SOURCE_SLUGS = new Set([
  "uworld",
  "ace-qbank",
  "canadaqbank",
  "mcc-practice",
  "abzi",
])

/** Primary Journey dashboard resources (always shown; empty until Nida enters data). */
export const QBANK_DASHBOARD_SLUGS = ["uworld", "ace-qbank", "mcc-practice", "abzi"] as const

export function isQBankSourceId(sourceId: string) {
  return (
    sourceId.includes("uworld") ||
    sourceId.includes("ace-qbank") ||
    sourceId.includes("canadaqbank")
  )
}

export function isEligibleQuestionSourceId(sourceId: string) {
  return [...ELIGIBLE_SOURCE_SLUGS].some((slug) => sourceId.includes(slug))
}

export function latestSnapshotsBySource(snapshots: QBankSnapshot[]) {
  const map = new Map<string, QBankSnapshot>()
  const sorted = [...snapshots].sort((a, b) => {
    const d = b.asOfDate.localeCompare(a.asOfDate)
    if (d !== 0) return d
    return b.createdAt.localeCompare(a.createdAt)
  })
  for (const snap of sorted) {
    if (!map.has(snap.sourceId)) map.set(snap.sourceId, snap)
  }
  return map
}

function answeredOf(row: { correct: number; incorrect: number }) {
  return row.correct + row.incorrect
}

function snapshotAnswered(snap: QBankSnapshot) {
  const correct = snap.correct ?? 0
  const incorrect = snap.incorrect ?? 0
  if (snap.correct != null || snap.incorrect != null) return correct + incorrect
  if (snap.used != null) return snap.used
  return 0
}

/**
 * Reconcile app-logged question blocks with cumulative QBank snapshots.
 * Latest snapshot is authoritative for that source up to asOfDate.
 * Blocks dated after asOfDate are additive. Blocks on/before asOfDate are
 * treated as already included (possible overlap — never double-count).
 */
export function reconcileSourcePerformance(
  snapshot: WorkspaceSnapshot,
  sourceId: string
): SourceReconcileRow {
  const sourceName = snapshot.catalogs.find((c) => c.id === sourceId)?.name ?? sourceId
  const latest = latestSnapshotsBySource(snapshot.qbankSnapshots).get(sourceId) ?? null
  const tz = snapshot.settings.timezone
  const blocks = snapshot.blocks.filter((b) => b.sourceId === sourceId)
  const tests = snapshot.tests.filter((t) => t.sourceId === sourceId)

  let appLoggedCorrect = 0
  let appLoggedIncorrect = 0
  let appLoggedSkipped = 0
  let appOverlapAnswered = 0
  let appAfterCorrect = 0
  let appAfterIncorrect = 0
  let appAfterSkipped = 0

  const consider = (row: QuestionBlock | TestMock) => {
    const day = dayKey(row.startAt, tz)
    appLoggedCorrect += row.correct
    appLoggedIncorrect += row.incorrect
    appLoggedSkipped += row.skipped
    if (!latest) return
    if (day <= latest.asOfDate) {
      appOverlapAnswered += answeredOf(row)
    } else {
      appAfterCorrect += row.correct
      appAfterIncorrect += row.incorrect
      appAfterSkipped += row.skipped
    }
  }
  blocks.forEach(consider)
  tests.forEach(consider)

  const appLoggedAnswered = appLoggedCorrect + appLoggedIncorrect
  const appAfterSnapshotAnswered = appAfterCorrect + appAfterIncorrect

  if (!latest) {
    return {
      sourceId,
      sourceName,
      snapshot: null,
      appLoggedAnswered,
      appLoggedCorrect,
      appLoggedIncorrect,
      appLoggedSkipped,
      appOverlapAnswered: 0,
      appAfterSnapshotAnswered: 0,
      reconciledAnswered: appLoggedAnswered,
      reconciledCorrect: appLoggedCorrect,
      reconciledIncorrect: appLoggedIncorrect,
      reconciledSkipped: appLoggedSkipped,
      accuracy: accuracyOf({ correct: appLoggedCorrect, incorrect: appLoggedIncorrect }),
      overlapFlag: "no_snapshot",
      explanation:
        appLoggedAnswered > 0
          ? "Using app-logged questions only. Add a cumulative platform snapshot to avoid double-counting historical QBank work."
          : "No platform snapshot and no app-logged questions yet.",
    }
  }

  const snapCorrect = latest.correct ?? 0
  const snapIncorrect = latest.incorrect ?? 0
  const snapSkipped = latest.skipped ?? 0
  const hasBreakdown = latest.correct != null || latest.incorrect != null
  const snapAns = snapshotAnswered(latest)

  const reconciledCorrect = hasBreakdown ? snapCorrect + appAfterCorrect : appAfterCorrect
  const reconciledIncorrect = hasBreakdown ? snapIncorrect + appAfterIncorrect : appAfterIncorrect
  const reconciledSkipped = snapSkipped + appAfterSkipped
  const reconciledAnswered = hasBreakdown
    ? snapAns + appAfterSnapshotAnswered
    : snapAns > 0
      ? snapAns + appAfterSnapshotAnswered
      : appAfterSnapshotAnswered

  return {
    sourceId,
    sourceName,
    snapshot: latest,
    appLoggedAnswered,
    appLoggedCorrect,
    appLoggedIncorrect,
    appLoggedSkipped,
    appOverlapAnswered,
    appAfterSnapshotAnswered,
    reconciledAnswered,
    reconciledCorrect,
    reconciledIncorrect,
    reconciledSkipped,
    accuracy: hasBreakdown
      ? accuracyOf({ correct: reconciledCorrect, incorrect: reconciledIncorrect })
      : snapAns > 0
        ? null
        : accuracyOf({ correct: reconciledCorrect, incorrect: reconciledIncorrect }),
    overlapFlag: appOverlapAnswered > 0 ? "possible_overlap" : "none",
    explanation:
      appOverlapAnswered > 0
        ? `Platform snapshot (${latest.asOfDate}) is authoritative for cumulative totals. ${appOverlapAnswered} app-logged answered questions on or before that date are treated as already included and are not added again.`
        : appAfterSnapshotAnswered > 0
          ? `Platform snapshot (${latest.asOfDate}) plus ${appAfterSnapshotAnswered} app-logged answered questions after that date.`
          : `Using platform snapshot from ${latest.asOfDate} as the current cumulative total.`,
  }
}

export function eligibleQuestionSources(snapshot: WorkspaceSnapshot) {
  const fromCatalog = snapshot.catalogs
    .filter(
      (c) =>
        c.kind === "source" &&
        (ELIGIBLE_SOURCE_SLUGS.has(c.slug) || c.meta.sourceKind === "qbank" || QBANK_SOURCE_SLUGS.has(c.slug))
    )
    .map((c) => c.id)
  const fromData = [
    ...snapshot.blocks.map((b) => b.sourceId),
    ...snapshot.tests.map((t) => t.sourceId),
    ...snapshot.qbankSnapshots.map((s) => s.sourceId),
  ]
  return [...new Set([...fromCatalog, ...fromData.filter(isEligibleQuestionSourceId)])]
}

export type QBankDashboardRow = SourceReconcileRow & {
  slug: string
  totalAvailable: number | null
  usedOrCompleted: number | null
  remaining: number | null
  lastUpdated: string | null
  supportsRemaining: boolean
}

/**
 * Central dashboard rows for UWorld, ACE QBank, MCC practice, and ABZI.
 * Never invents totals — empty until snapshots or app-logged assessments exist.
 */
export function buildQBankDashboard(snapshot: WorkspaceSnapshot): QBankDashboardRow[] {
  const bySlug = new Map(snapshot.catalogs.filter((c) => c.kind === "source").map((c) => [c.slug, c]))
  return QBANK_DASHBOARD_SLUGS.map((slug) => {
    const catalog = bySlug.get(slug)
    const sourceId = catalog?.id ?? `source:${slug}`
    const sourceName = catalog?.name ?? slug
    const recon = reconcileSourcePerformance(snapshot, sourceId)
    const snap = recon.snapshot
    const supportsRemaining = slug === "uworld" || slug === "ace-qbank"
    const usedOrCompleted =
      snap?.used ??
      (recon.reconciledAnswered > 0 ? recon.reconciledAnswered : null)
    const remaining =
      snap?.unused ??
      (supportsRemaining && snap?.totalAvailable != null && usedOrCompleted != null
        ? Math.max(0, snap.totalAvailable - usedOrCompleted)
        : null)
    return {
      ...recon,
      sourceId,
      sourceName,
      slug,
      totalAvailable: snap?.totalAvailable ?? null,
      usedOrCompleted,
      remaining,
      lastUpdated: snap?.asOfDate ?? snap?.updatedAt?.slice(0, 10) ?? null,
      supportsRemaining,
    }
  })
}

/**
 * Combined eligible accuracy = total correct / total answered across reconciled
 * UWorld, ACE, MCC practice, ABZI (and other eligible sources), without double-counting
 * app logs already covered by a cumulative platform snapshot.
 */
export function computeEligibleQuestionPerformance(
  snapshot: WorkspaceSnapshot,
  settings: Settings = snapshot.settings
): EligibleTotals & { bySource: SourceReconcileRow[]; nonQbankAnswered: number } {
  const eligibleIds = new Set(eligibleQuestionSources(snapshot))
  const bySource = [...eligibleIds].map((id) => reconcileSourcePerformance(snapshot, id))

  let correct = bySource.reduce((a, r) => a + r.reconciledCorrect, 0)
  let incorrect = bySource.reduce((a, r) => a + r.reconciledIncorrect, 0)
  let skipped = bySource.reduce((a, r) => a + r.reconciledSkipped, 0)

  let nonQbankAnswered = 0
  const includeRow = (row: { sourceId: string; correct: number; incorrect: number; skipped: number }) => {
    if (eligibleIds.has(row.sourceId) || isEligibleQuestionSourceId(row.sourceId)) return
    correct += row.correct
    incorrect += row.incorrect
    skipped += row.skipped
    nonQbankAnswered += answeredOf(row)
  }
  snapshot.blocks.forEach(includeRow)
  snapshot.tests.forEach(includeRow)

  const answered = correct + incorrect
  const accuracy = answered > 0 ? correct / answered : null
  const accuracyPct = accuracy == null ? null : Math.round(accuracy * 1000) / 10
  return {
    correct,
    incorrect,
    skipped,
    answered,
    accuracy,
    accuracyPct,
    meetsBenchmark: accuracy != null && accuracy >= settings.questionAccuracyGoal,
    bySource,
    nonQbankAnswered,
  }
}

export function validateQBankSnapshotInput(input: {
  totalAvailable: number | null
  used: number | null
  unused: number | null
  correct: number | null
  incorrect: number | null
  skipped: number | null
}) {
  const warnings: string[] = []
  const { totalAvailable, used, unused, correct, incorrect, skipped } = input
  if (totalAvailable != null && used != null && unused != null && totalAvailable !== used + unused) {
    warnings.push("Total available does not equal used + unused. Platforms sometimes disagree after resets or repeats — saved as entered.")
  }
  if (used != null && correct != null && incorrect != null && skipped != null) {
    if (correct + incorrect + skipped !== used) {
      warnings.push("Used does not equal correct + incorrect + skipped. Skipped stays out of the accuracy denominator.")
    }
  }
  if (correct != null && incorrect != null && correct + incorrect === 0 && (used ?? 0) > 0) {
    warnings.push("Used questions are present but no correct/incorrect breakdown — accuracy will be unavailable until breakdown is provided.")
  }
  return warnings
}
