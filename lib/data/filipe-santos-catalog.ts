import meta from "@/lib/data/filipe-santos-catalog-meta.json"
import part1 from "@/lib/data/filipe-santos-catalog-part1.json"
import part2 from "@/lib/data/filipe-santos-catalog-part2.json"

export const FILIPE_SANTOS_CATALOG_META = meta as {
  source: string
  title: string
}

export const FILIPE_SANTOS_CATALOG_TOPICS = [...part1, ...part2] as Array<{
  subject: string
  topic: string
  priority: "very_high" | "high" | "medium" | "low"
  sortOrder: number
  catalogKey: string
  meta?: Record<string, unknown>
}>
