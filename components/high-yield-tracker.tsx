"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FieldLabel, NativeSelect } from "@/components/field"
import { useWorkspace } from "@/lib/data/workspace-context"
import {
  FILIPE_SANTOS_CATALOG_TITLE,
  filterHighYieldTopics,
  highYieldPriorityLabel,
  highYieldStatusLabel,
  highYieldSubjects,
  summarizeHighYield,
} from "@/lib/high-yield"
import type { HighYieldPriority, HighYieldStatus } from "@/lib/types"

export function HighYieldTracker() {
  const { snapshot, upsertHighYieldTopic, ensureHighYieldCatalogImported, loading } = useWorkspace()
  const [subject, setSubject] = useState("")
  const [priority, setPriority] = useState<HighYieldPriority | "all">("all")
  const [importing, setImporting] = useState(false)

  const summary = useMemo(() => summarizeHighYield(snapshot.highYieldTopics), [snapshot.highYieldTopics])
  const subjects = useMemo(() => highYieldSubjects(snapshot.highYieldTopics), [snapshot.highYieldTopics])
  const rows = useMemo(
    () => filterHighYieldTopics(snapshot.highYieldTopics, { subject: subject || undefined, priority }),
    [snapshot.highYieldTopics, subject, priority]
  )

  useEffect(() => {
    if (loading) return
    if (snapshot.highYieldTopics.length > 0) return
    let cancelled = false
    setImporting(true)
    void ensureHighYieldCatalogImported()
      .then((r) => {
        if (cancelled) return
        if (r.added > 0) toast.success(`Loaded ${r.added} Filipe Santos high-yield topics`)
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Could not import topic catalog")
      })
      .finally(() => {
        if (!cancelled) setImporting(false)
      })
    return () => {
      cancelled = true
    }
  }, [loading, snapshot.highYieldTopics.length, ensureHighYieldCatalogImported])

  const highlight = rows.filter(
    (t) => (t.priority === "very_high" || t.priority === "high") && t.status !== "completed"
  )

  return (
    <div className="soft-card space-y-4 p-5">
      <div>
        <p className="text-sm text-muted-foreground">{FILIPE_SANTOS_CATALOG_TITLE}</p>
        <p className="mt-2 text-sm">
          {summary.completed} / {summary.total} completed · {summary.remainingVeryHigh} very-high remaining ·{" "}
          {summary.remainingHigh} high remaining · {summary.needsReview} need review
        </p>
      </div>

      {summary.bySubject.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {summary.bySubject.slice(0, 9).map((s) => (
            <button
              key={s.subject}
              type="button"
              className="rounded-xl border border-border/70 px-3 py-2 text-left text-sm hover:bg-accent/40"
              onClick={() => setSubject(s.subject)}
            >
              <span className="font-medium">{s.subject}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {s.completed}/{s.total} complete
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Subject</FieldLabel>
          <NativeSelect value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel>Priority</FieldLabel>
          <NativeSelect
            value={priority}
            onChange={(e) => setPriority(e.target.value as HighYieldPriority | "all")}
          >
            <option value="all">All priorities</option>
            <option value="very_high">Very high</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </NativeSelect>
        </div>
      </div>

      {highlight.length && priority === "all" && !subject ? (
        <div className="rounded-xl bg-accent/40 px-3 py-2 text-sm">
          Remaining Very High / High: <strong>{highlight.length}</strong> topics still open. Filter by subject to work
          through them.
        </div>
      ) : null}

      {importing ? <p className="text-sm text-muted-foreground">Loading topic catalog…</p> : null}

      <ul className="space-y-2">
        {rows.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.topic}</p>
              <p className="text-xs text-muted-foreground">
                {t.subject} · {highYieldPriorityLabel(t.priority)}
                {t.priority === "very_high" || t.priority === "high" ? " · focus" : ""}
              </p>
            </div>
            <NativeSelect
              aria-label={`Status for ${t.topic}`}
              value={t.status}
              onChange={(e) => {
                const status = e.target.value as HighYieldStatus
                void upsertHighYieldTopic({ ...t, status })
                  .then(() => toast.success(`${highYieldStatusLabel(status)}`))
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not update"))
              }}
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="needs_review">Needs Review</option>
            </NativeSelect>
          </li>
        ))}
      </ul>

      {!rows.length && !importing ? (
        <p className="text-sm text-muted-foreground">No topics match these filters.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setImporting(true)
            void ensureHighYieldCatalogImported()
              .then((r) =>
                toast.success(
                  r.added || r.updatedMeta
                    ? `Catalog synced (+${r.added}, meta ${r.updatedMeta})`
                    : "Catalog already up to date"
                )
              )
              .catch((e) => toast.error(e instanceof Error ? e.message : "Import failed"))
              .finally(() => setImporting(false))
          }}
        >
          Sync catalog (keeps your progress)
        </Button>
      </div>
    </div>
  )
}
