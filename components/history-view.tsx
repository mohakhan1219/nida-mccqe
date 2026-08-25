"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWorkspace } from "@/lib/data/workspace-context"
import { catalogName } from "@/lib/stats"
import { cnHours, formatPercent } from "@/lib/format"
import { accuracyOf } from "@/lib/metrics"
import type { QuestionBlock, StudySession, TestMock } from "@/lib/types"

export function HistoryView() {
  const { snapshot } = useWorkspace()
  const [tab, setTab] = useState<"sessions" | "blocks" | "tests">("sessions")

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
      <div>
        <h1 className="font-heading text-3xl">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Correct a mistake and the dashboard updates immediately.
        </p>
      </div>
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

      {tab === "sessions"
        ? sessions.map((s) => <SessionRow key={s.id} row={s} />)
        : null}
      {tab === "blocks"
        ? blocks.map((s) => <BlockRow key={s.id} row={s} />)
        : null}
      {tab === "tests"
        ? tests.map((s) => <TestRow key={s.id} row={s} />)
        : null}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="soft-card p-5 text-sm text-muted-foreground">{text}</p>
}

function SessionRow({ row }: { row: StudySession }) {
  const { snapshot, updateSession, deleteSession } = useWorkspace()
  const [edit, setEdit] = useState(false)
  const [notes, setNotes] = useState(row.notes)
  return (
    <article className="soft-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {catalogName(snapshot, row.subjectId)} · {catalogName(snapshot, row.sourceId)}
          </p>
          <p className="text-sm text-muted-foreground">
            {row.startAt.slice(0, 16).replace("T", " ")} · {cnHours(row.durationMinutes)} · {row.status}
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
              if (confirm("Delete this session?")) void deleteSession(row.id)
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      {edit ? (
        <div className="mt-3 space-y-2">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          <Button
            size="sm"
            onClick={() => {
              void updateSession({ ...row, notes }).then(() => {
                toast.success("Updated")
                setEdit(false)
              })
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
    </article>
  )
}

function BlockRow({ row }: { row: QuestionBlock }) {
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
            {row.startAt.slice(0, 10)} · {row.total} Q · {formatPercent(acc)} accuracy ·{" "}
            {formatPercent(row.correct / Math.max(row.total, 1))} score
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

function TestRow({ row }: { row: TestMock }) {
  const { snapshot, updateTest, deleteTest } = useWorkspace()
  const [edit, setEdit] = useState(false)
  const [correct, setCorrect] = useState(String(row.correct))
  const [incorrect, setIncorrect] = useState(String(row.incorrect))
  const [skipped, setSkipped] = useState(String(row.skipped))
  const [total, setTotal] = useState(String(row.total))
  return (
    <article className="soft-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {row.testName || catalogName(snapshot, row.assessmentTypeId)} · {catalogName(snapshot, row.subjectId)}
          </p>
          <p className="text-sm text-muted-foreground">
            {row.startAt.slice(0, 10)} · {formatPercent(row.correct / Math.max(row.total, 1))}
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
