"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FieldLabel, NativeSelect } from "@/components/field"
import { useWorkspace } from "@/lib/data/workspace-context"
import type { BackupFile, CatalogKind, ScheduleEvent, Settings } from "@/lib/types"
import { newId } from "@/lib/format"
import { catalogByKind } from "@/lib/catalogs"

export function SettingsView() {
  const {
    snapshot,
    mode,
    updateSettings,
    updateCatalogItem,
    addCatalogItem,
    updateCourse,
    exportBackup,
    restoreBackup,
    signOut,
  } = useWorkspace()
  const fileRef = useRef<HTMLInputElement>(null)
  const s = snapshot.settings

  function num(key: keyof Settings, label: string, step = "1") {
    return (
      <div>
        <FieldLabel>{label}</FieldLabel>
        <Input
          type="number"
          step={step}
          className="h-10"
          defaultValue={String(s[key] ?? "")}
          onBlur={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v)) return
            void updateSettings({ [key]: v } as Partial<Settings>)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="font-heading text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every target is editable. Nothing here is a medical constant.
        </p>
      </div>

      <section className="soft-card space-y-4 p-5">
        <h2 className="font-heading text-lg">Profile & exam</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel>Student name</FieldLabel>
            <Input
              defaultValue={s.studentName}
              onBlur={(e) => void updateSettings({ studentName: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>Exam name</FieldLabel>
            <Input defaultValue={s.examName} onBlur={(e) => void updateSettings({ examName: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Exam date (empty until booked)</FieldLabel>
            <Input
              type="date"
              defaultValue={s.examDate ?? ""}
              onBlur={(e) => void updateSettings({ examDate: e.target.value || null })}
            />
          </div>
          <div>
            <FieldLabel>Timezone</FieldLabel>
            <Input defaultValue={s.timezone} onBlur={(e) => void updateSettings({ timezone: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="soft-card space-y-4 p-5">
        <h2 className="font-heading text-lg">Study targets</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {num("dailyHourGoal", "Daily hours", "0.5")}
          {num("dailyQuestionGoal", "Daily questions")}
          {num("weeklyHourGoal", "Weekly hours", "0.5")}
          {num("weeklyQuestionGoal", "Weekly questions")}
          {num("accuracyGoal", "Accuracy goal (0–1)", "0.01")}
          {num("mockScoreBar", "Mock score bar (0–1)", "0.01")}
        </div>
      </section>

      <section className="soft-card space-y-4 p-5">
        <h2 className="font-heading text-lg">Readiness thresholds</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {num("minQuestionsForBaseline", "Baseline question volume")}
          {num("minStudyDaysForBaseline", "Baseline study days")}
          {num("volumeHalfLife", "Volume half-life (questions)")}
          {num("accuracyPriorStrength", "Accuracy shrinkage strength")}
          {num("minMocksForReady", "Mocks required to book")}
          {num("readyScoreThreshold", "Ready score")}
          {num("gettingCloseThreshold", "Getting close score")}
          {num("progressingThreshold", "Progressing score")}
          {num("weakSubjectFloor", "Weak subject floor")}
          {num("overdueReviewCap", "Overdue review cap")}
          {num("coverageReadyRatio", "Coverage ratio to book", "0.05")}
          {num("highConfidenceMin", "High confidence min")}
          {num("moderateConfidenceMin", "Moderate confidence min")}
          {num("minQuestionsForSubject", "Min questions / subject")}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(s.weights).map(([k, v]) => (
            <div key={k}>
              <FieldLabel>Weight · {k}</FieldLabel>
              <Input
                type="number"
                defaultValue={v}
                onBlur={(e) =>
                  void updateSettings({
                    weights: { ...s.weights, [k]: Number(e.target.value) },
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <CatalogEditor kind="subject" title="Subjects (weight = importance)" />
      <CatalogEditor kind="source" title="Sources" />
      <CatalogEditor kind="activity" title="Activities" />
      <CatalogEditor kind="assessment_type" title="Assessment types" />

      <section className="soft-card space-y-4 p-5">
        <h2 className="font-heading text-lg">Courses & question banks</h2>
        <p className="text-sm text-muted-foreground">Abzi schedule remains empty until you add unit or question targets.</p>
        {snapshot.courses.map((c) => (
          <div key={c.id} className="grid gap-2 border-t border-border/60 py-3 md:grid-cols-4">
            <p className="pt-2 text-sm font-medium">{c.name}</p>
            <div>
              <FieldLabel>Total units</FieldLabel>
              <Input
                defaultValue={c.totalUnits ?? ""}
                onBlur={(e) =>
                  void updateCourse({
                    ...c,
                    totalUnits: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <FieldLabel>Completed units</FieldLabel>
              <Input
                defaultValue={c.completedUnits}
                onBlur={(e) => void updateCourse({ ...c, completedUnits: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <FieldLabel>Question target</FieldLabel>
              <Input
                defaultValue={c.totalQuestions ?? ""}
                onBlur={(e) =>
                  void updateCourse({
                    ...c,
                    totalQuestions: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        ))}
      </section>

      <ScheduleEditor />

      <section className="soft-card space-y-3 p-5">
        <h2 className="font-heading text-lg">Backup</h2>
        <p className="text-sm text-muted-foreground">
          Export preserves sessions, assessments, reviews, settings, courses, catalogs, and schedule.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const blob = exportBackup()
              const a = document.createElement("a")
              a.href = URL.createObjectURL(blob)
              a.download = `nida-os-backup-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
            }}
          >
            Export backup
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Restore backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const json = JSON.parse(await file.text()) as BackupFile
                if (json.version !== 1) throw new Error("Unknown backup version")
                await restoreBackup(json)
                toast.success("Backup restored")
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Restore failed")
              }
            }}
          />
        </div>
      </section>

      {mode === "cloud" ? (
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      ) : null}
    </div>
  )
}

function CatalogEditor({ kind, title }: { kind: CatalogKind; items?: unknown; title: string }) {
  const { snapshot, updateCatalogItem, addCatalogItem } = useWorkspace()
  const rows = snapshot.catalogs.filter((c) => c.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder)
  const [name, setName] = useState("")

  return (
    <section className="soft-card space-y-3 p-5">
      <h2 className="font-heading text-lg">{title}</h2>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="grid grid-cols-[1fr_70px_70px] items-center gap-2">
            <Input
              defaultValue={row.name}
              onBlur={(e) => void updateCatalogItem({ ...row, name: e.target.value })}
            />
            <Input
              title="Weight"
              defaultValue={row.meta.weight ?? 1}
              onBlur={(e) =>
                void updateCatalogItem({
                  ...row,
                  meta: { ...row.meta, weight: Number(e.target.value) },
                })
              }
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                defaultChecked={row.active}
                onChange={(e) => void updateCatalogItem({ ...row, active: e.target.checked })}
              />
              On
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input placeholder="Add name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          variant="outline"
          onClick={() => {
            if (!name.trim()) return
            const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
            void addCatalogItem({
              id: `${kind}:${slug}-${newId().slice(0, 6)}`,
              kind,
              slug,
              name: name.trim(),
              active: true,
              sortOrder: rows.length + 1,
              meta: { weight: 1, scored: kind === "subject", core: kind === "subject" },
            })
            setName("")
          }}
        >
          Add
        </Button>
      </div>
    </section>
  )
}

function ScheduleEditor() {
  const { snapshot, upsertSchedule, deleteSchedule } = useWorkspace()
  const subjects = catalogByKind(snapshot.catalogs, "subject")
  const rows = [...snapshot.schedule].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("11:00")
  const [eventType, setEventType] = useState("Lecture")
  const [subjectId, setSubjectId] = useState("")
  const [courseId, setCourseId] = useState(snapshot.courses.find((c) => c.id === "course:abzi")?.id ?? snapshot.courses[0]?.id ?? "")
  const [notes, setNotes] = useState("")

  async function addEvent() {
    if (!date) {
      toast.error("Choose a date")
      return
    }
    const row: ScheduleEvent = {
      id: newId(),
      date,
      startTime,
      endTime,
      timezone: snapshot.settings.timezone,
      eventType,
      subjectId: subjectId || null,
      courseId: courseId || null,
      status: "scheduled",
      notes,
    }
    try {
      await upsertSchedule(row)
      toast.success("Schedule saved")
      setNotes("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save schedule")
    }
  }

  return (
    <section className="soft-card space-y-4 p-5">
      <div>
        <h2 className="font-heading text-lg">Schedule</h2>
        <p className="text-sm text-muted-foreground">
          Abzi, Felipe, or any planned block. Empty until you add it — nothing is preloaded from Excel.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Schedule not added yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 border-t border-border/60 py-3">
              <div>
                <p className="text-sm font-medium">
                  {row.date} · {row.startTime}–{row.endTime}
                </p>
                <p className="text-sm text-muted-foreground">
                  {row.eventType}
                  {row.subjectId ? ` · ${snapshot.catalogs.find((c) => c.id === row.subjectId)?.name}` : ""}
                  {row.courseId ? ` · ${snapshot.courses.find((c) => c.id === row.courseId)?.name}` : ""}
                </p>
                {row.notes ? <p className="mt-1 text-sm">{row.notes}</p> : null}
              </div>
              <Button variant="ghost" onClick={() => void deleteSchedule(row.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <FieldLabel>Date</FieldLabel>
          <Input type="date" className="h-10" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Start</FieldLabel>
          <Input type="time" className="h-10" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <FieldLabel>End</FieldLabel>
          <Input type="time" className="h-10" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Type</FieldLabel>
          <NativeSelect value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {["Lecture", "Tutorial", "Question block", "Review", "Mock", "Other"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel>Subject</FieldLabel>
          <NativeSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">None</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel>Course</FieldLabel>
          <NativeSelect value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">None</option>
            {snapshot.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div>
        <FieldLabel>Notes</FieldLabel>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button variant="outline" onClick={() => void addEvent()}>
        Add schedule event
      </Button>
    </section>
  )
}
