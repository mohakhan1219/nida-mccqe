import type { BackupFile, WorkspaceSnapshot } from "@/lib/types"
import { DEFAULT_CATALOGS, DEFAULT_COURSES, DEFAULT_SETTINGS, defaultQuotes } from "@/lib/catalogs"

export function snapshotToBackup(snapshot: WorkspaceSnapshot): BackupFile {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    snapshot: {
      workspaceName: "Dr. Nida Medical OS",
      settings: snapshot.settings,
      catalogs: snapshot.catalogs,
      sessions: snapshot.sessions,
      blocks: snapshot.blocks,
      tests: snapshot.tests,
      reviews: snapshot.reviews,
      courses: snapshot.courses,
      schedule: snapshot.schedule,
      quotes: snapshot.quotes,
    },
  }
}

export function backupToPartial(file: BackupFile): Omit<WorkspaceSnapshot, "profile" | "workspaceId"> {
  const s = file.snapshot
  return {
    settings: { ...DEFAULT_SETTINGS, ...s.settings },
    catalogs: s.catalogs?.length ? s.catalogs : DEFAULT_CATALOGS,
    sessions: s.sessions ?? [],
    blocks: s.blocks ?? [],
    tests: s.tests ?? [],
    reviews: s.reviews ?? [],
    courses: s.courses?.length ? s.courses : DEFAULT_COURSES,
    schedule: s.schedule ?? [],
    quotes: s.quotes?.length ? s.quotes : defaultQuotes(),
  }
}
