"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, ClipboardList, Home, LayoutDashboard, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/lib/data/workspace-context"
import { formatDurationClock } from "@/lib/format"
import { catalogName } from "@/lib/stats"
import { useEffect, useState } from "react"
import { NidaAvatar } from "@/components/nida-portrait"

const NAV = [
  { href: "/", label: "Today", icon: Home },
  { href: "/journey", label: "Journey", icon: LayoutDashboard },
  { href: "/review", label: "Review", icon: BookOpen },
  { href: "/history", label: "History", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings2 },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const authScreen = pathname.startsWith("/login") || pathname.startsWith("/auth")
  if (authScreen) return <>{children}</>
  const ops = pathname.startsWith("/ops")

  return (
    <>
      {pathname === "/" ? <div className="page-backdrop page-backdrop-today" aria-hidden /> : null}
      {pathname.startsWith("/journey") ? <div className="page-backdrop page-backdrop-journey" aria-hidden /> : null}
      <div
        className={cn(
          "page-shell mx-auto flex min-h-dvh flex-col px-4 pb-24 pt-5 md:px-8 md:pb-10",
          ops ? "max-w-7xl" : "max-w-6xl"
        )}
      >
        <Header />
        <LoadError />
        <main className="flex-1 pt-6">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl justify-around px-2 py-2">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-w-[3.25rem] flex-col items-center gap-0.5 px-2 py-1 text-[11px]",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="size-5 stroke-[1.75]" aria-hidden />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </>
  )
}

function LoadError() {
  const { error } = useWorkspace()
  if (!error) return null
  return (
    <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  )
}

function Header() {
  const pathname = usePathname()
  const { snapshot, running, mode } = useWorkspace()
  const [elapsed, setElapsed] = useState(0)
  const showOps = mode === "preview" || snapshot.profile.role === "admin"

  useEffect(() => {
    if (!running) return
    const tick = () => {
      setElapsed((Date.now() - new Date(running.startAt).getTime()) / 1000)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [running])

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 md:gap-3.5">
          <NidaAvatar size={52} />
          <div className="min-w-0">
            <p className="font-heading text-[1.55rem] leading-[1.2] text-foreground sm:text-[1.8rem] md:text-[2.15rem]">
              <span className="block sm:inline">Dr. Nida's MCCQE1</span>
              <span className="block sm:ml-0 sm:inline">
                <span className="hidden sm:inline"> </span>
                Journey
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">From MBBS to Canadian Physician 🇨🇦</p>
          </div>
        </div>
        <nav className="hidden items-center gap-0.5 pt-1 md:flex">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {running ? (
        <Link href="/" className="soft-card flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-foreground">
            Studying {catalogName(snapshot, running.subjectId)}
            <span className="text-muted-foreground"> • live</span>
          </span>
          <span className="tabular font-medium text-primary">{formatDurationClock(elapsed)}</span>
        </Link>
      ) : null}

      {mode === "preview" ? (
        <p className="rounded-xl bg-accent/50 px-3 py-2 text-xs text-accent-foreground">
          Preview mode — add Supabase keys in <code>.env.local</code> for private login and sync.
          {showOps ? (
            <>
              {" "}
              <Link href="/ops" className="underline underline-offset-2">
                Ops dashboard
              </Link>
            </>
          ) : null}
        </p>
      ) : showOps ? (
        <p className="text-xs text-muted-foreground">
          <Link href="/ops" className="underline underline-offset-2">
            Mudasir Dashboard
          </Link>
        </p>
      ) : null}
    </header>
  )
}
