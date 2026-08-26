"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldLabel, NativeSelect } from "@/components/field"
import { useWorkspace } from "@/lib/data/workspace-context"
import { catalogByKind } from "@/lib/catalogs"
import { quoteIndexForDay, resolveAssessmentWindow, todayKey } from "@/lib/dates"
import { cnHours, formatDurationClock, formatHoursMinutes, formatPercent } from "@/lib/format"
import { accuracyOf, isMockType, scoreOf } from "@/lib/metrics"
import { catalogName } from "@/lib/stats"
import { quoteContext, selectDailyQuote } from "@/lib/quote-context"
import { evidenceBandLabel, goalCountCopy, goalHoursCopy, overallStageLabel, showReadinessPercent, warmCopy } from "@/lib/display"
import {
  fromDatetimeLocalValue,
  isStaleRunning,
  needsConfirmation,
  needsWarning,
  rawElapsedMinutes,
  sessionSafetyLabel,
  toDatetimeLocalValue,
} from "@/lib/session-safety"
import { Clock, Heart, HeartPulse, ListChecks, Square, Target } from "lucide-react"
import { NidaPortrait } from "@/components/nida-portrait"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
    confirmStillStudying,
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
  const [cover, setCover] = useState("")
  const [askCover, setAskCover] = useState(false)
  const [stopLocal, setStopLocal] = useState("")
  const [warningDismissed, setWarningDismissed] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [earlierMode, setEarlierMode] = useState(false)
  const [pendingEnd, setPendingEnd] = useState<string | undefined>(undefined)

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
      setWarningDismissed(false)
      setEarlierMode(false)
      setStopLocal("")
      return
    }
    const tick = () => setElapsed((Date.now() - new Date(running.startAt).getTime()) / 1000)
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    setWarningDismissed(false)
    setEarlierMode(false)
    setStopLocal("")
  }, [running?.id])

  const day = todayKey(snapshot.settings.timezone)
  const quote = useMemo(() => {
    const ctx = quoteContext(stats, snapshot.settings.weeklyHourGoal, snapshot.settings.weeklyQuestionGoal)
    return selectDailyQuote(snapshot.quotes, day, ctx) ?? snapshot.quotes[quoteIndexForDay(day, snapshot.quotes.length)]
  }, [snapshot.quotes, snapshot.settings.weeklyHourGoal, snapshot.settings.weeklyQuestionGoal, stats, day])

  const nextAction = running
    ? `You're live — stay with ${catalogName(snapshot, running.subjectId)}.`
    : stats.todayHours === 0 && stats.todayQuestions === 0
      ? "Start today's first study session."
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

  const confirmOpen = needsConfirmation(running, snapshot.settings)
  const staleOpen = isStaleRunning(running, snapshot.settings, snapshot.settings.timezone)
  const showWarning = needsWarning(running, snapshot.settings) && !warningDismissed
  const elapsedMinutes = running ? rawElapsedMinutes(running) : elapsed / 60

  async function onStartSession() {
    try {
      await punchIn({ subjectId, sourceId, activityId, topic })
      toast.success("Session started")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start session")
    }
  }

  async function onEndSession(endAt?: string) {
    try {
      await punchOut({
        endAt,
        topic: cover.trim() || undefined,
      })
      toast.success("Session saved")
      setAskCover(false)
      setCover("")
      setStopLocal("")
      setEarlierMode(false)
      setPendingEnd(undefined)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not end session")
    }
  }

  function requestEnd(endAt?: string) {
    setPendingEnd(endAt)
    setCover(topic || running?.topic || "")
    setAskCover(true)
  }

  async function onStillStudying() {
    try {
      await confirmStillStudying()
      setWarningDismissed(true)
      setEarlierMode(false)
      toast.success("Keep going — the timer is still running.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm")
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
      <section className="hero-card relative overflow-hidden">
        <svg
          className="pointer-events-none absolute top-[46%] left-6 hidden h-14 w-[58%] text-primary/20 md:block"
          viewBox="0 0 640 80"
          fill="none"
          aria-hidden
        >
          <path
            d="M0 42 H78 l12-22 10 44 14-52 12 30 8-8 H640"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <div className="relative grid items-end md:grid-cols-[minmax(0,1.15fr)_minmax(200px,300px)] lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,340px)]">
          <div className="relative z-10 p-6 pb-2 md:p-8 md:pr-4 md:pb-8">
            <p className="kicker">Welcome back, {snapshot.settings.studentName}</p>
            <h1 className="font-heading mt-2 max-w-xl text-[1.9rem] leading-snug md:text-[2.2rem]">
              Your journey to becoming a Canadian physician starts with today.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed md:text-[15px]">{nextAction}</p>
            {quote ? <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{quote.message}</p> : null}
          </div>
          <NidaPortrait
            priority
            className="relative z-10 mx-auto h-[230px] w-[min(100%,280px)] md:mx-0 md:h-[300px] md:w-full lg:h-[340px]"
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Mini label="Study time" value={cnHours(stats.todayHours * 60)} icon={Clock} />
        <Mini label="Questions" value={String(stats.todayQuestions || "—")} icon={ListChecks} />
        <Mini label="Accuracy" value={formatPercent(stats.todayAccuracy)} icon={Target} />
        <Mini
          label="Readiness"
          value={showReadinessPercent(readiness) ? overallStageLabel(readiness.state, readiness.examDate) : "Building Baseline"}
          hint={
            showReadinessPercent(readiness)
              ? `${readiness.score} · ${evidenceBandLabel(readiness.confidence)}`
              : `Evidence ${evidenceBandLabel(readiness.confidence)}`
          }
          icon={Heart}
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
          <div className="mt-5 space-y-3">
            {showWarning ? (
              <div className="rounded-xl border border-primary/25 bg-accent/70 px-3.5 py-3 text-sm">
                <p>
                  You&apos;ve been studying for {formatHoursMinutes(elapsedMinutes)}. Still studying?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" className="h-9" onClick={() => setWarningDismissed(true)}>
                    Still Studying
                  </Button>
                  <Button size="sm" variant="outline" className="h-9" onClick={() => requestEnd()}>
                    End Session
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button className="h-12 min-w-36 gap-2 px-6 text-base" onClick={() => requestEnd()}>
                <Square className="size-4" />
                End Session
              </Button>
              <Button variant="ghost" className="h-12" onClick={() => void discardRunning()}>
                Discard
              </Button>
            </div>
            {sessionSafetyLabel(running, snapshot.settings) === "Needs Confirmation" ? (
              <p className="text-xs text-muted-foreground">Needs confirmation — analytics are capped until you confirm.</p>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="soft-card p-5 md:p-6">
          <div className="mb-4">
            <h2 className="font-heading text-xl tracking-tight">Study</h2>
            <p className="text-sm text-muted-foreground">
              Choose your subject, source and activity, then start your session. The timer keeps running if you close
              the app or lock your phone.
            </p>
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
            <Button className="h-12 min-w-36 gap-2 px-6 text-base" onClick={() => void onStartSession()} disabled={!subjectId}>
              <HeartPulse className="size-4" />
              Start Session
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
            <h2 className="font-heading text-xl tracking-tight">Questions</h2>
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
        <p className="px-1 text-sm text-muted-foreground">
          Your journey starts here. Start today&apos;s first study session when you are ready.
        </p>
      ) : null}

      <Dialog open={staleOpen && !askCover} onOpenChange={() => undefined}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>You still have an open session from yesterday.</DialogTitle>
            <DialogDescription>When did you finish?</DialogDescription>
          </DialogHeader>
          {running ? (
            <div className="space-y-2 text-sm">
              <p>
                {catalogName(snapshot, running.subjectId)} · {catalogName(snapshot, running.sourceId)} ·{" "}
                {catalogName(snapshot, running.activityId)}
              </p>
              <p className="text-muted-foreground">
                Started at {toDatetimeLocalValue(running.startAt).replace("T", " ")}
              </p>
              <p className="text-muted-foreground">
                Raw elapsed time {formatHoursMinutes(elapsedMinutes)}
              </p>
              {earlierMode ? (
                <div>
                  <FieldLabel>Actual end time</FieldLabel>
                  <Input
                    type="datetime-local"
                    className="h-11"
                    value={stopLocal}
                    onChange={(e) => setStopLocal(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="sm:flex-col sm:items-stretch">
            {earlierMode ? (
              <Button
                onClick={() => {
                  try {
                    requestEnd(fromDatetimeLocalValue(stopLocal))
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Enter a valid time.")
                  }
                }}
              >
                Save actual end
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setEarlierMode(true)}>
                Enter actual end time
              </Button>
            )}
            <Button onClick={() => requestEnd()}>End now</Button>
            <Button variant="secondary" onClick={() => void onStillStudying()}>
              I am still studying
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen && !staleOpen && !askCover} onOpenChange={() => undefined}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Session needs confirmation</DialogTitle>
            <DialogDescription>Were you studying continuously?</DialogDescription>
          </DialogHeader>
          {running ? (
            <div className="space-y-2 text-sm">
              <p>
                {catalogName(snapshot, running.subjectId)} · {catalogName(snapshot, running.sourceId)}
              </p>
              <p className="text-muted-foreground">
                Started: {toDatetimeLocalValue(running.startAt).replace("T", " ")}
              </p>
              <p className="text-muted-foreground">
                Current elapsed: {formatHoursMinutes(elapsedMinutes)}
              </p>
              {earlierMode ? (
                <div>
                  <FieldLabel>When did you actually stop?</FieldLabel>
                  <Input
                    type="datetime-local"
                    className="h-11"
                    value={stopLocal}
                    onChange={(e) => setStopLocal(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="sm:flex-col sm:items-stretch">
            <Button onClick={() => void onStillStudying()}>Still Studying</Button>
            <Button variant="outline" onClick={() => requestEnd()}>
              End Session Now
            </Button>
            {earlierMode ? (
              <Button
                variant="secondary"
                onClick={() => {
                  try {
                    requestEnd(fromDatetimeLocalValue(stopLocal))
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Enter a valid time.")
                  }
                }}
              >
                Save earlier end
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setEarlierMode(true)}>
                I Stopped Earlier
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={askCover} onOpenChange={setAskCover}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>What did you cover?</DialogTitle>
            <DialogDescription>Optional. Reuses Topic — skip if you already logged it.</DialogDescription>
          </DialogHeader>
          <Input
            className="h-11"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            placeholder="e.g. AKI + nephrotic syndrome"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => void onEndSession(pendingEnd)}>
              Skip
            </Button>
            <Button onClick={() => void onEndSession(pendingEnd)}>Save session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Mini({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Clock
}) {
  return (
    <div className="soft-card px-3.5 py-3.5 md:px-4">
      <div className="flex items-start justify-between gap-2">
        <p className="kicker text-[10px] tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/35">
          <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-heading text-[1.35rem] tabular leading-none md:text-[1.5rem]">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
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
