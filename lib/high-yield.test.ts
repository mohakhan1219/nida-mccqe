import { describe, expect, it } from "vitest"
import {
  FILIPE_SANTOS_CATALOG,
  FILIPE_SANTOS_SOURCE,
  filterHighYieldTopics,
  mergeFilipeSantosCatalog,
  summarizeHighYield,
} from "@/lib/high-yield"
import type { HighYieldTopic } from "@/lib/types"

describe("Filipe Santos catalog", () => {
  it("ships the extracted PDF topic list", () => {
    expect(FILIPE_SANTOS_CATALOG.length).toBeGreaterThan(500)
    expect(FILIPE_SANTOS_CATALOG.some((t) => t.priority === "very_high")).toBe(true)
    expect(FILIPE_SANTOS_CATALOG.every((t) => t.subject && t.topic && t.catalogKey)).toBe(true)
  })

  it("imports idempotently without overwriting progress", () => {
    const first = mergeFilipeSantosCatalog([])
    expect(first.added).toBe(FILIPE_SANTOS_CATALOG.length)
    const progressed: HighYieldTopic[] = first.topics.map((t, i) =>
      i === 0 ? { ...t, status: "completed", notes: "done by Nida" } : t
    )
    const second = mergeFilipeSantosCatalog(progressed)
    expect(second.added).toBe(0)
    expect(second.topics[0].status).toBe("completed")
    expect(second.topics[0].notes).toBe("done by Nida")
    expect(second.topics[0].source).toBe(FILIPE_SANTOS_SOURCE)
  })

  it("filters by subject and priority", () => {
    const { topics } = mergeFilipeSantosCatalog([])
    const subject = topics[0].subject
    const filtered = filterHighYieldTopics(topics, { subject, priority: "very_high" })
    expect(filtered.every((t) => t.subject === subject && t.priority === "very_high")).toBe(true)
    const summary = summarizeHighYield(topics)
    expect(summary.catalogReady).toBe(true)
    expect(summary.sourceMissing).toBe(false)
  })
})
