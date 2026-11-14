"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type {
  CatalogItem,
  Course,
  HighYieldTopic,
  IncorrectReview,
  PracticeAssessment,
  QBankSnapshot,
  QuestionBlock,
  ScheduleEvent,
  Settings,
  StudySession,
  TestMock,
  WorkspaceSnapshot,
} from "@/lib/types"
import { mergeFilipeSantosCatalog } from "@/lib/high-yield"
import { scorePctFromTotals } from "@/lib/practice-assessments"
import {
  DEFAULT_CATALOGS,
  DEFAULT_COURSES,
  DEFAULT_SETTINGS,
  defaultQuotes,
  emptySnapshot,
} from "@/lib/catalogs"
import { applyAbziSeedToSnapshot, normalizeScheduleEvent } from "@/lib/abzi-schedule"
import { backupToPartial, snapshotToBackup } from "@/lib/backup"
import { durationMinutes, nowIso } from "@/lib/dates"
import { computeExamPlanning, withSuggestedExamTarget } from "@/lib/exam-planning"
import { newId } from "@/lib/format"
import { countsValid } from "@/lib/metrics"
import {
  reconcilePausedSession,
  withPauseStarted,
  withResume,
  withSessionEnded,
} from "@/lib/session-pause"
import { studyCreditMinutes } from "@/lib/session-pause"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/browser"
import { deriveStats, runningSession } from "@/lib/stats"
import { computeReadiness } from "@/lib/readiness"
import type { BackupFile } from "@/lib/types"

const LOCAL_KEY = "nida-medical-os-preview-v1"

type SaveBlockInput = {
  subjectId: string
  sourceId: string
  assessmentTypeId: string
  topic?: string
  startAt: string
  endAt: string
  total: number
  correct: number
  incorrect: number
  skipped: number
  timedMode?: QuestionBlock["timedMode"]
  attemptState?: QuestionBlock["attemptState"]
  notes?: string
  countAsStudySession: boolean
  sendIncorrectsToReview: boolean
  kind: "block" | "test"
  testName?: string
  /** Optional link from a Friday ABZI event to this assessment. */
  scheduleEventId?: string
}

type Ctx = {
  mode: "cloud" | "preview"
  configured: boolean
  loading: boolean
  error: string | null
  snapshot: WorkspaceSnapshot
  stats: ReturnType<typeof deriveStats>
  readiness: ReturnType<typeof computeReadiness>
  running: StudySession | null
  refresh: () => Promise<void>
  punchIn: (input: {
    subjectId: string
    sourceId: string
    activityId: string
    topic?: string
  }) => Promise<void>
  punchOut: (input?: { endAt?: string; notes?: string; topic?: string }) => Promise<void>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  confirmStillStudying: () => Promise<void>
  discardRunning: () => Promise<void>
  saveQBankSnapshot: (row: Omit<QBankSnapshot, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<void>
  deleteQBankSnapshot: (id: string) => Promise<void>
  upsertHighYieldTopic: (row: HighYieldTopic) => Promise<void>
  deleteHighYieldTopic: (id: string) => Promise<void>
  ensureHighYieldCatalogImported: () => Promise<{ added: number; updatedMeta: number }>
  upsertPracticeAssessment: (row: PracticeAssessment) => Promise<void>
  completePracticeAssessment: (
    id: string,
    results: {
      completedDate: string
      total: number
      correct: number
      incorrect: number
      scorePct?: number | null
      notes?: string
    }
  ) => Promise<void>
  deletePracticeAssessment: (id: string) => Promise<void>
  confirmOfficialExamBooking: (examDate: string) => Promise<void>
  clearMistakenExamDate: () => Promise<void>
  resetSuggestedExamTarget: () => Promise<void>
  saveManualSession: (input: {
    subjectId: string
    sourceId: string
    activityId: string
    topic?: string
    startAt: string
    endAt: string
    notes?: string
  }) => Promise<void>
  saveAssessment: (input: SaveBlockInput) => Promise<void>
  updateSession: (row: StudySession) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  updateBlock: (row: QuestionBlock) => Promise<void>
  deleteBlock: (id: string) => Promise<void>