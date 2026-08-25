"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldLabel, NativeSelect } from "@/components/field"
import { useWorkspace } from "@/lib/data/workspace-context"
import { catalogByKind } from "@/lib/catalogs"
import { quoteIndexForDay, todayKey } from "@/lib/dates"
import { cnHours, formatDurationClock, formatPercent } from "@/lib/format"
import { catalogName } from "@/lib/stats"
import { confidenceLabel, stateLabel } from "@/lib/readiness"
import { isMockType } from "@/lib/metrics"

function localInputFromIso(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function isoFromLocal(v: string) {
  return new Date(v).toISOString()
}

export function TodayView() {
  const {
    snapshot,
    stats,
    readiness,
    running,
    punchIn,
    punchOut,
    discardRunning,
    saveManualSession,
    saveAssessment,
    loading,
  } = useWorkspace()

  const subjects = catalogByKind(snapshot.catalogs, "subject")
  const sources = catalogByKind(snapshot.catalogs, "source")
  const activities = catalogByKind(snapshot.catalogs, "activity")
  const assessmentTypes = catalogByKind(snapshot.catalogs, "assessment_type")

  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "")
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "")
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "")
  const [manual, setManual] = useState(false)
  const [startLocal, setStartLocal] = useState("")
  const [endLocal, setEndLocal] = useState("")
  const [elapsed, setElapsed] = useState(0)

  const [qSubject, setQSubject] = useState(subjects[0]?.id ?? "")
  const [qSource, setQSource] = useState(sources[0]?.id ?? "")
  const [qType, setQType] = useState(assessmentTypes[0]?.id ?? "")
  const [qStart, setQStart] = useState("")
  const [qEnd, setQEnd] = useState("")
  const [total, setTotal] = useState("")
  const [correct, setCorrect] = useState("")
  const [incorrect, setIncorrect] = useState("")
  const [skipped, setSkipped] = useState("0")
  const [countAsSession, setCountAsSession] = useState(true)
  const [sendReview, setSendReview] = useState(false)
  const [advanced, setAdvanced] = useState(false)

  useEffect(() => {
    if (!subjectId && subjects[0]) setSubjectId(subjects[0].id)
    if (!sourceId && sources[0]) setSourceId(sources[0].id)
    if (!activityId && activities[0]) setActivityId(activities[0].id)
    if (!qSubject && subjects[0]) setQSubject(subjects[0].id)
    if (!qSource && sources[0]) setQSource(sources[0].id)
    if (!qType && assessmentTypes[0]) setQType(assessmentTypes[0].id)
  }, [subjects, sources, activities, assessmentTypes, subjectId, sourceId, activityId, qSubject, qSource, qType])

  useEffect(() => {
    if (!running) return
    const tick = () => setElapsed((Date.now() - new Date(running.startAt).getTime()) / 1000)
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [running])

  const quote = useMemo(() => {
    const day = todayKey(snapshot.settings.timezone)
    const i = quoteIndexForDay(day, snapshot.quotes.length)
    return snapshot.quotes[i]
  }, [snapshot.quotes, snapshot.settings.timezone])

  async function onPunchIn() {
    try {
      await punchIn({ subjectId, sourceId, activityId })
      toast.success("Session started")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not punch in")
    }
  }

  async function onPunchOut() {
    try {
      await punchOut()
      toast.success("Session saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not punch out")
    }
  }

  async function onManualSave() {
    try {
      await saveManualSession({
        subjectId,
        sourceId,
        activityId,
        startAt: isoFromLocal(startLocal),
        endAt: isoFromLocal(endLocal),
      })
      toast.success("Session saved")
      setStartLocal("")
      setEndLocal("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    }
  }

  async function onSaveQuestions() {
    try {
      const t = Number(total)
      const c = Number(correct)
      const ic = Number(incorrect)
      const sk = Number(skipped)
      const startAt = qStart ? isoFromLocal(qStart) : running?.startAt ?? new Date().toISOString()
      const endAt = qEnd ? isoFromLocal(qEnd) : new Date().toISOString()
      const mock = isMockType(qType, snapshot.catalogs)
      await saveAssessment({
        subjectId: qSubject,
        sourceId: qSource,
        assessmentTypeId: qType,
        startAt,
        endAt,
        total: t,
        correct: c,
        incorrect: ic,
        skipped: sk,
        countAsStudySession: countAsSession && !running,
        sendIncorrectsToReview: sendReview,
        kind: mock ? "test" : "block",
      })
      toast.success("Assessment saved")
      setTotal("")
      setCorrect("")
      setIncorrect("")
      setSkipped("0")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    }
  }

  const empty = stats.lifetimeQuestions === 0 && stats.rhythm.lastStudyDate == null && !running
  const todayEvents = snapshot.schedule.filter((row) => row.date === todayKey(snapshot.settings.timezone))

  if (loading) {
    return <p className="text-sm text-muted-foreground">Opening today’s desk…</p>
  }

  return (
    <div className="space-y-6">
      <section className="soft-card px-5 py-5 md:px-7">
        <p className="text-[11px] tracking-[0.16em] text-primary/80 uppercase">For Nida</p>
        <p className="font-heading mt-2 max-w-2xl text-xl leading-snug text-foreground md:text-2xl">
          {quote?.message ?? "Begin."}
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Mini label="Today’s hours" value={cnHours(stats.todayHours * 60)} />
        <Mini label="Today’s questions" value={String(stats.todayQuestions || "—")} />
        <Mini label="Accuracy today" value={formatPercent(stats.todayAccuracy)} />
        <Mini
          label="Readiness"
          value={stateLabel(readiness.state)}
          hint={readiness.score != null ? `${readiness.score} · ${confidenceLabel(readiness.confidence)}` : undefined}
        />
      </section>

      <section className="soft-card p-5 md:p-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl">Study</h2>
            <p className="text-sm text-muted-foreground">Subject, source, activity. Punch in. Study. Punch out.</p>
          </div>
          {running ? (
            <span className="tabular text-lg font-medium text-primary">{formatDurationClock(elapsed)}</span>
          ) : null}
        </div>

        {running ? (
          <div className="mb-4 rounded-xl bg-accent/50 px-4 py-3 text-sm">
            Studying {catalogName(snapshot, running.subjectId)} · {catalogName(snapshot, running.sourceId)}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <FieldLabel>Subject</FieldLabel>
            <NativeSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={Boolean(running)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel>Source</FieldLabel>
            <NativeSelect value={sourceId} onChange={(e) => setSourceId(e.target.value)} disabled={Boolean(running)}>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel>Activity</FieldLabel>
            <NativeSelect value={activityId} onChange={(e) => setActivityId(e.target.value)} disabled={Boolean(running)}>
              {activities.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {running ? (
            <>
              <Button className="h-11 px-5" onClick={() => void onPunchOut()}>
                Punch Out
              </Button>
              <Button variant="ghost" className="h-11" onClick={() => void discardRunning()}>
                Discard
              </Button>
            </>
          ) : (
            <Button className="h-11 px-5" onClick={() => void onPunchIn()} disabled={!subjectId}>
              Punch In
            </Button>
          )}
          <Button variant="outline" className="h-11" onClick={() => setManual((v) => !v)} disabled={Boolean(running)}>
            {manual ? "Hide manual times" : "Enter times manually"}
          </Button>
        </div>

        {manual && !running ? (
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <FieldLabel>Start</FieldLabel>
              <Input type="datetime-local" className="h-11" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
            </div>
            <div>
              <FieldLabel>End</FieldLabel>
              <Input type="datetime-local" className="h-11" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="h-11 w-full" onClick={() => void onManualSave()}>
                Save session
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="soft-card p-5 md:p-6">
        <h2 className="font-heading text-xl">Questions / assessments</h2>
        <p className="mb-4 text-sm text-muted-foreground">Only if she practised questions or sat a test.</p>
        <div className="grid gap-3 md:grid-cols-3">
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
          <div>
            <FieldLabel>Source</FieldLabel>
            <NativeSelect value={qSource} onChange={(e) => setQSource(e.target.value)}>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel>Assessment type</FieldLabel>
            <NativeSelect value={qType} onChange={(e) => setQType(e.target.value)}>
              {assessmentTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Num label="Total" value={total} onChange={setTotal} />
          <Num label="Correct" value={correct} onChange={setCorrect} />
          <Num label="Incorrect" value={incorrect} onChange={setIncorrect} />
          <Num label="Skipped" value={skipped} onChange={setSkipped} />
        </div>
        <button
          type="button"
          className="mt-3 text-xs tracking-wide text-muted-foreground uppercase"
          onClick={() => setAdvanced((v) => !v)}
        >
          {advanced ? "Hide optional fields" : "Optional times & review"}
        </button>
        {advanced ? (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>Start</FieldLabel>
                <Input type="datetime-local" className="h-11" value={qStart} onChange={(e) => setQStart(e.target.value)} />
              </div>
              <div>
                <FieldLabel>End</FieldLabel>
                <Input type="datetime-local" className="h-11" value={qEnd} onChange={(e) => setQEnd(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={countAsSession} onChange={(e) => setCountAsSession(e.target.checked)} />
              Count as a study session
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendReview} onChange={(e) => setSendReview(e.target.checked)} />
              Send incorrects to Review
            </label>
          </div>
        ) : null}
        <Button className="mt-4 h-11 px-5" onClick={() => void onSaveQuestions()}>
          Save
        </Button>
      </section>

      {empty ? (
        <p className="px-1 text-sm text-muted-foreground">
          Your journey starts here. Start today’s study session when you are ready.
        </p>
      ) : null}

      {todayEvents.length ? (
        <section className="soft-card p-5">
          <h2 className="font-heading text-lg">Today’s schedule</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {todayEvents.map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span>
                  {row.startTime}–{row.endTime} · {row.eventType}
                  {row.subjectId ? ` · ${catalogName(snapshot, row.subjectId)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="soft-card px-4 py-4">
      <p className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-heading text-2xl tabular">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input
        inputMode="numeric"
        className="h-11 tabular"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

void localInputFromIso
