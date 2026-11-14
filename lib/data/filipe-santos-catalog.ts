import catalog from "@/lib/data/filipe-santos-catalog.json"
import type { HighYieldPriority } from "@/lib/types"

export type FilipeSantosCatalogTopic = {
  subject: string
  topic: string
  priority: HighYieldPriority
  sortOrder: number
  catalogKey: string
  meta: {
    allotment: string
    pages: number
    volume: string
    discipline: string
  }
}

export const FILIPE_SANTOS_CATALOG_META = {
  source: catalog.source as string,
  title: catalog.title as string,
  topicCount: (catalog.topics as FilipeSantosCatalogTopic[]).length,
}

export const FILIPE_SANTOS_CATALOG_TOPICS = catalog.topics as FilipeSantosCatalogTopic[]
