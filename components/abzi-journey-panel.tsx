"use client"

import { useMemo, useState } from "react"
import { useWorkspace } from "@/lib/data/workspace-context"
import { addDaysKey, todayKey, weekStartKey } from "@/lib/dates"
import {
  classCompleted,
  computeAbziProgress,
  eventDisplayTitle,
  formatEventClockRange,
  isAbziClass,
  isAbziTest,
  testRecorded,
} from "@/lib/abzi-schedule"
import { AbziEventSheet } from "@/components/abzi-event-sheet"
import { Progress } from "@/components/ui/progress"
import type { ScheduleEvent } from "@/lib/types"

export function AbziJourneyPanel() {
  const { snapshot } = useWorkspace()
  const day = todayKey(snapshot.settings.timezone)
  const weekStart = weekStartKey(new Date(), snapshot.settings.timezone)
  const weekEnd = addDaysKey(weekStart, 7)
  const progress = useMemo(
    () => computeAbziProgress(snapshot.schedule, day, weekStart, weekEnd),
    [snapshot.schedule, day, weekStart, weekEnd]
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const openEvent = progress.all.find((e) => e.id === openId) ?? null

  if (!progress.all.length) return null

  const classPct = Math.round((progress.classesAttended / Math.max(1, progress.classesTotal)) * 100)
  const testPct = Math.round((progress.testsRecorded / Math.max(1, progress.testsTotal)) * 100)

  return (
    <>
      <section id="abzi-course" className="soft-card scroll-mt-24 p-5">
        <p className="kicker">ABZI course progress</p>
        <h2 className="mt-1 font-heading text-xl">Course calendar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Attendance and recorded Friday tests only — not study hours, question accuracy, or MCCQE1 readiness.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted/40 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Classes attended</p>
            <p className="mt-1 font-heading text-2xl">
              {progress.classesAttended}
              <span className="text-base text-muted-foreground"> / {progress.classesTotal}</span>
            </p>
            <Progress value={classPct} className="mt-2 w-full" />
          </div>
          <div className="rounded-2xl bg-muted/40 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tests recorded</p>
            <p className="mt-1 font-heading text-2xl">
              {progress.testsRecorded}
              <span className="text-base text-muted-foreground"> / {progress.testsTotal}</span>
            </p>
            <Progress value={testPct} className="mt-2 w-full" />
          </div>
        </div>

        {progress.pastOpen.length ? (
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-900/70">Past · still open</p>
            <ul className="mt-2 space-y-1">
              {progress.pastOpen.map((row) => (
                <EventRow key={row.id} row={row} day={day} onOpen={() => setOpenId(row.id)} />
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Full schedule · {progress.all.length} events</p>
          <ul className="mt-2 max-h-[28rem] space-y-1 overflow-y-auto overscroll-contain pr-1">
            {progress.all.map((row) => (
              <EventRow key={row.id} row={row} day={day} onOpen={() => setOpenId(row.id)} />
            ))}
          </ul>
        </div>
      </section>

      <AbziEventSheet event={openEvent} open={Boolean(openEvent)} onOpenChange={(v) => !v && setOpenId(null)} />
    </>
  )
}

function EventRow({ row, day, onOpen }: { row: ScheduleEvent; day: string; onOpen: () => void }) {
  const done = isAbziClass(row) ? classCompleted(row) : testRecorded(row)
  const missed = row.attendance === "missed"
  const past = row.date < day
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start justify-between gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-muted/50"
      >
        <span className="min-w-0">
          <span className="text-muted-foreground">{row.date}</span>
          <span className="mx-1.5 text-muted-foreground/50">·</span>
          <span className="font-medium">{eventDisplayTitle(row)}</span>
          {row.topics.length > 1 ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{row.topics.join(" · ")}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-right text-xs text-muted-foreground">
          <span className="block">{formatEventClockRange(row)}</span>
          <span className="mt-0.5 block">
            {done ? (isAbziTest(row) ? "Recorded" : "Attended") : missed ? "Missed" : past ? "Open" : isAbziTest(row) ? "Test" : "Class"}
            {row.timeTentative ? " · tent." : ""}
          </span>
        </span>
      </button>
    </li>
  )
}
