"use client"

import { cn } from "@/lib/utils"

export function ChartFrame({
  title,
  children,
  dense,
}: {
  title: string
  children: React.ReactNode
  dense?: boolean
}) {
  return (
    <section className={dense ? "ops-panel p-4" : "soft-card p-5"}>
      <p className="mb-3 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{title}</p>
      {children}
    </section>
  )
}
