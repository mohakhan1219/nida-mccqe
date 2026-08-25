"use client"

import { cn } from "@/lib/utils"
import { goalProgress } from "@/lib/display"

export function GoalMeter({
  actual,
  goal,
  label,
  copy,
  className,
}: {
  actual: number
  goal: number
  label: string
  copy: string
  className?: string
}) {
  const g = goalProgress(actual, goal)
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
        <p className="text-xs tabular text-muted-foreground">{copy}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            g.status === "exceeded" ? "bg-emerald-700/80" : "bg-primary"
          )}
          style={{ width: `${g.bar}%` }}
        />
      </div>
    </div>
  )
}
