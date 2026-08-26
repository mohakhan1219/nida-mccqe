"use client"

import { useMemo } from "react"
import { useWorkspace } from "@/lib/data/workspace-context"
import { todayKey } from "@/lib/dates"
import { cnHours, formatPercent } from "@/lib/format"
import { catalogName } from "@/lib/stats"
import type { SubjectHealth } from "@/lib/stats"
import {
  evidenceBandLabel,
  examTrackLabel,
  goalCountCopy,
  goalHoursCopy,
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
import { Progress } from "@/components/ui/progress"
import { NidaPortrait } from "@/components/nida-portrait"

export function JourneyView() {
  const { snapshot, stats, readiness, loading } = useWorkspace()
  const day = todayKey(snapshot.settings.timezone)
  const quote = useMemo(() => {
    const ctx = quoteContext(stats, snapshot.settings.weeklyHourGoal, snapshot.settings.weeklyQuestionGoal)
    return selectDailyQuote(snapshot.quotes, day, ctx)
  }, [snapshot.quotes, snapshot.settings, stats, day])

  if (loading) return <p className="text-sm text-muted-foreground">Gathering the record…</p>

  const showScore = showReadinessPercent(readiness)
  const stage = overallStageLabel(readiness.state, readiness.examDate)
  const track = examTrackLabel(readiness)
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
  const untouched = scored.filter((s) => s.status === "not_started")
  const strong = active.filter((s) => s.status === "strong")
  const weak = active
    .filter((s) => s.status === "needs_focus" || (s.accuracy != null && s.accuracy < snapshot.settings.accuracyGoal))
    .sort((a, b) => (a.readiness ?? 101) - (b.readiness ?? 101))
    .slice(0, 5)
  const recent = [...active]
    .filter((s) => s.lastStudied)
    .sort((a, b) => (b.lastStudied ?? "").localeCompare(a.lastStudied ?? ""))
    .slice(0, 5)
  const needsReview = active.filter((s) => s.pendingReviews > 0).slice(0, 5)
  const barRows = [...active]
    .sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0))
    .slice(0, 8)
    .map((s) => ({ name: s.name, value: s.readiness ?? 0 }))

  const currentName = stats.todaySubjectId ? catalogName(snapshot, stats.todaySubjectId) : null

  return (
    <div className="space-y-7 pb-8">
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
            <p className="kicker">Exam readiness</p>
            <h1 className="font-heading mt-2 text-3xl leading-tight md:text-4xl">
              {showScore ? stage : "Building Your Baseline"}
            </h1>
            {showScore ? (
              <p className="mt-3 font-heading text-5xl tabular text-primary">{readiness.score}</p>
            ) : (
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                A percentage will appear once the record is strong enough.
              </p>
            )}
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{warmCopy(readiness.why)}</p>
            <p className="mt-2 max-w-lg text-sm">{warmCopy(readiness.nextFocus)}</p>
            <p className="mt-4 text-xs tracking-wide text-muted-foreground uppercase">
              Evidence confidence · {evidenceBandLabel(readiness.confidence)}
            </p>
            {readiness.examDate ? (
              <p className="mt-2 text-sm">
                Exam countdown — {readiness.countdown} days
                {track ? ` · ${track}` : ""}
              </p>
            ) : null}
            {!readiness.examDate && readiness.state === "ready_to_book" ? (
              <p className="mt-3 text-sm">You appear ready to book MCCQE1. Set the date in Settings when you have it.</p>
            ) : null}
            {!readiness.examDate && readiness.state !== "ready_to_book" ? (
              <p className="mt-3 text-sm text-muted-foreground">No exam date booked. Readiness will tell you when booking looks justified.</p>
            ) : null}
          </div>
          <NidaPortrait
            priority
            className="mx-auto h-[230px] w-[min(100%,280px)] md:mx-0 md:h-[320px] md:w-full lg:h-[360px]"
          />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Today · study time" value={cnHours(stats.todayHours * 60)} empty={!stats.todayHours} emptyText="No hours yet today" />
        <Stat label="Today · questions" value={stats.todayQuestions ? String(stats.todayQuestions) : "—"} empty={!stats.todayQuestions} emptyText="No questions today" />
        <Stat label="Today · accuracy" value={formatPercent(stats.todayAccuracy)} empty={stats.todayAccuracy == null} emptyText="—" />
        <Stat label="Currently studying" value={currentName ?? "—"} empty={!currentName} emptyText="No subject in session" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="soft-card p-5">
          <p className="kicker">This week</p>
          <div className="mt-4 space-y-4">
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
            <p className="text-sm text-muted-foreground">
              Accuracy {formatPercent(stats.week.accuracy)} · {stats.rhythm.studyDaysThisWeek} study day
              {stats.rhythm.studyDaysThisWeek === 1 ? "" : "s"} this week · streak {stats.rhythm.streak}d
            </p>
          </div>
        </div>
        <div className="soft-card p-5">
          <p className="kicker">Recent trend</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {stats.trend === "up"
              ? "Accuracy is improving."
              : stats.trend === "down"
                ? "Accuracy has eased recently."
                : stats.lifetimeQuestions === 0
                  ? "More data needed."
                  : "Not enough contrast yet to call a trend."}
          </p>
          <div className="mt-3">
            <AccuracyLineChart data={acc} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="soft-card p-5">
          <p className="kicker">Weekly study activity</p>
          <HoursByDayChart data={hourDays} />
        </div>
        <div className="soft-card p-5">
          <p className="kicker">Weekly question volume</p>
          <QuestionsByDayChart data={qDays} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Band title="Focus · weak subjects" rows={weak} empty="Weak areas appear after named subject blocks." />
        <Band title="Focus · needs review" rows={needsReview} empty="No review pressure yet." extra={(s) => (s.pendingReviews ? `${s.pendingReviews} pending` : "")} />
        <Band title="Recently studied" rows={recent} empty="Recently studied subjects will list here." extra={(s) => s.lastStudied ?? ""} />
        <Band title="Strong subjects" rows={strong} empty="Strong subjects will appear as accuracy and volume settle." />
      </section>

      <section className="soft-card p-5">
        <p className="kicker">Subject health</p>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          0–100 composite of accuracy, recency, tests, and review for each subject — not exam readiness and not accuracy alone. Active subjects, up to eight.
        </p>
        <SubjectBars rows={barRows} />
      </section>

      {upcoming.length ? (
        <section className="soft-card p-5">
          <p className="kicker">Upcoming schedule</p>
          <ul className="mt-3 space-y-2 text-sm">
            {upcoming.map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span>
                  {row.date} · {row.eventType}
                  {row.subjectId ? ` · ${catalogName(snapshot, row.subjectId)}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {row.startTime}–{row.endTime}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Schedule not added yet.</p>
      )}

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/8 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="kicker">All subjects</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {active.length} with study · {untouched.length} not started · full catalog
            </p>
          </div>
          <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
          <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
        </summary>
        <div className="mt-3 space-y-2">
          {active.map((s) => (
            <ActiveSubject key={s.id} s={s} />
          ))}
          {untouched.length ? (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {untouched.map((s) => (
                <span key={s.id} className="rounded-full bg-muted/80 px-2.5 py-1 text-xs text-muted-foreground">
                  {s.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </details>

      <div className="space-y-6 border-t border-border/70 pt-8">
        <section className="soft-card p-5">
          <p className="kicker">Mock performance</p>
          {mocks.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Complete your first mock exam to unlock mock readiness.</p>
          ) : (
            <div className="mt-3">
              <MockLineChart data={mocks} />
            </div>
          )}
        </section>
        <section className="soft-card p-5">
          <p className="kicker">Question banks & courses</p>
          <ul className="mt-3 space-y-3">
            {snapshot.courses.map((c) => {
              const unitTarget = c.totalUnits && c.totalUnits > 0
              const qTarget = c.totalQuestions && c.totalQuestions > 0
              return (
                <li key={c.id}>
                  <div className="flex justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">
                      {!unitTarget && !qTarget
                        ? c.name === "Abzi"
                          ? "Schedule not added yet"
                          : "Add a target in Settings"
                        : unitTarget
                          ? `${c.completedUnits} of ${c.totalUnits} units`
                          : `${c.completedQuestions} of ${c.totalQuestions} Q`}
                    </span>
                  </div>
                  {unitTarget ? <Progress value={Math.min(100, (c.completedUnits / (c.totalUnits ?? 1)) * 100)} className="mt-2 w-full" /> : null}
                  {qTarget ? <Progress value={Math.min(100, (c.completedQuestions / (c.totalQuestions ?? 1)) * 100)} className="mt-2 w-full" /> : null}
                </li>
              )
            })}
          </ul>
        </section>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="soft-card p-5">
            <p className="kicker">Monthly hours</p>
            <p className="mt-1 font-heading text-2xl tabular">{stats.month.hours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">{stats.month.activeDays} active days</p>
          </div>
          <div className="soft-card p-5">
            <p className="kicker">Achievements</p>
            <ul className="mt-2 space-y-1 text-sm">
              {stats.achievements.map((a) => (
                <li key={a.id} className={a.unlocked ? "text-foreground" : "text-muted-foreground"}>
                  {a.unlocked ? "●" : "○"} {a.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  empty,
  emptyText,
}: {
  label: string
  value: string
  empty?: boolean
  emptyText?: string
}) {
  return (
    <div className="soft-card px-4 py-3.5">
      <p className="kicker text-muted-foreground">{label}</p>
      {empty ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <p className="mt-1 font-heading text-2xl tabular">{value}</p>
      )}
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
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((s) => (
            <li key={s.id} className="flex justify-between gap-3">
              <span>{s.name}</span>
              <span className="text-muted-foreground">
                {subjectDisplayStatus(s.status)}
                {extra?.(s) ? ` · ${extra(s)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ActiveSubject({ s }: { s: SubjectHealth }) {
  return (
    <div className="soft-card px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{s.name}</p>
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{subjectDisplayStatus(s.status)}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {s.hours ? `${s.hours.toFixed(1)}h` : "0h"}
        {s.questions ? ` · ${s.questions} Q` : ""}
        {s.accuracy != null ? ` · ${formatPercent(s.accuracy)}` : ""}
        {s.pendingReviews ? ` · ${s.pendingReviews} reviews` : ""}
        {s.lastStudied ? ` · last ${s.lastStudied}` : ""}
        {s.readiness != null ? ` · subject health ${subjectHealthCopy(s.readiness)}` : ""}
      </p>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}
