"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useWorkspace } from "@/lib/data/workspace-context"
import { todayKey } from "@/lib/dates"
import { cnHours, formatPercent } from "@/lib/format"
import type { SubjectHealth } from "@/lib/stats"
import {
  evidenceBandLabel,
  examCountdownDisplay,
  examTrackLabel,
  overallStageLabel,
  showReadinessPercent,
  subjectDisplayStatus,
  subjectHealthCopy,
  warmCopy,
} from "@/lib/display"
import { quoteContext, selectDailyQuote } from "@/lib/quote-context"
import { accuracySeries, currentWeekKeys, dailyQuestions, dailyStudyHours, mockSeries } from "@/lib/series"
import { GoalMeter } from "@/components/goal-meter"
import { AccuracyLineChart, HoursByDayChart, MockLineChart, QuestionsByDayChart, SubjectBars } from "@/components/mini-charts"
import { NidaPortrait } from "@/components/nida-portrait"
import { AbziJourneyPanel } from "@/components/abzi-journey-panel"
import { ABZI_COURSE_END_DATE, eventDisplayTitle } from "@/lib/abzi-schedule"
import {
  buildQBankDashboard,
  computeEligibleQuestionPerformance,
  validateQBankSnapshotInput,
} from "@/lib/question-performance"
import { computeExamPlanning } from "@/lib/exam-planning"
import { buildPeriodReview, type PeriodReviewWindow } from "@/lib/period-review"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldLabel } from "@/components/field"
import { HighYieldTracker } from "@/components/high-yield-tracker"
import { PracticeExamsPanel } from "@/components/practice-exams-panel"
import type { QBankSnapshot } from "@/lib/types"

export function JourneyView() {
  const {
    snapshot,
    stats,
    readiness,
    loading,
    saveQBankSnapshot,
    resetSuggestedExamTarget,
  } = useWorkspace()
  const day = todayKey(snapshot.settings.timezone)
  const [reviewWindow, setReviewWindow] = useState<PeriodReviewWindow>(60)
  const quote = useMemo(() => {
    const ctx = quoteContext(stats, snapshot.settings.weeklyHourGoal, snapshot.settings.weeklyQuestionGoal)
    return selectDailyQuote(snapshot.quotes, day, ctx)
  }, [snapshot.quotes, snapshot.settings, stats, day])

  const perf = useMemo(() => computeEligibleQuestionPerformance(snapshot), [snapshot])
  const planning = useMemo(
    () => computeExamPlanning(snapshot, stats, readiness.countdown),
    [snapshot, stats, readiness.countdown]
  )
  const review = useMemo(() => buildPeriodReview(snapshot, reviewWindow), [snapshot, reviewWindow])
  const qbankDashboard = useMemo(() => buildQBankDashboard(snapshot), [snapshot])
  const countdown = examCountdownDisplay(readiness)
  const track = examTrackLabel(readiness)

  if (loading) return <p className="text-sm text-muted-foreground">Gathering the record…</p>

  const showScore = showReadinessPercent(readiness)
  const stage = overallStageLabel(readiness.state, readiness.examDate)
  const upcoming = snapshot.schedule
    .filter((r) => r.date >= day && r.status !== "cancelled")
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
    .slice(0, 5)

  const week = currentWeekKeys(snapshot)
  const hourDays = dailyStudyHours(snapshot, week.start, week.today)
  const qDays = dailyQuestions(snapshot, week.start, week.today)
  const acc = accuracySeries(snapshot, 8)
  const mocks = mockSeries(snapshot)

  const scored = stats.subjects.filter((s) => s.scored)
  const active = scored.filter((s) => s.status !== "not_started")
  const strong = active.filter((s) => s.status === "strong")
  const weak = active
    .filter((s) => s.status === "needs_focus" || (s.accuracy != null && s.accuracy < snapshot.settings.accuracyGoal))
    .sort((a, b) => (a.readiness ?? 101) - (b.readiness ?? 101))
    .slice(0, 5)
  const needsReview = active.filter((s) => s.pendingReviews > 0).slice(0, 5)
  const barRows = [...active]
    .sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0))
    .slice(0, 8)
    .map((s) => ({ name: s.name, value: s.readiness ?? 0 }))
  const coveredSubjects = active.filter((s) => s.status !== "not_enough_data").length
  const abziCourse = snapshot.courses.find((c) => c.id === "course:abzi")

  return (
    <div className="space-y-8 pb-10">
      {quote ? (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Good {greeting()}, {snapshot.settings.studentName}. {quote.message}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Good {greeting()}, {snapshot.settings.studentName}.
        </p>
      )}

      <section className="hero-card overflow-hidden">
        <div className="grid items-end md:grid-cols-[minmax(0,1.2fr)_minmax(200px,300px)] lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,340px)]">
          <div className="relative z-10 p-6 pb-2 md:p-8 md:pr-4 md:pb-8">
            <p className="kicker">Your MCCQE1 journey</p>
            <h1 className="font-heading mt-2 text-3xl leading-tight md:text-4xl">
              {showScore ? stage : "Building Your Baseline"}
            </h1>
            {showScore ? (
              <p className="mt-3 font-heading text-5xl tabular text-primary">{readiness.score}</p>
            ) : (
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                A readiness percentage appears once the record is strong enough. Question accuracy is tracked separately.
              </p>
            )}
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{warmCopy(readiness.why)}</p>
            <p className="mt-4 text-sm">
              <span className="text-muted-foreground">Exam booking · </span>
              {countdown.headline}
              {track && readiness.examDate && readiness.countdown != null && readiness.countdown >= 0
                ? ` · ${track}`
                : ""}
            </p>
            <p className="mt-2 text-xs tracking-wide text-muted-foreground uppercase">
              Planning · {planning.label} · Evidence {evidenceBandLabel(readiness.confidence)}
            </p>
          </div>
          <NidaPortrait
            priority
            className="mx-auto h-[230px] w-[min(100%,280px)] md:mx-0 md:h-[320px] md:w-full lg:h-[360px]"
          />
        </div>
      </section>

      {/* A. MY PROGRESS */}
      <section className="space-y-3">
        <Header title="My progress" subtitle="How much have I completed?" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Total study hours" value={cnHours(stats.lifetimeHours * 60)} />
          <Stat label="Questions logged" value={String(stats.lifetimeQuestions || "—")} />
          <Stat
            label="Eligible accuracy"
            value={perf.accuracyPct != null ? `${perf.accuracyPct}%` : "—"}
            hint={`${perf.answered} answered · target ${Math.round(snapshot.settings.questionAccuracyGoal * 100)}%`}
          />
          <Stat label="Subject coverage" value={`${coveredSubjects} / ${scored.filter((s) => s.core).length}`} />
          <Stat
            label="ABZI course end"
            value={abziCourse?.targetEndDate ?? ABZI_COURSE_END_DATE}
            hint="Separate from last class date"
          />
        </div>
        <AbziJourneyPanel />
      </section>

      {/* B. CENTRAL QBANK DASHBOARD */}
      <section className="space-y-3">
        <Header
          title="QBank dashboard"
          subtitle="One place to view and update UWorld, ACE QBank, MCC practice, and ABZI — without inventing totals."
        />
        <div className="soft-card overflow-hidden p-0">
          <div className="border-b border-border/60 px-5 py-4">
            <p className="kicker">Combined eligible performance</p>
            <p className="font-heading mt-2 text-3xl tabular">
              {perf.accuracyPct != null ? `${perf.accuracyPct}%` : "—"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {perf.correct} correct / {perf.answered} answered across supported resources (skipped excluded). Target{" "}
              {Math.round(snapshot.settings.questionAccuracyGoal * 100)}% with at least{" "}
              {snapshot.settings.minEligibleQuestionsForTarget.toLocaleString()} answered for a suggested exam date.
              Overlapping app logs are not double-counted when a cumulative snapshot is present. Separate from readiness
              score.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-accent/40 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-3 py-3 font-medium">Completed</th>
                  <th className="px-3 py-3 font-medium">Correct</th>
                  <th className="px-3 py-3 font-medium">Incorrect</th>
                  <th className="px-3 py-3 font-medium">Remaining</th>
                  <th className="px-3 py-3 font-medium">Accuracy</th>
                  <th className="px-3 py-3 font-medium">Last updated</th>
                  <th className="px-4 py-3 font-medium">Update</th>
                </tr>
              </thead>
              <tbody>
                {qbankDashboard.map((row) => (
                  <tr key={row.sourceId} className="border-t border-border/50 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.sourceName}</p>
                      <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
                        {row.snapshot || row.reconciledAnswered > 0
                          ? row.explanation
                          : "No data yet — enter cumulative totals when available."}
                      </p>
                    </td>
                    <td className="px-3 py-3 tabular">{dash(row.usedOrCompleted)}</td>
                    <td className="px-3 py-3 tabular">
                      {row.snapshot?.correct != null
                        ? row.snapshot.correct
                        : row.reconciledAnswered > 0
                          ? row.reconciledCorrect
                          : "—"}
                    </td>
                    <td className="px-3 py-3 tabular">
                      {row.snapshot?.incorrect != null
                        ? row.snapshot.incorrect
                        : row.reconciledAnswered > 0
                          ? row.reconciledIncorrect
                          : "—"}
                    </td>
                    <td className="px-3 py-3 tabular">
                      {row.supportsRemaining ? dash(row.remaining) : "—"}
                    </td>
                    <td className="px-3 py-3 tabular">{row.accuracy != null ? formatPercent(row.accuracy) : "—"}</td>
                    <td className="px-3 py-3 tabular">{row.lastUpdated ?? "—"}</td>
                    <td className="px-4 py-3">
                      <QBankSnapshotForm
                        sourceId={row.sourceId}
                        sourceName={row.sourceName}
                        compact
                        showRemaining={row.supportsRemaining}
                        onSave={async (payload) => {
                          try {
                            await saveQBankSnapshot(payload)
                            toast.success(`${row.sourceName} snapshot saved`)
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Could not save snapshot")
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="soft-card p-5">
            <p className="kicker">Accuracy trend</p>
            <AccuracyLineChart data={acc} />
          </div>
          <div className="soft-card p-5">
            <p className="kicker">Mock / formal assessments</p>
            <MockLineChart data={mocks} />
          </div>
        </div>
      </section>

      {/* C. SUBJECT PROGRESS */}
      <section className="space-y-3">
        <Header title="Subject progress" subtitle="Which subjects need attention?" />
        <div className="grid gap-4 md:grid-cols-2">
          <Band title="Weak / needs focus" rows={weak} empty="Weak areas appear after named subject blocks." />
          <Band
            title="Needs review"
            rows={needsReview}
            empty="No review pressure yet."
            extra={(s) => (s.pendingReviews ? `${s.pendingReviews} pending` : "")}
          />
          <Band title="Strong subjects" rows={strong} empty="Strong subjects appear as accuracy and volume settle." />
          <div className="soft-card p-5">
            <p className="kicker">Subject health</p>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">
              Composite of accuracy, recency, tests, and review — not exam readiness alone.
            </p>
            <SubjectBars rows={barRows} />
          </div>
        </div>
      </section>

      {/* High-yield tracker */}
      <section className="space-y-3">
        <Header
          title="High-yield topic tracker"
          subtitle="Preloaded Filipe Santos catalog. Pick a subject, mark progress — no typing required. Separate from question accuracy and readiness."
        />
        <HighYieldTracker />
      </section>

      {/* Upcoming practice exams */}
      <section className="space-y-3">
        <Header
          title="Upcoming Practice Exams"
          subtitle="Schedule MCCQE1 official practice, UWorld, ACE QBank, ABZI, and MCC assessments. Separate from the official licensing exam booking."
        />
        <PracticeExamsPanel />
      </section>

      {/* D. EXAM PREPARATION */}
      <section className="space-y-3">
        <Header title="Exam preparation" subtitle="When should I consider booking MCCQE1?" />
        <div className="soft-card space-y-3 p-5">
          <p className="text-sm">
            Readiness score: {showScore ? readiness.score : "—"} · Confidence: {evidenceBandLabel(readiness.confidence)}
          </p>
          <p className="text-sm">
            Eligible accuracy: {perf.accuracyPct != null ? `${perf.accuracyPct}%` : "—"} vs{" "}
            {Math.round(snapshot.settings.questionAccuracyGoal * 100)}% personal benchmark
          </p>
          <p className="text-sm">Planning state: {planning.label}</p>
          <p className="text-sm">{countdown.headline}</p>
          {planning.suggestedExamDate ? (
            <div className="rounded-xl bg-accent/50 px-3 py-2 text-sm">
              Suggested preparation target: <strong>{planning.suggestedExamDate}</strong> (100-day planning aid —
              not a booking and not a practice exam). Confirm any official MCCQE1 licensing date in Settings → Profile
              & Exam with an explicit booking acknowledgement.
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => void resetSuggestedExamTarget()}>
                  Reset suggested target
                </Button>
              </div>
            </div>
          ) : null}
          {planning.missingEvidence.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {planning.missingEvidence.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Evidence gates for a suggested target are currently met.</p>
          )}
          <p className="text-xs text-muted-foreground">{warmCopy(readiness.nextFocus)}</p>
        </div>
      </section>

      {/* E. WHAT TO FOCUS ON NEXT */}
      <section className="space-y-3">
        <Header title="What to focus on next" subtitle="Practical next steps from the current record" />
        <div className="grid gap-4 md:grid-cols-2">
          <Band title="Weak subjects" rows={weak} empty="No weak subjects flagged yet." />
          <Band
            title="Pending reviews"
            rows={needsReview}
            empty="Review queue is clear."
            extra={(s) => `${s.pendingReviews} pending`}
          />
          <div className="soft-card p-5 md:col-span-2">
            <p className="kicker">Upcoming ABZI</p>
            {upcoming.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {upcoming.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>
                      {row.date} · {eventDisplayTitle(row)}
                    </span>
                    <span className="text-muted-foreground">{row.eventType}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No upcoming schedule rows.</p>
            )}
          </div>
        </div>
      </section>

      {/* 30/60/90 */}
      <section className="space-y-3">
        <Header title="30 / 60 / 90-day performance review" subtitle="Based on your actual logged history" />
        <div className="flex flex-wrap gap-2">
          {([30, 60, 90] as PeriodReviewWindow[]).map((w) => (
            <Button key={w} size="sm" variant={reviewWindow === w ? "default" : "outline"} onClick={() => setReviewWindow(w)}>
              Last {w} days
            </Button>
          ))}
        </div>
        <div className="soft-card space-y-3 p-5">
          <p className="text-sm text-muted-foreground">
            {review.startKey} → {review.endKey}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Study hours" value={`${review.studyHours}h`} />
            <Stat label="Study days" value={String(review.studyDays)} />
            <Stat label="Answered questions" value={String(review.eligibleQuestions)} />
            <Stat label="Accuracy" value={formatPercent(review.accuracy)} />
          </div>
          {review.insufficient ? (
            <p className="text-sm text-muted-foreground">Insufficient data for this window.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {review.insights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {review.strongestSubjects.length ? (
            <p className="text-sm">Strongest: {review.strongestSubjects.join(", ")}</p>
          ) : null}
          {review.weakestSubjects.length ? (
            <p className="text-sm">Weakest: {review.weakestSubjects.join(", ")}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">Pending reviews: {review.pendingReviews}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="soft-card p-5">
          <p className="kicker">This week</p>
          <div className="mt-4 space-y-4">
            <GoalMeter
              label="Weekly study goal"
              actual={stats.week.hours}
              goal={snapshot.settings.weeklyHourGoal}
              copy={`${Math.round(stats.week.hours * 10) / 10}h of ${snapshot.settings.weeklyHourGoal}h`}
            />
            <GoalMeter
              label="Weekly question goal"
              actual={stats.week.questions}
              goal={snapshot.settings.weeklyQuestionGoal}
              copy={`${stats.week.questions} of ${snapshot.settings.weeklyQuestionGoal}`}
            />
          </div>
        </div>
        <div className="soft-card p-5">
          <p className="kicker">Weekly activity</p>
          <HoursByDayChart data={hourDays} />
          <div className="mt-3">
            <QuestionsByDayChart data={qDays} />
          </div>
        </div>
      </section>
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="font-heading text-2xl tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="soft-card p-4">
      <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="font-heading mt-2 text-2xl tabular">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-medium tabular">{v == null || v === "" ? "—" : v}</dd>
    </div>
  )
}

function Band({
  title,
  rows,
  empty,
  extra,
}: {
  title: string
  rows: SubjectHealth[]
  empty: string
  extra?: (s: SubjectHealth) => string
}) {
  return (
    <div className="soft-card p-5">
      <p className="kicker">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {s.name}
                <span className="ml-2 text-xs text-muted-foreground">{subjectDisplayStatus(s.status)}</span>
              </span>
              <span className="tabular text-muted-foreground">
                {extra?.(s) || subjectHealthCopy(s.readiness)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function dash(v: number | null | undefined) {
  return v == null ? "—" : v
}

function QBankSnapshotForm({
  sourceId,
  sourceName,
  onSave,
  compact = false,
  showRemaining = true,
}: {
  sourceId: string
  sourceName: string
  onSave: (row: Omit<QBankSnapshot, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<void>
  compact?: boolean
  showRemaining?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [asOfDate, setAsOfDate] = useState("")
  const [totalAvailable, setTotalAvailable] = useState("")
  const [used, setUsed] = useState("")
  const [unused, setUnused] = useState("")
  const [correct, setCorrect] = useState("")
  const [incorrect, setIncorrect] = useState("")
  const [skipped, setSkipped] = useState("")
  const [notes, setNotes] = useState("")

  if (!open) {
    return (
      <Button size="sm" variant="outline" className={compact ? "h-8" : "mt-4"} onClick={() => setOpen(true)}>
        {compact ? "Update" : `Enter ${sourceName} snapshot`}
      </Button>
    )
  }

  const num = (v: string) => (v.trim() === "" ? null : Number(v))

  return (
    <div className={compact ? "space-y-2 rounded-lg border border-border/60 bg-background p-3" : "mt-4 space-y-2 border-t border-border/60 pt-4"}>
      <p className="text-xs text-muted-foreground">
        New cumulative snapshot supersedes the previous total for current stats. Detailed study logs are preserved; overlapping counts are reconciled, not summed twice.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <FieldLabel>As of date</FieldLabel>
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
        {showRemaining ? (
          <div>
            <FieldLabel>Total available</FieldLabel>
            <Input inputMode="numeric" value={totalAvailable} onChange={(e) => setTotalAvailable(e.target.value)} />
          </div>
        ) : null}
        <div>
          <FieldLabel>Completed / used</FieldLabel>
          <Input inputMode="numeric" value={used} onChange={(e) => setUsed(e.target.value)} />
        </div>
        {showRemaining ? (
          <div>
            <FieldLabel>Remaining</FieldLabel>
            <Input inputMode="numeric" value={unused} onChange={(e) => setUnused(e.target.value)} />
          </div>
        ) : null}
        <div>
          <FieldLabel>Correct</FieldLabel>
          <Input inputMode="numeric" value={correct} onChange={(e) => setCorrect(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Incorrect</FieldLabel>
          <Input inputMode="numeric" value={incorrect} onChange={(e) => setIncorrect(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Skipped</FieldLabel>
          <Input inputMode="numeric" value={skipped} onChange={(e) => setSkipped(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Notes</FieldLabel>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            if (!asOfDate) {
              toast.error("As-of date is required")
              return
            }
            const payload = {
              sourceId,
              asOfDate,
              totalAvailable: showRemaining ? num(totalAvailable) : null,
              used: num(used),
              unused: showRemaining ? num(unused) : null,
              correct: num(correct),
              incorrect: num(incorrect),
              skipped: num(skipped),
              notes,
            }
            const warnings = validateQBankSnapshotInput(payload)
            if (warnings.length) toast.message(warnings[0])
            void onSave(payload).then(() => {
              setOpen(false)
              setAsOfDate("")
              setTotalAvailable("")
              setUsed("")
              setUnused("")
              setCorrect("")
              setIncorrect("")
              setSkipped("")
              setNotes("")
            })
          }}
        >
          Save snapshot
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}
