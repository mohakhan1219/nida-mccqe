"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"

const TICK = { fontSize: 11, fill: "#6f675e" }
const GRID = { stroke: "rgba(70, 58, 42, 0.10)", strokeDasharray: "3 6" }

const tooltip = {
  contentStyle: {
    background: "#fbf8f3",
    border: "1px solid rgba(70, 58, 42, 0.12)",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "0 8px 24px rgba(40,30,20,0.06)",
    color: "#3f3a34",
  },
  labelStyle: { color: "#6f675e" },
  itemStyle: { color: "#3f3a34" },
}

function Empty({ text = "More data needed.", compact = false }: { text?: string; compact?: boolean }) {
  return (
    <p className={compact ? "py-1 text-sm text-muted-foreground" : "flex h-28 items-center text-sm text-muted-foreground"}>
      {text}
    </p>
  )
}

function shortDay(d: string) {
  const parts = d.split("-")
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d
}

export type MiniChartProps = {
  height?: number
  compactEmpty?: boolean
}

export function HoursByDayChart({
  data,
  height = 168,
  compactEmpty = false,
}: { data: { date: string; hours: number }[] } & MiniChartProps) {
  if (!data.some((d) => d.hours > 0)) return <Empty compact={compactEmpty} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 2 }}>
        <CartesianGrid vertical={false} {...GRID} />
        <XAxis dataKey="date" tickFormatter={shortDay} tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <Tooltip {...tooltip} formatter={(v) => [`${v}h`, "Hours"]} />
        <Bar dataKey="hours" fill="#5c4a8a" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function QuestionsByDayChart({
  data,
  height = 168,
  compactEmpty = false,
}: { data: { date: string; questions: number }[] } & MiniChartProps) {
  if (!data.some((d) => d.questions > 0)) return <Empty compact={compactEmpty} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 2 }}>
        <CartesianGrid vertical={false} {...GRID} />
        <XAxis dataKey="date" tickFormatter={shortDay} tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <Tooltip {...tooltip} formatter={(v) => [v, "Questions"]} />
        <Bar dataKey="questions" fill="#7a679e" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function AccuracyLineChart({
  data,
  height = 168,
  compactEmpty = false,
}: { data: { date: string; accuracy: number }[] } & MiniChartProps) {
  if (data.length < 2) return <Empty compact={compactEmpty} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 10, left: 4, bottom: 2 }}>
        <CartesianGrid vertical={false} {...GRID} />
        <XAxis dataKey="date" tickFormatter={shortDay} tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <Tooltip {...tooltip} formatter={(v) => [`${v}%`, "Accuracy"]} />
        <Line type="monotone" dataKey="accuracy" stroke="#5c4a8a" strokeWidth={2} dot={{ r: 3, fill: "#5c4a8a" }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ReadinessLineChart({
  data,
  height = 168,
  compactEmpty = false,
}: { data: { date: string; score: number | null }[] } & MiniChartProps) {
  const rows = data.filter((d) => d.score != null)
  if (rows.length < 2) return <Empty compact={compactEmpty} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 10, left: 4, bottom: 2 }}>
        <CartesianGrid vertical={false} {...GRID} />
        <XAxis dataKey="date" tickFormatter={shortDay} tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <Tooltip {...tooltip} formatter={(v) => [v, "Readiness"]} />
        <Line type="monotone" dataKey="score" stroke="#5c4a8a" strokeWidth={2} dot={{ r: 3, fill: "#5c4a8a" }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SubjectBars({
  rows,
}: {
  rows: { name: string; value: number }[]
}) {
  if (!rows.length) return <Empty text="Subject health appears after named study on a subject." />
  return (
    <div className="space-y-3">
      {rows.slice(0, 8).map((r) => (
        <div key={r.name}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span>{r.name}</span>
            <span className="tabular text-muted-foreground">{Math.round(r.value)} / 100</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r.value)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MockLineChart({
  data,
  height = 168,
  compactEmpty = false,
}: { data: { date: string; score: number; name: string }[] } & MiniChartProps) {
  if (data.length === 0) return <Empty compact={compactEmpty} />
  if (data.length === 1) {
    return (
      <p className="text-sm text-muted-foreground">
        {data[0].name} · {data[0].date} · {data[0].score}%
      </p>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 10, left: 4, bottom: 2 }}>
        <CartesianGrid vertical={false} {...GRID} />
        <XAxis dataKey="date" tickFormatter={shortDay} tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <Tooltip {...tooltip} formatter={(v) => [`${v}%`, "Score"]} />
        <Line type="monotone" dataKey="score" stroke="#5c4a8a" strokeWidth={2} dot={{ r: 3, fill: "#5c4a8a" }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
