import type { MotivationMessage } from "@/lib/types"
import type { DerivedStats } from "@/lib/stats"
import { quoteIndexForDay } from "@/lib/dates"

export type QuoteContext = {
  studiedToday: boolean
  streak: number
  weekHoursMet: boolean
  weekQuestionsMet: boolean
  weakAccuracy: boolean
  improving: boolean
  firstSession: boolean
}

export function quoteContext(stats: DerivedStats, weeklyHourGoal: number, weeklyQuestionGoal: number): QuoteContext {
  return {
    studiedToday: stats.todayHours > 0 || stats.todayQuestions > 0,
    streak: stats.rhythm.streak,
    weekHoursMet: weeklyHourGoal > 0 && stats.week.hours >= weeklyHourGoal,
    weekQuestionsMet: weeklyQuestionGoal > 0 && stats.week.questions >= weeklyQuestionGoal,
    weakAccuracy: stats.todayAccuracy != null && stats.todayAccuracy < 0.65,
    improving: stats.trend === "up",
    firstSession: stats.rhythm.lastStudyDate == null,
  }
}

function preferredTheme(ctx: QuoteContext): string {
  if (ctx.firstSession) return "milestones"
  if (!ctx.studiedToday) return "discipline"
  if (ctx.weakAccuracy) return "weak-subjects"
  if (ctx.weekHoursMet || ctx.weekQuestionsMet) return "milestones"
  if (ctx.streak >= 3) return "consistency"
  if (ctx.improving) return "confidence"
  return "medicine"
}

export function selectDailyQuote(
  quotes: MotivationMessage[],
  day: string,
  ctx: QuoteContext
): MotivationMessage | undefined {
  if (!quotes.length) return undefined
  const theme = preferredTheme(ctx)
  const pool = quotes.filter((q) => q.theme === theme)
  const list = pool.length ? pool : quotes
  const salt = theme.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  const i = (quoteIndexForDay(day, 10_007) + salt) % list.length
  return list[i] ?? list[0]
}
