"use client"

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

function Empty({ text = "More data needed." }: { text?: string }) {
  return <p className="flex h-36 items-center text-sm text-muted-foreground">{text}</p>
}

const tooltip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid color-mix(in oklch, var(--foreground) 10%, transparent)",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "0 8px 24px rgba(40,30,20,0.06)",
  },
  labelStyle: { color: "var(--muted-foreground)" },
}

function shortDay(d: string) {
  const parts = d.split("-")
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d
}

export function HoursByDayChart({ data }: { data: { date: string; hours: number }[] }) {
  if (!data.some((d) => d.hours > 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={168}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip {...tooltip} formatter={(v) => [`${v}h`, "Hours"]} />
        <Bar dataKey="hours" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function QuestionsByDayChart({ data }: { data: { date: string; questions: number }[] }) {
  if (!data.some((d) => d.questions > 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={168}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip {...tooltip} formatter={(v) => [v, "Questions"]} />
        <Bar dataKey="questions" fill="color-mix(in oklch, var(--color-primary) 70%, var(--foreground))" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function AccuracyLineChart({ data }: { data: { date: string; accuracy: number }[] }) {
  if (data.length < 2) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={168}>
      <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip {...tooltip} formatter={(v) => [`${v}%`, "Accuracy"]} />
        <Line type="monotone" dataKey="accuracy" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ReadinessLineChart({ data }: { data: { date: string; score: number | null }[] }) {
  const rows = data.filter((d) => d.score != null)
  if (rows.length < 2) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={168}>
      <LineChart data={rows} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip {...tooltip} formatter={(v) => [v, "Readiness"]} />
        <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SubjectBars({
  rows,
}: {
  rows: { name: string; value: number }[]
}) {
  if (!rows.length) return <Empty />
  return (
    <div className="space-y-3">
      {rows.slice(0, 8).map((r) => (
        <div key={r.name}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span>{r.name}</span>
            <span className="tabular text-muted-foreground">{Math.round(r.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r.value)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MockLineChart({ data }: { data: { date: string; score: number; name: string }[] }) {
  if (data.length === 0) return <Empty />
  if (data.length === 1) {
    return (
      <p className="text-sm text-muted-foreground">
        {data[0].name} · {data[0].date} · {data[0].score}%
      </p>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={168}>
      <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip {...tooltip} formatter={(v) => [`${v}%`, "Score"]} />
        <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
