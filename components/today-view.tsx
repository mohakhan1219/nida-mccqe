"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldLabel, NativeSelect } from "@/components/field"
import { useWorkspace } from "@/lib/data/workspace-context"
import { catalogByKind } from "@/lib/catalogs"
import { quoteIndexForDay, resolveAssessmentWindow, todayKey } from "@/lib/dates"
import { cnHours, formatDurationClock, formatPercent } from "@/lib/format"
import { accuracyOf, isMockType, scoreOf } from "@/lib/metrics"
import { catalogName } from "@/lib/stats"
import { quoteContext, selectDailyQuote } from "@/lib/quote-context"
import { evidenceBandLabel, goalCountCopy, goalHoursCopy, overallStageLabel, showReadinessPercent, warmCopy } from "@/lib/display"

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
  const [topic, setTopic] = useState("")
  const [manual, setManual] = useState(false)
  const [startLocal, setStartLocal] = useState("")
  const [endLocal, setEndLocal] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [warned, setWarned] = useState(false)

  const [qSubject, setQSubject] = useState(subjects[0]?.id ?? "")
  const [qSource, setQSource] = useState(sources[0]?.id ?? "")
  const [qType, setQType] = useState(assessmentTypes[0]?.id ?? "")
  const [qTopic, setQTopic] = useState("")
  const [qName, setQName] = useState("")
  const [qStart, setQStart] = useState("")
  const [qEnd, setQEnd] = useState("")
  const [total, setTotal] = useState("")
  const [correct, setCorrect] = useState("")
  const [incorrect, setIncorrect] = useState("")
  const [skipped, setSkipped] = useState("0")
  const [countAsSession, setCountAsSession] = useState(true)
  const [sendReview, setSendReview] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)

  useEffect(() => {
    if (!subjectId && subjects[0]) setSubjectId(subjects[0].id)
    if (!sourceId && sources[0]) setSourceId(sources[0].id)
    if (!activityId && activities[0]) setActivityId(activities[0].id)
    if (!qSubject && subjects[0]) setQSubject(subjects[0].id)
    if (!qSource && sources[0]) setQSource(sources[0].id)
    if (!qType && assessmentTypes[0]) setQType(assessmentTypes[0].id)
  }, [subjects, sources, activities, assessmentTypes, subjectId, sourceId, activityId, qSubject, qSource, qType])

  useEffect(() => {
    if (!running) {
      setElapsed(0)
      setWarned(false)
      return
    }
    const tick = () => setElapsed((Date.now() - new Date(running.startAt).getTime()) / 1000)
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!running || warned) return
    const limit = snapshot.settings.warnSessionHours * 3600
    if (limit > 0 && elapsed >= limit) {
      setWarned(true)
      toast.message("Long session", { description: "Consider punching out and resting." })
    }
  }, [elapsed, running, warned, snapshot.settings.warnSessionHours])

  const day = todayKey(snapshot.settings.timezone)
  const quote = useMemo(() => {
    const ctx = quoteContext(stats, snapshot.settings.weeklyHourGoal, snapshot.settings.weeklyQuestionGoal)
    return selectDailyQuote(snapshot.quotes, day, ctx) ?? snapshot.quotes[quoteIndexForDay(day, snapshot.quotes.length)]
  }, [snapshot.quotes, snapshot.settings.weeklyHourGoal, snapshot.settings.weeklyQuestionGoal, stats, day])

  const nextAction = running
    ? `You're live — stay with ${catalogName(snapshot, running.subjectId)}.`
    : stats.todayHours === 0 && stats.todayQuestions === 0
      ? "Punch in for today's first session."
      : warmCopy(readiness.nextFocus)

  const mock = isMockType(qType, snapshot.catalogs)
  const liveCounts = {
    total: Number(total),
    correct: Number(correct),
    incorrect: Number(incorrect),
    skipped: Number(skipped) || 0,
  }
  const liveReady = liveCounts.total > 0 && Number.isFinite(liveCounts.total)
  const liveAttempted = liveCounts.correct + liveCounts.incorrect
  const liveAccuracy = liveReady ? accuracyOf(liveCounts) : null
  const liveScore = liveReady ? scoreOf(liveCounts) : null
  const liveAttemptedPct = liveReady ? liveAttempted / liveCounts.total : null

  async function onPunchIn() {
    try {
      await punchIn({ subjectId, sourceId, activityId, topic })
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
        topic,
        startAt: isoFromLocal(startLocal),
        endAt: isoFromLocal(endLocal),
      })
      toast.success("Session saved")
      setStartLocal("")
      setEndLocal("")
      setManual(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    }
  }

  async function onSaveQuestions() {
    try {
      const { startAt, endAt } = resolveAssessmentWindow({
        startLocal: qStart,
        endLocal: qEnd,
        runningStartAt: running?.startAt,
      })
      await saveAssessment({
        subjectId: qSubject,
        sourceId: qSource,
        assessmentTypeId: qType,
        topic: qTopic,
        testName: qName,
        startAt,
        endAt,
        total: liveCounts.total,
        correct: liveCounts.correct,
        incorrect: liveCounts.incorrect,
        skipped: liveCounts.skipped,
        countAsStudySession: countAsSession && !running,
        sendIncorrectsToReview: sendReview,
        kind: mock ? "test" : "block",
      })
      toast.success("Assessment saved")
      setTotal("")
      setCorrect("")
      setIncorrect("")
      setSkipped("0")
      setQName("")
      setQTopic("")
      setShowQuestions(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    }
  }

  const empty = stats.lifetimeQuestions === 0 && stats.rhythm.lastStudyDate == null && !running
  const todayEvents = snapshot.schedule.filter((row) => row.date === day)

  if (loading) {
    return <p className="text-sm text-muted-foreground">Opening today's desk…</p>
  }

  return (
    <div className="space-y-5 pb-4">
      <section className="soft-card px-5 py-5 md:px-6">
        <p className="text-[11px] tracking-[0.16em] text-primary/80 uppercase">Today</p>
        <h1 className="font-heading mt-1 text-2xl leading-snug md:text-[1.85rem]">{nextAction}</h1>
        {quote ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{quote.message}</p> : null}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Mini label="Study time" value={cnHours(stats.todayHours * 60)} />
        <Mini label="Questions" value={String(stats.todayQuestions || "—")} />
        <Mini label="Accuracy" value={formatPercent(stats.todayAccuracy)} />
        <Mini
          label="Readiness"
          value={showReadinessPercent(readiness) ? overallStageLabel(readiness.state, readiness.examDate) : "Building Baseline"}
          hint={
            showReadinessPercent(readiness)
              ? `${readiness.score} · ${evidenceBandLabel(readiness.confidence)}`
              : `Evidence ${evidenceBandLabel(readiness.confidence)}`
          }
        />
      </section>

      {running ? (
        <section className="live-card px-5 py-5 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-primary uppercase">Live session</p>
              <p className="font-heading mt-1 text-xl">
                {catalogName(snapshot, running.subjectId)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {catalogName(snapshot, running.sourceId)} · {catalogName(snapshot, running.activityId)}
                {running.topic ? ` · ${running.topic}` : ""}
              </p>
            </div>
            <p className="font-heading text-3xl tabular text-primary">{formatDurationClock(elapsed)}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="h-12 min-w-36 px-6 text-base" onClick={() => void onPunchOut()}>
              Punch Out
            </Button>
            <Button variant="ghost" className="h-12" onClick={() => void discardRunning()}>
              Discard
            </Button>
          </div>
        </section>
      ) : (
        <section className="soft-card p-5 md:p-6">
          <div className="mb-4">
            <h2 className="font-heading text-xl">Study</h2>
            <p className="text-sm text-muted-foreground">Subject, source, activity. Punch in.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel>Subject</FieldLabel>
              <NativeSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <FieldLabel>Source</FieldLabel>
              <NativeSelect value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <FieldLabel>Activity</FieldLabel>
              <NativeSelect value={activityId} onChange={(e) => setActivityId(e.target.value)}>
                {activities.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="mt-3">
            <FieldLabel>Topic (optional)</FieldLabel>
            <Input className="h-11" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. ACS, consent" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="h-12 min-w-36 px-6 text-base" onClick={() => void onPunchIn()} disabled={!subjectId}>
              Punch In
            </Button>
            <Button variant="ghost" className="h-12" onClick={() => setManual((v) => !v)}>
              {manual ? "Hide manual times" : "Enter times manually"}
            </Button>
          </div>
          {manual ? (
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
      )}

      <section className="soft-card p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl">Questions</h2>
            <p className="text-sm text-muted-foreground">Only if you practised questions or sat a test.</p>
          </div>
          <Button variant="outline" className="h-10" onClick={() => setShowQuestions((v) => !v)}>
            {showQuestions || liveReady ? "Hide" : "Log a block"}
          </Button>
        </div>
        {showQuestions || liveReady ? (
          <div className="mt-4 space-y-3">
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
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>Topic (optional)</FieldLabel>
                <Input className="h-11" value={qTopic} onChange={(e) => setQTopic(e.target.value)} />
              </div>
              {mock ? (
                <div>
                  <FieldLabel>Test / mock name (optional)</FieldLabel>
                  <Input className="h-11" value={qName} onChange={(e) => setQName(e.target.value)} />
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Num label="Total" value={total} onChange={setTotal} />
              <Num label="Correct" value={correct} onChange={setCorrect} />
              <Num label="Incorrect" value={incorrect} onChange={setIncorrect} />
              <Num label="Skipped" value={skipped} onChange={setSkipped} />
            </div>
            {liveReady ? (
              <p className="text-sm text-muted-foreground">
                Attempted {formatPercent(liveAttemptedPct)} · Accuracy {formatPercent(liveAccuracy)} · Score{" "}
                {formatPercent(liveScore)}
              </p>
            ) : null}
            <button type="button" className="text-xs tracking-wide text-muted-foreground uppercase" onClick={() => setAdvanced((v) => !v)}>
              {advanced ? "Hide optional fields" : "Optional times & review"}
            </button>
            {advanced ? (
              <div className="space-y-3">
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
            <Button className="h-11 px-5" onClick={() => void onSaveQuestions()}>
              Save
            </Button>
          </div>
        ) : null}
      </section>

      <p className="text-xs text-muted-foreground">
        Weekly study goal {goalHoursCopy(stats.week.hours, snapshot.settings.weeklyHourGoal)} · Question goal{" "}
        {goalCountCopy(stats.week.questions, snapshot.settings.weeklyQuestionGoal)}
      </p>

      {todayEvents.length ? (
        <section className="soft-card p-5">
          <h2 className="font-heading text-lg">Today's schedule</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {todayEvents.map((row) => (
              <li key={row.id}>
                {row.startTime}–{row.endTime} · {row.eventType}
                {row.subjectId ? ` · ${catalogName(snapshot, row.subjectId)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {empty ? (
        <p className="px-1 text-sm text-muted-foreground">Your journey starts here. Punch in when you are ready.</p>
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
      <Input inputMode="numeric" className="h-11 tabular" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
