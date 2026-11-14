"use client"

import { useWorkspace } from "@/lib/data/workspace-context"
import { breakMinutesSoFar, studyCreditMinutes } from "@/lib/session-pause"

export function TodayView() {
  const { loading, running } = useWorkspace()
  if (loading) return <p className="text-sm text-muted-foreground">Opening today&apos;s desk…</p>
  const study = running ? studyCreditMinutes(running) : 0
  const brk = running ? breakMinutesSoFar(running) : 0
  return (
    <div className="space-y-4 p-4">
      <h1 className="font-heading text-2xl">Today</h1>
      <p className="text-sm text-muted-foreground">
        Phase 1 session controls are wiring up. Study credit {study.toFixed(1)} min
        {brk ? ` · break ${brk.toFixed(1)} min` : ""}.
      </p>
      <p className="text-sm">Please refresh after the full Today view lands.</p>
    </div>
  )
}
