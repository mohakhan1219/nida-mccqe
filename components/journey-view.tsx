"use client"

import { useMemo } from "react"
import { useWorkspace } from "@/lib/data/workspace-context"
import { quoteIndexForDay, todayKey } from "@/lib/dates"
import { cnHours, formatPercent } from "@/lib/format"
import { catalogName } from "@/lib/stats"
import { confidenceLabel, stateLabel } from "@/lib/readiness"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export function JourneyView() {
  const { snapshot, stats, readiness, loading } = useWorkspace()
  const quote = useMemo(() => {
    const i = quoteIndexForDay(todayKey(snapshot.settings.timezone), snapshot.quotes.length)
    return snapshot.quotes[i]
  }, [snapshot.quotes, snapshot.settings.timezone])

  if (loading) return <p className="text-sm text-muted-foreground">Gathering the record…</p>

  const empty = stats.lifetimeQuestions === 0 && stats.rhythm.lastStudyDate == null
  const weekHourPct = snapshot.settings.weeklyHourGoal
    ? Math.min(100, (stats.week.hours / snapshot.settings.weeklyHourGoal) * 100)
    : 0
  const weekQPct = snapshot.settings.weeklyQuestionGoal
    ? Math.min(100, (stats.week.questions / snapshot.settings.weeklyQuestionGoal) * 100)
    : 0

  const weakest = stats.subjects
    .filter((s) => s.core && s.status !== "not_started")
    .sort((a, b) => (a.readiness ?? 101) - (b.readiness ?? 101))
    .slice(0, 3)

  const currentName = stats.todaySubjectId ? catalogName(snapshot, stats.todaySubjectId) : null

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm text-muted-foreground">
          Good {greeting()}, {snapshot.settings.studentName}.
        </p>
        <p className="font-heading mt-2 max-w-3xl text-2xl leading-snug md:text-[1.85rem]">
          {quote?.message}
        </p>
      </section>

      <section className="soft-card p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-primary/80 uppercase">Exam readiness</p>
            <h2 className="font-heading mt-1 text-3xl md:text-4xl">{stateLabel(readiness.state)}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{readiness.why}</p>
            <p className="mt-2 max-w-2xl text-sm text-foreground">{readiness.nextFocus}</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-5xl tabular text-primary">
              {readiness.score == null ? "—" : readiness.score}
            </p>
            <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
              Evidence {confidenceLabel(readiness.confidence)}
            </p>
            {readiness.examDate ? (
              <p className="mt-3 text-sm">
                Exam countdown — {readiness.countdown} days
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No exam date booked</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Today’s hours" value={cnHours(stats.todayHours * 60)} empty={empty && stats.todayHours === 0} emptyText="Start today’s study session" />
        <StatCard label="Today’s questions" value={stats.todayQuestions ? String(stats.todayQuestions) : "—"} empty={empty} emptyText="Complete your first question block to begin measuring accuracy." />
        <StatCard
          label="Currently studying"
          value={currentName ?? "—"}
          empty={!currentName}
          emptyText="No subject in session"
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="soft-card p-5">
          <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">This week · hours</p>
          <p className="mt-1 font-heading text-2xl tabular">
            {stats.week.hours.toFixed(1)}h
            <span className="ml-2 text-sm text-muted-foreground">
              / {snapshot.settings.weeklyHourGoal}h
            </span>
          </p>
          <Bar value={weekHourPct} />
        </div>
        <div className="soft-card p-5">
          <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">This week · questions</p>
          <p className="mt-1 font-heading text-2xl tabular">
            {stats.week.questions}
            <span className="ml-2 text-sm text-muted-foreground">
              / {snapshot.settings.weeklyQuestionGoal}
            </span>
          </p>
          <Bar value={weekQPct} />
        </div>
      </section>

      <section className="soft-card p-5 md:p-6">
        <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Recommended focus</p>
        {empty ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Study more subjects to unlock your subject balance analysis.
          </p>
        ) : weakest.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Not enough subject data yet. Keep logging blocks against named subjects.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {weakest.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span>{s.name}</span>
                <span className="text-muted-foreground">
                  {s.status === "not_enough_data"
                    ? "Not enough data"
                    : s.accuracy == null
                      ? s.status.replaceAll("_", " ")
                      : `${formatPercent(s.accuracy)} · ${s.status.replaceAll("_", " ")}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Streak {stats.rhythm.streak}d</span>
          <span>Pending review {stats.pendingReviews || "—"}</span>
          {stats.mockCount === 0 ? <span>Complete your first mock exam to unlock mock readiness.</span> : <span>{stats.mockCount} mock{stats.mockCount === 1 ? "" : "s"}</span>}
        </div>
      </section>

      <section>
        <p className="mb-3 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Subject progress</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {stats.subjects
            .filter((s) => s.scored)
            .map((s) => (
              <div key={s.id} className="soft-card px-3 py-3">
                <p className="text-sm font-medium leading-tight">{s.name}</p>
                <p className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                  {s.status === "not_started"
                    ? "Not started"
                    : s.status === "not_enough_data"
                      ? "Not enough data"
                      : s.status.replaceAll("_", " ")}
                </p>
                {s.status !== "not_started" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {s.questions ? `${s.questions} Q` : null}
                    {s.accuracy != null ? ` · ${formatPercent(s.accuracy)}` : ""}
                    {s.hours ? ` · ${s.hours.toFixed(1)}h` : ""}
                  </p>
                ) : null}
              </div>
            ))}
        </div>
      </section>

      <Details />
    </div>
  )
}

function Details() {
  const { snapshot, stats } = useWorkspace()
  const emptyMocks = stats.mockCount === 0
  return (
    <div className="space-y-6 border-t border-border/70 pt-8">
      <section className="soft-card p-5">
        <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Mocks</p>
        {emptyMocks ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Complete your first mock exam to unlock mock readiness.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {stats.mocks.slice(-6).reverse().map((m) => (
              <li key={m.id} className="flex justify-between gap-3">
                <span>
                  {m.testName || catalogName(snapshot, m.assessmentTypeId)} · {m.startAt.slice(0, 10)}
                </span>
                <span className="tabular">{formatPercent(m.correct / Math.max(m.total, 1))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="soft-card p-5">
        <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Question banks & courses</p>
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
                        ? `${c.completedUnits}/${c.totalUnits} units`
                        : `${c.completedQuestions}/${c.totalQuestions} Q`}
                  </span>
                </div>
                {unitTarget ? <Bar value={(c.completedUnits / (c.totalUnits ?? 1)) * 100} /> : null}
                {qTarget ? <Bar value={(c.completedQuestions / (c.totalQuestions ?? 1)) * 100} /> : null}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="soft-card p-5">
        <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Schedule</p>
        {snapshot.schedule.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Schedule not added yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {[...snapshot.schedule]
              .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
              .slice(0, 8)
              .map((row) => (
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
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="soft-card p-5">
          <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Monthly hours</p>
          <p className="mt-1 font-heading text-2xl tabular">{stats.month.hours.toFixed(1)}h</p>
          <p className="text-xs text-muted-foreground">{stats.month.activeDays} active days</p>
        </div>
        <div className="soft-card p-5">
          <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Achievements</p>
          <ul className="mt-2 space-y-1 text-sm">
            {stats.achievements.map((a) => (
              <li key={a.id} className={a.unlocked ? "text-foreground" : "text-muted-foreground"}>
                {a.unlocked ? "●" : "○"} {a.label}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function Bar({ value }: { value: number }) {
  return <Progress value={Math.max(0, Math.min(100, value))} className="mt-3 w-full" />
}

function StatCard({
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
    <div className="soft-card px-4 py-4">
      <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      {empty ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <p className="mt-1 font-heading text-2xl tabular">{value}</p>
      )}
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}

void cn
