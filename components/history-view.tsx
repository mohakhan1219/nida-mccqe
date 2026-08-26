"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { formatInTimeZone } from "date-fns-tz"
import { parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkspace } from "@/lib/data/workspace-context"
import { catalogName } from "@/lib/stats"
import { cnHours, formatPercent } from "@/lib/format"
import { accuracyOf, scoreOf } from "@/lib/metrics"
import type { QuestionBlock, StudySession, TestMock } from "@/lib/types"
import { PageTitle } from "@/components/page-title"
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/session-safety"

export function HistoryView() {
  const { snapshot } = useWorkspace()
  const [tab, setTab] = useState<"sessions" | "blocks" | "tests">("sessions")
  const tz = snapshot.settings.timezone

  const sessions = useMemo(
    () => [...snapshot.sessions].sort((a, b) => b.startAt.localeCompare(a.startAt)),
    [snapshot.sessions]
  )
  const blocks = useMemo(
    () => [...snapshot.blocks].sort((a, b) => b.startAt.localeCompare(a.startAt)),
    [snapshot.blocks]
  )
  const tests = useMemo(
    () => [...snapshot.tests].sort((a, b) => b.startAt.localeCompare(a.startAt)),
    [snapshot.tests]
  )

  return (
    <div className="space-y-5">
      <PageTitle kicker="The record" title="History">
        Correct a mistake and Journey updates immediately.
      </PageTitle>
      <div className="flex gap-2">
        {(["sessions", "blocks", "tests"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {t === "sessions" ? "Study" : t === "blocks" ? "Questions" : "Tests"}
          </Button>
        ))}
      </div>

      {tab === "sessions" && sessions.length === 0 ? <Empty text="No study sessions yet." /> : null}
      {tab === "blocks" && blocks.length === 0 ? <Empty text="No question blocks yet." /> : null}
      {tab === "tests" && tests.length === 0 ? <Empty text="No tests or mocks yet." /> : null}

      {tab === "sessions" ? sessions.map((s) => <SessionRow key={s.id} row={s} tz={tz} />) : null}
      {tab === "blocks" ? blocks.map((s) => <BlockRow key={s.id} row={s} tz={tz} />) : null}
      {tab === "tests" ? tests.map((s) => <TestRow key={s.id} row={s} tz={tz} />) : null}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="soft-card p-5 text-sm text-muted-foreground">{text}</p>
}

function stamp(iso: string, tz: string, withTime: boolean) {
  try {
    return formatInTimeZone(parseISO(iso), tz, withTime ? "MMM d · h:mm a" : "MMM d")
  } catch {
    return iso.slice(0, 16).replace("T", " ")
  }
}

function SessionRow({ row, tz }: { row: StudySession; tz: string }) {
  const { snapshot, updateSession, deleteSession } = useWorkspace()
  const [edit, setEdit] = useState(false)
  const [notes, setNotes] = useState(row.notes)
  const [topic, setTopic] = useState(row.topic)
  const [startLocal, setStartLocal] = useState(toDatetimeLocalValue(row.startAt))
  const [endLocal, setEndLocal] = useState(row.endAt ? toDatetimeLocalValue(row.endAt) : "")
  const end = row.endAt ? stamp(row.endAt, tz, true).split(" · ")[1] : "live"
  const live = row.status === "running" || !row.endAt
  return (
    <article className="soft-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {catalogName(snapshot, row.subjectId)} · {catalogName(snapshot, row.sourceId)}
          </p>
          <p className="text-sm text-muted-foreground">
            {stamp(row.startAt, tz, true)}
            {row.endAt ? `–${end}` : ""} · {cnHours(row.durationMinutes)} · {catalogName(snapshot, row.activityId)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setStartLocal(toDatetimeLocalValue(row.startAt))
              setEndLocal(row.endAt ? toDatetimeLocalValue(row.endAt) : "")
              setNotes(row.notes)
              setTopic(row.topic)
              setEdit((v) => !v)
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Delete this session?")) void deleteSession(row.id)
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      {edit ? (
        <div className="mt-3 space-y-2">
          {live ? (
            <p className="text-xs text-muted-foreground">End a live session from Today. Start and end times can be corrected here after it is saved.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Start time</p>
                <Input type="datetime-local" className="h-10" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">End time</p>
                <Input type="datetime-local" className="h-10" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
              </div>
            </div>
          )}
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" />
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          <Button
            size="sm"
            onClick={() => {
              try {
                const startAt = fromDatetimeLocalValue(startLocal)
                const endAt = live ? row.endAt : fromDatetimeLocalValue(endLocal)
                void updateSession({
                  ...row,
                  notes,
                  topic,
                  startAt,
                  endAt,
                }).then(() => {
                  toast.success("Updated")
                  setEdit(false)
                })
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Enter valid times.")
              }
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
    </article>
  )
}

function BlockRow({ row, tz }: { row: QuestionBlock; tz: string }) {
  const { snapshot, updateBlock, deleteBlock } = useWorkspace()
  const [edit, setEdit] = useState(false)
  const [correct, setCorrect] = useState(String(row.correct))
  const [incorrect, setIncorrect] = useState(String(row.incorrect))
  const [skipped, setSkipped] = useState(String(row.skipped))
  const [total, setTotal] = useState(String(row.total))
  const acc = accuracyOf(row)
  return (
    <article className="soft-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {catalogName(snapshot, row.subjectId)} · {catalogName(snapshot, row.sourceId)}
          </p>
          <p className="text-sm text-muted-foreground">
            {row.total} questions · {row.correct} correct · {row.incorrect} incorrect · {row.skipped} skipped ·{" "}
            {formatPercent(acc, 1)}
            <span className="text-muted-foreground"> · {stamp(row.startAt, tz, false)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEdit((v) => !v)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Delete this block?")) void deleteBlock(row.id)
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      {edit ? (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Input value={total} onChange={(e) => setTotal(e.target.value)} />
          <Input value={correct} onChange={(e) => setCorrect(e.target.value)} />
          <Input value={incorrect} onChange={(e) => setIncorrect(e.target.value)} />
          <Input value={skipped} onChange={(e) => setSkipped(e.target.value)} />
          <Button
            size="sm"
            className="col-span-2"
            onClick={() => {
              void updateBlock({
                ...row,
                total: Number(total),
                correct: Number(correct),
                incorrect: Number(incorrect),
                skipped: Number(skipped),
              })
                .then(() => {
                  toast.success("Updated")
                  setEdit(false)
                })
                .catch((e: Error) => toast.error(e.message))
            }}
          >
            Save counts
          </Button>
        </div>
      ) : null}
    </article>
  )
}

function TestRow({ row, tz }: { row: TestMock; tz: string }) {
  const { snapshot, updateTest, deleteTest } = useWorkspace()
  const [edit, setEdit] = useState(false)
  const [correct, setCorrect] = useState(String(row.correct))
  const [incorrect, setIncorrect] = useState(String(row.incorrect))
  const [skipped, setSkipped] = useState(String(row.skipped))
  const [total, setTotal] = useState(String(row.total))
  const name = row.testName || catalogName(snapshot, row.assessmentTypeId)
  return (
    <article className="soft-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {name} · {catalogName(snapshot, row.sourceId)}
          </p>
          <p className="text-sm text-muted-foreground">
            {row.total} questions · {formatPercent(scoreOf(row), 1)} · {cnHours(row.durationMinutes)} ·{" "}
            {stamp(row.startAt, tz, false)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEdit((v) => !v)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Delete this test?")) void deleteTest(row.id)
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      {edit ? (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Input value={total} onChange={(e) => setTotal(e.target.value)} />
          <Input value={correct} onChange={(e) => setCorrect(e.target.value)} />
          <Input value={incorrect} onChange={(e) => setIncorrect(e.target.value)} />
          <Input value={skipped} onChange={(e) => setSkipped(e.target.value)} />
          <Button
            size="sm"
            className="col-span-2"
            onClick={() => {
              void updateTest({
                ...row,
                total: Number(total),
                correct: Number(correct),
                incorrect: Number(incorrect),
                skipped: Number(skipped),
              })
                .then(() => {
                  toast.success("Updated")
                  setEdit(false)
                })
                .catch((e: Error) => toast.error(e.message))
            }}
          >
            Save counts
          </Button>
        </div>
      ) : null}
    </article>
  )
}
