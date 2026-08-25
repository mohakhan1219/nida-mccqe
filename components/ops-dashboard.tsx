"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useWorkspace } from "@/lib/data/workspace-context"
import { catalogByKind } from "@/lib/catalogs"
import { catalogName } from "@/lib/stats"
import { cnHours, formatPercent } from "@/lib/format"
import { accuracyOf, scoreOf } from "@/lib/metrics"
import { todayKey } from "@/lib/dates"
import {
  evidenceBandLabel,
  goalCountCopy,
  goalHoursCopy,
  goalProgress,
  opsSubjectChip,
  overallStageLabel,
  reviewCycle,
  showReadinessPercent,
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

export function OpsDashboard() {
  const { snapshot, stats, readiness, mode, loading } = useWorkspace()
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

  const chips: string[] = []
  if (stats.todayHours === 0 && stats.todayQuestions === 0) chips.push("No Activity Today")
  if (hourGoal.status === "exceeded" || qGoal.status === "exceeded") chips.push("Goal Exceeded")
  else if (hourGoal.status === "met" || qGoal.status === "met") chips.push("Goal Met")
  else if (stats.week.hours > 0 || stats.week.questions > 0) chips.push("On Track")
  if (overdue.length > 0) chips.push("Reviews Overdue")
  if (stats.trend === "down") chips.push("Accuracy Declining")
  if (stats.trend === "up") chips.push("Improving")
  if (
    readiness.state === "not_ready" ||
    (readiness.examDate && readiness.state !== "ready_to_book" && readiness.state !== "getting_close")
  ) {
    chips.push("Needs Attention")
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
        text: `${catalogName(snapshot, s.subjectId)} • ${catalogName(snapshot, s.sourceId)} • ${catalogName(snapshot, s.activityId)} • ${cnHours(s.durationMinutes)}`,
      })),
    ...filtered.blocks.map((b) => ({
      at: b.startAt,
      text: `${catalogName(snapshot, b.subjectId)} • ${catalogName(snapshot, b.sourceId)} • ${b.total} Q • ${formatPercent(accuracyOf(b), 1)}`,
    })),
    ...filtered.tests.map((t) => ({
      at: t.startAt,
      text: `${t.testName || catalogName(snapshot, t.assessmentTypeId)} • ${formatPercent(scoreOf(t), 1)} • ${cnHours(t.durationMinutes)}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12)

  const weak = stats.subjects
    .filter((s) => s.core && s.status !== "not_started")
    .sort((a, b) => (a.readiness ?? 101) - (b.readiness ?? 101))
    .slice(0, 6)

  if (loading) return <p className="font-mono text-xs text-muted-foreground">Loading workspace…</p>

  return (
    <div className="ops-shell space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-primary/80 uppercase">Observability</p>
          <h1 className="font-heading text-2xl">Mudasir Dashboard</h1>
          <p className="text-sm text-muted-foreground">MCCQE1 preparation observability · read-only</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <StatusChip key={c} label={c} />
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5 xl:grid-cols-10">
        <Kpi
          label="Readiness"
          value={showScore ? String(readiness.score) : "—"}
          sub={showScore ? overallStageLabel(readiness.state, readiness.examDate) : "Building Baseline"}
        />
        <Kpi label="Stage" value={overallStageLabel(readiness.state, readiness.examDate)} />
        <Kpi label="Evidence" value={evidenceBandLabel(readiness.confidence)} />
        <Kpi label="Study today" value={cnHours(stats.todayHours * 60)} />
        <Kpi label="Questions today" value={String(stats.todayQuestions || "0")} />
        <Kpi label="Accuracy today" value={formatPercent(stats.todayAccuracy)} />
        <Kpi label="Streak" value={`${stats.rhythm.streak}d`} />
        <Kpi label="Pending reviews" value={String(stats.pendingReviews)} />
        <Kpi label="Last activity" value={lastActivity ? lastActivity.slice(0, 10) : "—"} />
        <Kpi
          label="Weekly goals"
          value={
            hourGoal.status === "exceeded" || qGoal.status === "exceeded"
              ? "Exceeded"
              : hourGoal.status === "met" || qGoal.status === "met"
                ? "Met"
                : "Open"
          }
          sub={`${Math.round(hourGoal.percent)}% h · ${Math.round(qGoal.percent)}% Q`}
        />
      </div>

      <div className="ops-panel flex flex-wrap gap-3 p-3">
        {(["today", "7d", "30d", "all"] as OpsRange[]).map((r) => (
          <button
            key={r}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs tracking-wide uppercase",
              filters.range === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
            onClick={() => setFilters((f) => ({ ...f, range: r }))}
          >
            {r === "today" ? "Today" : r === "7d" ? "7 days" : r === "30d" ? "30 days" : "All time"}
          </button>
        ))}
        <div className="min-w-36 flex-1">
          <NativeSelect className="h-9 md:h-9" value={filters.subjectId} onChange={(e) => setFilters((f) => ({ ...f, subjectId: e.target.value }))}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="min-w-36 flex-1">
          <NativeSelect className="h-9 md:h-9" value={filters.sourceId} onChange={(e) => setFilters((f) => ({ ...f, sourceId: e.target.value }))}>
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="min-w-36 flex-1">
          <NativeSelect
            className="h-9 md:h-9"
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

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Study activity">
          <HoursByDayChart data={hours} />
        </Panel>
        <Panel title="Question volume">
          <QuestionsByDayChart data={questions} />
        </Panel>
        <Panel title="Accuracy trend">
          <AccuracyLineChart data={acc} />
        </Panel>
        <Panel title="Weekly goals">
          <div className="space-y-4">
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

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Subject health">
          <ul className="max-h-80 space-y-1 overflow-auto text-sm">
            {stats.subjects
              .filter((s) => s.scored)
              .map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/80"
                    onClick={() => setOpenId(s.id === openId ? null : s.id)}
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {opsSubjectChip(s)}
                      {s.questions ? ` · ${s.questions}Q` : ""}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          {open ? <SubjectDetail s={open} /> : null}
        </Panel>
        <Panel title="Weak areas">
          {weak.length === 0 ? (
            <p className="text-sm text-muted-foreground">More data needed.</p>
          ) : (
            <ul className="space-y-2 text-sm">
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

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Review due today" value={String(dueToday.length)} />
        <Kpi label="Review overdue" value={String(overdue.length)} alert={overdue.length > 0} />
        <Kpi label="Review upcoming" value={String(upcoming.length)} />
        <Kpi label="Completed in range" value={String(completedRecently.length)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Mock / test performance">
          {filtered.tests.length === 0 && mocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">More data needed.</p>
          ) : (
            <MockLineChart
              data={
                mocks.length
                  ? mocks
                  : filtered.tests.map((t) => ({
                      date: t.startAt.slice(0, 10),
                      score: Math.round((scoreOf(t) ?? 0) * 1000) / 10,
                      name: t.testName || "Test",
                    }))
              }
            />
          )}
        </Panel>
        <Panel title="Readiness trend">
          <ReadinessLineChart data={trend} />
        </Panel>
      </div>

      <Panel title="Recent activity">
        {stream.length === 0 ? (
          <p className="text-sm text-muted-foreground">More data needed.</p>
        ) : (
          <ul className="space-y-1.5 font-mono text-[13px]">
            {stream.map((row, i) => (
              <li key={`${row.at}-${i}`} className="text-foreground/90">
                {row.text}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ops-panel p-4">
      <p className="mb-3 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{title}</p>
      {children}
    </section>
  )
}

function Kpi({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className="ops-panel px-3 py-3">
      <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className={cn("mt-1 font-heading text-xl tabular leading-tight", alert && "text-destructive")}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

function StatusChip({ label }: { label: string }) {
  const attention = /Overdue|Declining|Attention|No Activity/.test(label)
  const good = /On Track|Goal Met|Goal Exceeded|Improving/.test(label)
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-[10px] tracking-[0.12em] uppercase",
        attention && "bg-destructive/10 text-destructive",
        good && "bg-emerald-700/10 text-emerald-800",
        !attention && !good && "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  )
}

function SubjectDetail({ s }: { s: SubjectHealth }) {
  return (
    <div className="mt-3 border-t border-border/60 pt-3 text-sm">
      <p className="font-medium">{s.name}</p>
      <p className="mt-1 text-muted-foreground">
        {s.hours.toFixed(1)}h · {s.questions} Q · {formatPercent(s.accuracy)} · last {s.lastStudied ?? "—"} ·{" "}
        {s.pendingReviews} pending · {opsSubjectChip(s)}
      </p>
    </div>
  )
}
