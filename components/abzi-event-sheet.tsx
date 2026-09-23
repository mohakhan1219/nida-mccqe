"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useWorkspace } from "@/lib/data/workspace-context"
import { catalogByKind } from "@/lib/catalogs"
import { resolveAssessmentWindow } from "@/lib/dates"
import {
  ABZI_COURSE_TIMEZONE,
  ABZI_EXAM_TYPE_ID,
  ABZI_SOURCE_ID,
  eventDisplayTitle,
  formatEventClockRange,
  isAbziTest,
  normalizeScheduleEvent,
} from "@/lib/abzi-schedule"
import { isMockType } from "@/lib/metrics"
import type { ScheduleEvent } from "@/lib/types"
import { FieldLabel, NativeSelect } from "@/components/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function AbziEventSheet({
  event,
  open,
  onOpenChange,
}: {
  event: ScheduleEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { snapshot, upsertSchedule, saveAssessment } = useWorkspace()
  const subjects = catalogByKind(snapshot.catalogs, "subject")
  const abziExam = snapshot.catalogs.find((c) => c.id === ABZI_EXAM_TYPE_ID)

  const [title, setTitle] = useState("")
  const [topicsText, setTopicsText] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("20:00")
  const [endTime, setEndTime] = useState("23:00")
  const [timezone, setTimezone] = useState(ABZI_COURSE_TIMEZONE)
  const [timeTentative, setTimeTentative] = useState(false)
  const [notes, setNotes] = useState("")
  const [prepDone, setPrepDone] = useState(false)
  const [practiceDone, setPracticeDone] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const [editing, setEditing] = useState(false)
  const [logging, setLogging] = useState(false)
  const [total, setTotal] = useState("")
  const [correct, setCorrect] = useState("")
  const [incorrect, setIncorrect] = useState("")
  const [skipped, setSkipped] = useState("0")
  const [qSubject, setQSubject] = useState(subjects[0]?.id ?? "subject:mixed")

  useEffect(() => {
    if (!event) return
    setTitle(event.title)
    setTopicsText(event.topics.join(", "))
    setDate(event.date)
    setStartTime(event.startTime)
    setEndTime(event.endTime)
    setTimezone(event.timezone)
    setTimeTentative(event.timeTentative)
    setNotes(event.notes)
    setPrepDone(event.prepDone)
    setPracticeDone(event.practiceDone)
    setReviewDone(event.reviewDone)
    setEditing(false)
    setLogging(false)
    setTotal("")
    setCorrect("")
    setIncorrect("")
    setSkipped("0")
    setQSubject(event.subjectId ?? subjects.find((s) => s.slug === "mixed")?.id ?? subjects[0]?.id ?? "")
  }, [event, subjects])

  if (!event) return null
  const current = event

  async function savePatch(patch: Partial<ScheduleEvent>) {
    try {
      await upsertSchedule(normalizeScheduleEvent({ ...current, ...patch }))
      toast.success("Saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    }
  }

  async function saveEdits() {
    const topics = topicsText
      .split(/[,/|]/)
      .map((t) => t.trim())
      .filter(Boolean)
    await savePatch({
      title: title.trim() || eventDisplayTitle(current),
      topics: topics.length ? topics : [title.trim() || current.eventType],
      date,
      startTime,
      endTime,
      timezone: timezone.trim() || ABZI_COURSE_TIMEZONE,
      timeTentative,
      notes,
      prepDone,
      practiceDone,
      reviewDone,
    })
    setEditing(false)
  }

  async function markAttendance(attendance: "attended" | "missed" | null) {
    await savePatch({ attendance })
  }

  async function logAbziExam() {
    if (!abziExam) {
      toast.error("Abzi exam assessment type is missing from the catalog.")
      return
    }
    const t = Number(total)
    const c = Number(correct)
    const i = Number(incorrect)
    const s = Number(skipped)
    if (![t, c, i, s].every((n) => Number.isFinite(n) && n >= 0)) {
      toast.error("Enter question counts.")
      return
    }
    try {
      const window = resolveAssessmentWindow({})
      await saveAssessment({
        subjectId: qSubject || "subject:mixed",
        sourceId: ABZI_SOURCE_ID,
        assessmentTypeId: ABZI_EXAM_TYPE_ID,
        topic: eventDisplayTitle(current),
        startAt: window.startAt,
        endAt: window.endAt,
        total: t,
        correct: c,
        incorrect: i,
        skipped: s,
        countAsStudySession: Boolean(abziExam.meta.defaultCountAsStudySession),
        sendIncorrectsToReview: false,
        kind: isMockType(ABZI_EXAM_TYPE_ID, snapshot.catalogs) ? "test" : "block",
        testName: `ABZI ${current.date} MCQ`,
        scheduleEventId: current.id,
      })
      toast.success("Abzi exam logged")
      setLogging(false)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not log assessment")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-4 pb-8 pt-4 sm:max-w-lg sm:px-6">
        <SheetHeader className="text-left">
          <SheetTitle className="font-heading text-2xl">{eventDisplayTitle(current)}</SheetTitle>
          <SheetDescription>
            {current.date} · {formatEventClockRange(current)} {current.timezone.replace("America/", "")}
            {current.timeTentative ? " · time tentative" : ""}
          </SheetDescription>
        </SheetHeader>

        {current.topics.length > 1 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {current.topics.map((topic) => (
              <li key={topic} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                {topic}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Attendance</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={current.attendance === "attended" ? "default" : "outline"}
              onClick={() => void markAttendance("attended")}
            >
              Attended
            </Button>
            <Button
              size="sm"
              variant={current.attendance === "missed" ? "default" : "outline"}
              onClick={() => void markAttendance("missed")}
            >
              Missed
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void markAttendance(null)}>
              Clear
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Does not create a study session or change readiness.</p>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={prepDone} onChange={(e) => setPrepDone(e.target.checked)} />
            Preparation done
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={practiceDone} onChange={(e) => setPracticeDone(e.target.checked)} />
            Practice done
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={reviewDone} onChange={(e) => setReviewDone(e.target.checked)} />
            Review done
          </label>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => void savePatch({ prepDone, practiceDone, reviewDone })}
          >
            Save checklist
          </Button>
        </div>

        {isAbziTest(current) ? (
          <div className="mt-5 rounded-2xl bg-muted/40 p-3">
            <p className="text-sm font-medium">Friday MCQ · Abzi exam</p>
            {current.linkedAssessmentId ? (
              <p className="mt-1 text-sm text-muted-foreground">Linked assessment on file. Edit scores in History → Questions.</p>
            ) : logging ? (
              <div className="mt-3 space-y-2">
                <div>
                  <FieldLabel>Subject</FieldLabel>
                  <NativeSelect value={qSubject} onChange={(e) => setQSubject(e.target.value)}>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Total</FieldLabel>
                    <Input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} className="h-10" />
                  </div>
                  <div>
                    <FieldLabel>Correct</FieldLabel>
                    <Input inputMode="numeric" value={correct} onChange={(e) => setCorrect(e.target.value)} className="h-10" />
                  </div>
                  <div>
                    <FieldLabel>Incorrect</FieldLabel>
                    <Input inputMode="numeric" value={incorrect} onChange={(e) => setIncorrect(e.target.value)} className="h-10" />
                  </div>
                  <div>
                    <FieldLabel>Skipped</FieldLabel>
                    <Input inputMode="numeric" value={skipped} onChange={(e) => setSkipped(e.target.value)} className="h-10" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void logAbziExam()}>Save Abzi exam</Button>
                  <Button variant="ghost" onClick={() => setLogging(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button className="mt-2" variant="outline" onClick={() => setLogging(true)}>
                Log Abzi exam
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            To record study time, use Today → Start Session with source Abzi. Class attendance alone does not credit three hours.
          </p>
        )}

        <div className="mt-5 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Event details</p>
            <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close" : "Edit schedule"}
            </Button>
          </div>
          {editing ? (
            <div className="mt-3 space-y-3">
              <div>
                <FieldLabel>Title</FieldLabel>
                <Input className="h-10" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Topics (comma-separated)</FieldLabel>
                <Input className="h-10" value={topicsText} onChange={(e) => setTopicsText(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Date</FieldLabel>
                  <Input type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Timezone</FieldLabel>
                  <Input className="h-10" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Start</FieldLabel>
                  <Input type="time" className="h-10" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <FieldLabel>End</FieldLabel>
                  <Input type="time" className="h-10" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={timeTentative} onChange={(e) => setTimeTentative(e.target.checked)} />
                Time is tentative
              </label>
              <div>
                <FieldLabel>Notes</FieldLabel>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button onClick={() => void saveEdits()}>Save changes</Button>
            </div>
          ) : current.notes ? (
            <p className="mt-2 text-sm text-muted-foreground">{current.notes}</p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
