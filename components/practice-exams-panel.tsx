"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldLabel, NativeSelect } from "@/components/field"
import { useWorkspace } from "@/lib/data/workspace-context"
import { todayKey } from "@/lib/dates"
import { newId } from "@/lib/format"
import {
  PRACTICE_ASSESSMENT_PROVIDERS,
  completedPracticeAssessments,
  practiceProviderLabel,
  upcomingPracticeAssessments,
} from "@/lib/practice-assessments"
import type { PracticeAssessment, PracticeAssessmentProvider } from "@/lib/types"

export function PracticeExamsPanel({ compact = false }: { compact?: boolean }) {
  const {
    snapshot,
    upsertPracticeAssessment,
    completePracticeAssessment,
    deletePracticeAssessment,
  } = useWorkspace()
  const day = todayKey(snapshot.settings.timezone)
  const upcoming = useMemo(
    () => upcomingPracticeAssessments(snapshot.practiceAssessments, day),
    [snapshot.practiceAssessments, day]
  )
  const completed = useMemo(
    () => completedPracticeAssessments(snapshot.practiceAssessments),
    [snapshot.practiceAssessments]
  )

  const [provider, setProvider] = useState<PracticeAssessmentProvider>("mccqe1_official_practice")
  const [title, setTitle] = useState("MCCQE1 full-length official practice exam")
  const [scheduledDate, setScheduledDate] = useState("2027-01-16")
  const [completeId, setCompleteId] = useState<string | null>(null)
  const [total, setTotal] = useState("210")
  const [correct, setCorrect] = useState("")
  const [incorrect, setIncorrect] = useState("")
  const [completedDate, setCompletedDate] = useState(day)
  const [scorePct, setScorePct] = useState("")

  async function schedule() {
    if (!scheduledDate) {
      toast.error("Choose a practice exam date")
      return
    }
    const row: PracticeAssessment = {
      id: newId(),
      provider,
      title: title.trim() || practiceProviderLabel(provider),
      status: "scheduled",
      scheduledDate,
      completedDate: null,
      total: null,
      correct: null,
      incorrect: null,
      scorePct: null,
      notes: "",
      linkedTestId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    try {
      await upsertPracticeAssessment(row)
      toast.success("Practice exam scheduled")
      if (provider === "mccqe1_official_practice") setScheduledDate("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule")
    }
  }

  async function submitResults() {
    if (!completeId) return
    const t = Number(total)
    const c = Number(correct)
    const inc = Number(incorrect)
    if (!Number.isFinite(t) || !Number.isFinite(c) || !Number.isFinite(inc) || t <= 0) {
      toast.error("Enter total, correct, and incorrect counts")
      return
    }
    try {
      await completePracticeAssessment(completeId, {
        completedDate: completedDate || day,
        total: t,
        correct: c,
        incorrect: inc,
        scorePct: scorePct === "" ? null : Number(scorePct),
      })
      toast.success("Results saved to performance (single mock entry)")
      setCompleteId(null)
      setCorrect("")
      setIncorrect("")
      setScorePct("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save results")
    }
  }

  return (
    <div className={compact ? "space-y-3" : "soft-card space-y-4 p-5"}>
      {!compact ? (
        <p className="text-sm text-muted-foreground">
          Practice and mock assessments stay separate from the official MCCQE1 licensing exam booking. Completing one
          writes a single mock result for scoring — never double-counted.
        </p>
      ) : null}

      {upcoming.length ? (
        <ul className="space-y-2 text-sm">
          {upcoming.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2">
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {row.scheduledDate} · {practiceProviderLabel(row.provider)} · scheduled
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setCompleteId(row.id)}>
                  Enter results
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void deletePracticeAssessment(row.id).then(() => toast.success("Removed"))
                  }
                >
                  Cancel
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No upcoming practice exams scheduled.</p>
      )}

      {!compact ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel>Provider</FieldLabel>
            <NativeSelect
              value={provider}
              onChange={(e) => {
                const next = e.target.value as PracticeAssessmentProvider
                setProvider(next)
                if (next === "mccqe1_official_practice") {
                  setTitle("MCCQE1 full-length official practice exam")
                  if (!scheduledDate) setScheduledDate("2027-01-16")
                } else {
                  setTitle(practiceProviderLabel(next))
                }
              }}
            >
              {PRACTICE_ASSESSMENT_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel>Scheduled date</FieldLabel>
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>Title</FieldLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => void schedule()}>Schedule practice exam</Button>
          </div>
        </div>
      ) : null}

      {completeId ? (
        <div className="rounded-xl border border-border/70 p-3 space-y-3">
          <p className="text-sm font-medium">Enter completed assessment results</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <FieldLabel>Assessment date</FieldLabel>
              <Input type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Score % (optional)</FieldLabel>
              <Input value={scorePct} onChange={(e) => setScorePct(e.target.value)} placeholder="e.g. 72" />
            </div>
            <div>
              <FieldLabel>Total questions</FieldLabel>
              <Input value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Correct</FieldLabel>
              <Input value={correct} onChange={(e) => setCorrect(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Incorrect</FieldLabel>
              <Input value={incorrect} onChange={(e) => setIncorrect(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void submitResults()}>
              Save results
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCompleteId(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      {!compact && completed.length ? (
        <div>
          <p className="kicker mb-2">Completed practice assessments</p>
          <ul className="space-y-2 text-sm">
            {completed.slice(0, 6).map((row) => (
              <li key={row.id} className="flex justify-between gap-3 border-b border-border/50 py-1.5">
                <span>
                  {row.completedDate} · {row.title}
                </span>
                <span className="text-muted-foreground">
                  {row.scorePct != null ? `${row.scorePct}%` : `${row.correct}/${row.total}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
