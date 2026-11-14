import type { Settings } from "@/lib/types"

/** Official licensing exam is booked only after explicit confirmation. */
export function isOfficialExamBooked(settings: Pick<Settings, "examDate" | "examBookedConfirmed">) {
  return Boolean(settings.examBookedConfirmed && settings.examDate)
}

/** Date used for countdown / readiness — null until confirmed booking. */
export function officialExamDate(settings: Pick<Settings, "examDate" | "examBookedConfirmed">) {
  return isOfficialExamBooked(settings) ? settings.examDate : null
}

/**
 * A date may be saved in settings without being a confirmed official booking
 * (e.g. mistaken practice-exam date). Surface it for a safe correction path.
 */
export function unconfirmedExamDateOnFile(settings: Pick<Settings, "examDate" | "examBookedConfirmed">) {
  if (settings.examBookedConfirmed) return null
  return settings.examDate
}
