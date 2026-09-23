"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useWorkspace } from "@/lib/data/workspace-context"
import { addDaysKey, todayKey, weekStartKey } from "@/lib/dates"
import {
  ABZI_COURSE_TIMEZONE,
  computeAbziProgress,
  eventDisplayTitle,
  formatEventClockRange,
  isAbziTest,
} from "@/lib/abzi-schedule"
import { AbziEventSheet } from "@/components/abzi-event-sheet"
import type { ScheduleEvent } from "@/lib/types"

export function AbziCourseCard() {
  const { snapshot } = useWorkspace()
  const tz = snapshot.settings.timezone || ABZI_COURSE_TIMEZONE
  const day = todayKey(tz)
  const weekStart = weekStartKey(new Date(), tz)
  const weekEnd = addDaysKey(weekStart, 7)
  const progress = useMemo(
    () => computeAbziProgress(snapshot.schedule, day, weekStart, weekEnd),
    [snapshot.schedule, day, weekStart, weekEnd]
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const openEvent = progress.all.find((e) => e.id === openId) ?? null

  if (!progress.all.length) return null

  return (
    <>
      <section className="soft-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kicker">ABZI course</p>
            <h2 className="font-heading text-lg text-foreground">Next on the calendar</h2>
          </div>
          <Link href="/journey#abzi-course" className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline">
            Full schedule
          </Link>
        </div>

        {progress.upcoming ? (
          <UpcomingBlock event={progress.upcoming} onOpen={() => setOpenId(progress.upcoming!.id)} />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No upcoming ABZI events — browse the full schedule on Journey.</p>
        )}

        {progress.thisWeek.length ? (
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">This week</p>
            <ul className="mt-2 space-y-1.5">
              {progress.thisWeek.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between gap-3 text-left text-sm"
                    onClick={() => setOpenId(row.id)}
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">{formatShortDate(row.date)} · </span>
                      {eventDisplayTitle(row)}
                      {row.timeTentative ? <span className="ml-1 text-xs text-amber-800/80">· tentative</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatEventClockRange(row)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {progress.pastOpen.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {progress.pastOpen.length} past event{progress.pastOpen.length === 1 ? "" : "s"} still open — mark attendance or log the test when ready.
          </p>
        ) : null}

        <p className="mt-3 text-xs text-muted-foreground">
          Classes attended {progress.classesAttended}/{progress.classesTotal} · Tests recorded {progress.testsRecorded}/
          {progress.testsTotal}
          <span className="block sm:inline sm:before:content-['·_']"> Attendance does not add study hours.</span>
        </p>
      </section>

      <AbziEventSheet event={openEvent} open={Boolean(openEvent)} onOpenChange={(v) => !v && setOpenId(null)} />
    </>
  )
}

function UpcomingBlock({ event, onOpen }: { event: ScheduleEvent; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="mt-3 w-full rounded-2xl bg-primary/[0.06] px-4 py-3 text-left ring-1 ring-primary/15">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary/80">
        {isAbziTest(event) ? "MCQ test" : "Class"} · {formatLongDate(event.date)}
      </p>
      <p className="mt-1 font-heading text-xl text-foreground">{eventDisplayTitle(event)}</p>
      {event.topics.length > 1 ? (
        <p className="mt-1 text-sm text-muted-foreground">{event.topics.join(" · ")}</p>
      ) : null}
      <p className="mt-2 text-sm text-muted-foreground">
        {formatEventClockRange(event)} Eastern
        {event.timeTentative ? " · time tentative" : ""}
      </p>
    </button>
  )
}

function formatLongDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function formatShortDate(dateKey: string) {
  const [, m, d] = dateKey.split("-")
  return `${Number(m)}/${Number(d)}`
}
