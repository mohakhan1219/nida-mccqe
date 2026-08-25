"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FieldLabel, NativeSelect } from "@/components/field"
import { useWorkspace } from "@/lib/data/workspace-context"
import { catalogByKind } from "@/lib/catalogs"
import { catalogName } from "@/lib/stats"
import { newId } from "@/lib/format"
import { nowIso } from "@/lib/dates"
import type { IncorrectReview } from "@/lib/types"

export function ReviewView() {
  const { snapshot, stats, upsertReview, deleteReview } = useWorkspace()
  const pending = snapshot.reviews.filter((r) => r.status !== "completed")
  const done = snapshot.reviews.filter((r) => r.status === "completed")
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Incorrect review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A prioritized queue. Overdue {stats.overdueReviews || 0} · pending {stats.pendingReviews || 0} · high{" "}
          {stats.highPriorityReviews || 0}
        </p>
      </div>

      {snapshot.reviews.length === 0 ? (
        <div className="soft-card p-6">
          <p className="text-sm text-muted-foreground">
            No review items yet. After a question block, use “Send incorrects to Review”, or add one here.
          </p>
        </div>
      ) : null}

      <Button variant="outline" onClick={() => setOpen((v) => !v)}>
        {open ? "Close" : "Add review item"}
      </Button>
      {open ? <ReviewForm onClose={() => setOpen(false)} /> : null}

      <ul className="space-y-3">
        {pending.map((r) => (
          <ReviewCard key={r.id} row={r} />
        ))}
      </ul>
      {done.length ? (
        <div>
          <p className="mb-2 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Completed</p>
          <ul className="space-y-2 opacity-70">
            {done.map((r) => (
              <ReviewCard key={r.id} row={r} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ReviewCard({ row }: { row: IncorrectReview }) {
  const { snapshot, upsertReview, deleteReview } = useWorkspace()
  return (
    <li className="soft-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {catalogName(snapshot, row.subjectId)}
            {row.topic ? ` · ${row.topic}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {row.questionCount} Q · {row.priority} · {row.status.replaceAll("_", " ")}
            {row.firstReviewAt ? ` · due ${row.firstReviewAt}` : ""}
          </p>
          {row.reason ? <p className="mt-1 text-sm">{row.reason}</p> : null}
        </div>
        <div className="flex gap-2">
          {row.status !== "completed" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void upsertReview({ ...row, status: "completed" })}
            >
              Done
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Delete this review item?")) void deleteReview(row.id)
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </li>
  )
}

function ReviewForm({ onClose }: { onClose: () => void }) {
  const { snapshot, upsertReview } = useWorkspace()
  const subjects = catalogByKind(snapshot.catalogs, "subject")
  const sources = catalogByKind(snapshot.catalogs, "source")
  const errors = catalogByKind(snapshot.catalogs, "error_type")
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "")
  const [providerId, setProviderId] = useState(sources[0]?.id ?? "")
  const [errorTypeId, setErrorTypeId] = useState(errors[0]?.id ?? "")
  const [topic, setTopic] = useState("")
  const [count, setCount] = useState("1")
  const [reason, setReason] = useState("")

  async function save() {
    const [d1, d7, d21] = snapshot.settings.reviewIntervals
    const start = nowIso().slice(0, 10)
    const add = (days: number) => {
      const dt = new Date(`${start}T12:00:00Z`)
      dt.setUTCDate(dt.getUTCDate() + days)
      return dt.toISOString().slice(0, 10)
    }
    try {
      await upsertReview({
        id: newId(),
        sourceKind: "manual",
        sourceId: null,
        subjectId,
        providerId,
        topic,
        questionCount: Number(count) || 1,
        errorTypeId,
        reason,
        correctConcept: "",
        priority: "medium",
        status: "pending",
        firstReviewAt: add(d1),
        secondReviewAt: add(d7),
        thirdReviewAt: add(d21),
        tutorQuestion: "",
        flashcardCreated: false,
        notes: "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
      toast.success("Added to review")
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    }
  }

  return (
    <div className="soft-card grid gap-3 p-4 md:grid-cols-2">
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
        <NativeSelect value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <FieldLabel>Error type</FieldLabel>
        <NativeSelect value={errorTypeId} onChange={(e) => setErrorTypeId(e.target.value)}>
          {errors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <FieldLabel>Count</FieldLabel>
        <Input value={count} onChange={(e) => setCount(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <FieldLabel>Topic</FieldLabel>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <FieldLabel>Reason</FieldLabel>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <Button onClick={() => void save()}>Save</Button>
    </div>
  )
}
