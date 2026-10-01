// Exam dates and scheduling (doc section 3.5).
//
// Each subject can have exam dates; a set can override them with its own.
// While an exam is coming up:
//   - no card is scheduled after it: anything that would come back later is
//     brought forward to the day before, which also means every card comes
//     up at least once in the final week;
//   - in the final 14 days, target retention rises to 95% (more reviews).
// Once an exam has started, the next one applies; with none left, scheduling
// goes back to normal.

import type { CardSet, ExamDate, Subject } from '../db/types'
import { DAY_START_HOUR } from '../lib/day'
import type { SchedulerSettings } from './fsrs'

const DAY_MS = 24 * 60 * 60 * 1000
export const EXAM_BOOST_DAYS = 14
export const EXAM_RETENTION = 0.95

/** The exam dates that apply to cards in this set. */
export function examDatesFor(subject: Pick<Subject, 'exam_dates'> | undefined, set: Pick<CardSet, 'exam_date_override'> | undefined): string[] {
  if (set?.exam_date_override) return [set.exam_date_override]
  return (subject?.exam_dates ?? []).map((e) => e.date)
}

/** When an exam's study day starts (4am local), from "YYYY-MM-DD". */
export function examStart(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, DAY_START_HOUR).getTime()
}

/** Start of the next exam still to come, or null. */
export function nextExamStart(dates: string[], now: number): number | null {
  const upcoming = dates
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .map(examStart)
    .filter((t) => t > now)
  return upcoming.length ? Math.min(...upcoming) : null
}

/** The next exam (with its name) for a subject's countdown on Home. */
export function nextExam(exams: ExamDate[], now: number): (ExamDate & { start: number }) | null {
  const upcoming = exams.map((e) => ({ ...e, start: examStart(e.date) })).filter((e) => e.start > now)
  upcoming.sort((a, b) => a.start - b.start)
  return upcoming[0] ?? null
}

/** Whole days from today until an exam (0 on the day itself). */
export function daysUntil(start: number, now: number): number {
  const today = new Date(now)
  today.setHours(DAY_START_HOUR, 0, 0, 0)
  if (new Date(now).getHours() < DAY_START_HOUR) today.setDate(today.getDate() - 1)
  return Math.round((start - today.getTime()) / DAY_MS)
}

/** Settings with target retention raised in the run-up to an exam. */
export function settingsForExam<T extends SchedulerSettings>(settings: T, exam: number | null, now: number): T {
  if (exam === null || exam - now > EXAM_BOOST_DAYS * DAY_MS) return settings
  return { ...settings, target_retention: Math.max(settings.target_retention, EXAM_RETENTION) }
}

/** The latest a card may be due so that it comes up before the exam. */
export function latestBeforeExam(exam: number, now: number): number {
  const dayBefore = exam - DAY_MS
  // On the eve of the exam, "the day before" has passed; anything later today is fine.
  return dayBefore > now ? dayBefore : exam - 60_000
}
