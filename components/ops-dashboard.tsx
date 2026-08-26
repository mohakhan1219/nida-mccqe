"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useWorkspace } from "@/lib/data/workspace-context"
import { catalogByKind } from "@/lib/catalogs"
import { catalogName } from "@/lib/stats"
import { cnHours, formatHoursMinutes, formatPercent } from "@/lib/format"
import { accuracyOf, scoreOf } from "@/lib/metrics"
import { todayKey } from "@/lib/dates"
import {
  evidenceBandLabel,
  formatLastActivity,
  goalCountCopy,
  goalHoursCopy,
  goalProgress,
  opsSubjectChip,
  overallStageLabel,
  reviewCycle,
  showReadinessPercent,
  weeklyGoalsHeadline,
} from "@/lib/display"
import { applyOpsFilters, defaultOpsFilters, rangeWindow, type OpsRange } from "@/lib/ops-range"
import {
  accuracySeries,
  dailyQuestions,
  dailyStudyHours,
  mockSeries,
  readinessTrend,
} from "@/lib/series"
import { NativeSelect } from "@/components/field"
import { GoalMeter } from "@/components/goal-meter"
import {
  AccuracyLineChart,
  HoursByDayChart,
  MockLineChart,
  QuestionsByDayChart,
  ReadinessLineChart,
} from "@/components/mini-charts"
import type { SubjectHealth } from "@/lib/stats"
import { cn } from "@/lib/utils"
import { needsConfirmation, rawElapsedMinutes } from "@/lib/session-safety"

const CHART_H = 128

function attentionRank(s: SubjectHealth) {
  const chip = opsSubjectChip(s)
  if (chip === "Needs Review" || chip === "Stale") return 0
  if (s.status !== "not_started") return 1
  return 2
}

export function OpsDashboard() {
  const { snapshot, stats, readiness, mode, loading, running } = useWorkspace()
  const router = useRouter()
  const [filters, setFilters] = useState(defaultOpsFilters)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (mode === "cloud" && snapshot.profile.role !== "admin") {
      router.replace("/")
    }
  }, [mode, snapshot.profile.role, router])

  const filtered = useMemo(() => applyOpsFilters(snapshot, filters), [snapshot, filters])
  const window = rangeWindow(snapshot, filters.range)
  const hours = dailyStudyHours(filtered, window.start, window.end)
  const questions = dailyQuestions(filtered, window.start, window.end)
  const acc = accuracySeries(filtered, 16)
  const mocks = mockSeries(filtered)
  const trend = readinessTrend(snapshot, window.start, window.end)
  const today = todayKey(snapshot.settings.timezone)
  const showScore = showReadinessPercent(readiness)
  const hourGoal = goalProgress(stats.week.hours, snapshot.settings.weeklyHourGoal)
  const qGoal = goalProgress(stats.week.questions, snapshot.settings.weeklyQuestionGoal)
  const weekly = weeklyGoalsHeadline(hourGoal, qGoal)

  const pending = snapshot.reviews.filter((r) => r.status !== "completed")
  const dueToday = pending.filter((r) => (reviewCycle(r).next ?? r.firstReviewAt) === today)
  const overdue = pending.filter((r) => {
    const n = reviewCycle(r).next ?? r.firstReviewAt
    return n != null && n < today
  })
  const upcoming = pending.filter((r) => {
    const n = reviewCycle(r).next ?? r.firstReviewAt
    return n != null && n > today
  })
  const completedRecently = snapshot.reviews.filter(
    (r) => r.status === "completed" && r.updatedAt.slice(0, 10) >= window.start
  )

  const chips: { label: string; tone: Tone }[] = []
  if (stats.todayHours === 0 && stats.todayQuestions === 0) chips.push({ label: "No Activity Today", tone: "warn" })
  if (weekly.status === "Goal Exceeded") chips.push({ label: "Goal Exceeded", tone: "good" })
  else if (weekly.status === "Goal Met") chips.push({ label: "Goal Met", tone: "good" })
  else if (stats.week.hours > 0 || stats.week.questions > 0) chips.push({ label: "On Track", tone: "good" })
  if (overdue.length > 0) chips.push({ label: "Reviews Overdue", tone: "bad" })
  if (stats.trend === "down") chips.push({ label: "Accuracy Declining", tone: "bad" })
  if (stats.trend === "up") chips.push({ label: "Improving", tone: "good" })
  if (
    readiness.state === "not_ready" ||
    (readiness.examDate && readiness.state !== "ready_to_book" && readiness.state !== "getting_close")
  ) {
    chips.push({ label: "Needs Attention", tone: "warn" })
  }
  if (running && needsConfirmation(running, snapshot.settings)) {
    chips.push({
      label: `⚠ Active session · ${formatHoursMinutes(rawElapsedMinutes(running))} · confirmation required`,
      tone: "warn",
    })
  }

  const subjects = catalogByKind(snapshot.catalogs, "subject")
  const sources = catalogByKind(snapshot.catalogs, "source")
  const types = catalogByKind(snapshot.catalogs, "assessment_type")
  const open = stats.subjects.find((s) => s.id === openId) ?? null

  const lastActivity = [...snapshot.sessions, ...snapshot.blocks, ...snapshot.tests]
    .map((r) => r.startAt)
    .sort()
    .at(-1)

  const stream = [
    ...filtered.sessions
      .filter((s) => s.status === "completed")
      .map((s) => ({
        at: s.startAt,
        text: `${catalogName(snapshot, s.subjectId)} · ${catalogName(snapshot, s.sourceId)} · ${catalogName(snapshot, s.activityId)} · ${cnHours(s.durationMinutes)}`,
      })),
    ...filtered.blocks.map((b) => ({
      at: b.startAt,
      text: `${catalogName(snapshot, b.subjectId)} · ${catalogName(snapshot, b.sourceId)} · ${b.total} Q · ${formatPercent(accuracyOf(b), 1)}`,
    })),
    ...filtered.tests.map((t) => ({
      at: t.startAt,
      text: `${t.testName || catalogName(snapshot, t.assessmentTypeId)} · ${formatPercent(scoreOf(t), 1)} · ${cnHours(t.durationMinutes)}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12)

  const weak = stats.subjects
    .filter((s) => s.core && s.status !== "not_started")
    .sort((a, b) => (a.readiness ?? 101) - (b.readiness ?? 101))
    .slice(0, 6)

  const scored = stats.subjects.filter((s) => s.scored)
  const attention = scored.filter((s) => s.status !== "not_started").sort((a, b) => attentionRank(a) - attentionRank(b) || a.name.localeCompare(b.name))
  const notStarted = scored.filter((s) => s.status === "not_started")

  const hasHours = hours.some((d) => d.hours > 0)
  const hasQuestions = questions.some((d) => d.questions > 0)
  const hasAccuracy = acc.length >= 2
  const mockRows = mocks.length
    ? mocks
    : filtered.tests.map((t) => ({
        date: t.startAt.slice(0, 10),
        score: Math.round((scoreOf(t) ?? 0) * 1000) / 10,
        name: t.testName || "Test",
      }))
  const hasMocks = mockRows.length > 0
  const hasReadinessTrend = trend.filter((d) => d.score != null).length >= 2

  if (loading) return <p className="font-mono text-xs text-muted-foreground">Loading workspace…</p>

  return (
    <div className="ops-shell space-y-2.5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] tracking-[0.18em] text-primary/80 uppercase">Observability</p>
          <h1 className="font-heading text-xl leading-tight">Mudasir Dashboard</h1>
          <p className="text-xs text-muted-foreground">MCCQE1 preparation · read-only</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <StatusChip key={c.label} label={c.label} tone={c.tone} />
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5 xl:grid-cols-10">
        <Kpi
          label="Readiness"
          value={showScore ? String(readiness.score) : "—"}
          sub={showScore ? overallStageLabel(readiness.state, readiness.examDate) : "Building Baseline"}
          tone={showScore && readiness.state === "ready_to_book" ? "good" : showScore ? "accent" : "neutral"}
        />
        <Kpi label="Stage" value={overallStageLabel(readiness.state, readiness.examDate)} />
        <Kpi label="Evidence" value={evidenceBandLabel(readiness.confidence)} tone={readiness.confidence === "insufficient" ? "neutral" : undefined} />
        <Kpi label="Study today" value={cnHours(stats.todayHours * 60)} />
        <Kpi label="Questions today" value={String(stats.todayQuestions || "0")} />
        <Kpi label="Accuracy today" value={formatPercent(stats.todayAccuracy)} />
        <Kpi label="Streak" value={`${stats.rhythm.streak}d`} tone={stats.rhythm.streak >= 3 ? "good" : undefined} />
        <Kpi
          label="Pending reviews"
          value={String(stats.pendingReviews)}
          tone={overdue.length > 0 ? "bad" : stats.pendingReviews > 0 ? "warn" : "neutral"}
        />
        <Kpi
          label="Last activity"
          value={formatLastActivity(lastActivity ?? null, snapshot.settings.timezone)}
        />
        <Kpi
          label="Weekly goals"
          value={weekly.line}
          sub={weekly.status ?? undefined}
          tone={weekly.status ? "good" : hourGoal.percent === 0 && qGoal.percent === 0 ? "neutral" : "warn"}
        />
      </div>

      <div className="ops-panel flex flex-wrap items-center gap-2 px-2.5 py-2">
        {(["today", "7d", "30d", "all"] as OpsRange[]).map((r) => (
          <button
            key={r}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] tracking-wide uppercase",
              filters.range === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
            onClick={() => setFilters((f) => ({ ...f, range: r }))}
          >
            {r === "today" ? "Today" : r === "7d" ? "7 days" : r === "30d" ? "30 days" : "All time"}
          </button>
        ))}
        <div className="min-w-32 flex-1">
          <NativeSelect className="h-8 md:h-8" value={filters.subjectId} onChange={(e) => setFilters((f) => ({ ...f, subjectId: e.target.value }))}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="min-w-32 flex-1">
          <NativeSelect className="h-8 md:h-8" value={filters.sourceId} onChange={(e) => setFilters((f) => ({ ...f, sourceId: e.target.value }))}>
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="min-w-32 flex-1">
          <NativeSelect
            className="h-8 md:h-8"
            value={filters.assessmentTypeId}
            onChange={(e) => setFilters((f) => ({ ...f, assessmentTypeId: e.target.value }))}
          >
            <option value="">All assessment types</option>
            {types.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel title="Study activity" compact={!hasHours}>
          <HoursByDayChart data={hours} height={CHART_H} compactEmpty />
        </Panel>
        <Panel title="Question volume" compact={!hasQuestions}>
          <QuestionsByDayChart data={questions} height={CHART_H} compactEmpty />
        </Panel>
        <Panel title="Accuracy trend" compact={!hasAccuracy}>
          <AccuracyLineChart data={acc} height={CHART_H} compactEmpty />
        </Panel>
        <Panel title="Weekly goals">
          <div className="space-y-3">
            <GoalMeter
              label="Weekly study goal"
              actual={stats.week.hours}
              goal={snapshot.settings.weeklyHourGoal}
              copy={goalHoursCopy(stats.week.hours, snapshot.settings.weeklyHourGoal)}
            />
            <GoalMeter
              label="Weekly question goal"
              actual={stats.week.questions}
              goal={snapshot.settings.weeklyQuestionGoal}
              copy={goalCountCopy(stats.week.questions, snapshot.settings.weeklyQuestionGoal)}
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel title="Subject health">
          <ul className={cn("space-y-0.5 text-sm", attention.length > 8 && "max-h-56 overflow-auto")}>
            {attention.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-muted/80"
                  onClick={() => setOpenId(s.id === openId ? null : s.id)}
                >
                  <span>{s.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {opsSubjectChip(s)}
                    {s.questions ? ` · ${s.questions}Q` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {attention.length === 0 ? <p className="text-sm text-muted-foreground">No active subjects yet.</p> : null}
          {notStarted.length ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{notStarted.length} not started</p>
          ) : null}
          {open ? <SubjectDetail s={open} /> : null}
        </Panel>
        <Panel title="Weak areas" compact={weak.length <= 2}>
          {weak.length === 0 ? (
            <p className="text-sm text-muted-foreground">More data needed.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {weak.map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span>{s.name}</span>
                  <span className="text-muted-foreground">
                    {opsSubjectChip(s)}
                    {s.accuracy != null ? ` · ${formatPercent(s.accuracy)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        <Kpi label="Review due today" value={String(dueToday.length)} tone={dueToday.length > 0 ? "warn" : "neutral"} />
        <Kpi label="Review overdue" value={String(overdue.length)} tone={overdue.length > 0 ? "bad" : "neutral"} />
        <Kpi label="Review upcoming" value={String(upcoming.length)} />
        <Kpi label="Completed in range" value={String(completedRecently.length)} />
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel title="Mock / test performance" compact={!hasMocks}>
          {hasMocks ? <MockLineChart data={mockRows} height={CHART_H} compactEmpty /> : <p className="text-sm text-muted-foreground">More data needed.</p>}
        </Panel>
        <Panel title="Readiness trend" compact={!hasReadinessTrend}>
          <ReadinessLineChart data={trend} height={CHART_H} compactEmpty />
        </Panel>
      </div>

      <Panel title="Recent activity" compact={stream.length <= 3}>
        {stream.length === 0 ? (
          <p className="text-sm text-muted-foreground">More data needed.</p>
        ) : (
          <ul className="space-y-0.5 font-mono text-[12px] leading-snug">
            {stream.map((row, i) => (
              <li key={`${row.at}-${i}`} className="flex flex-wrap gap-x-2 text-foreground/90">
                <span className="text-muted-foreground">{formatLastActivity(row.at, snapshot.settings.timezone)}</span>
                <span>{row.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function Panel({ title, children, compact }: { title: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <section className={cn("ops-panel", compact ? "px-3 py-2" : "px-3 py-2.5")}>
      <p className="mb-1.5 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{title}</p>
      {children}
    </section>
  )
}

type Tone = "good" | "warn" | "bad" | "neutral" | "accent"

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <div className="ops-panel px-2.5 py-2">
      <p className="text-[9px] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-heading text-[1.05rem] leading-tight tabular",
          tone === "good" && "text-emerald-800",
          tone === "warn" && "text-amber-800",
          tone === "bad" && "text-destructive",
          tone === "accent" && "text-primary",
          tone === "neutral" && "text-muted-foreground"
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] tracking-[0.12em] uppercase",
        tone === "bad" && "bg-destructive/10 text-destructive",
        tone === "warn" && "bg-amber-100 text-amber-900",
        tone === "good" && "bg-emerald-700/10 text-emerald-800",
        (tone === "neutral" || tone === "accent") && "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  )
}

function SubjectDetail({ s }: { s: SubjectHealth }) {
  return (
    <div className="mt-2 border-t border-border/60 pt-2 text-sm">
      <p className="font-medium">{s.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {s.hours.toFixed(1)}h · {s.questions} Q · {formatPercent(s.accuracy)} · last {s.lastStudied ?? "—"} ·{" "}
        {s.pendingReviews} pending · {opsSubjectChip(s)}
      </p>
    </div>
  )
}
