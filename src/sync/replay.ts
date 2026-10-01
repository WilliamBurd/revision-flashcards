// When two devices review the same card while offline, each works out its own
// next due date. After syncing, both have all the review logs, so the card's
// schedule is rebuilt by replaying every rating in order. Both devices run the
// same maths on the same logs, so they end up agreeing.

import type { Card, ReviewLog } from '../db/types'
import { nextExamStart, settingsForExam } from '../scheduler/exams'
import { LEECH_THRESHOLD, makeScheduler, newCardSchedule, rateCard, type SchedulerSettings } from '../scheduler/fsrs'

export type Schedule = ReturnType<typeof newCardSchedule> & { is_leech: boolean }

/** `examDates` are the exam dates for the card's set, so replays follow the same exam rules. */
export function replaySchedule(card: Card, logs: ReviewLog[], settings: SchedulerSettings, examDates: string[] = []): Schedule {
  const counted = logs
    .filter((l) => l.card_id === card.id && !l.deleted && !l.is_cram)
    .sort((a, b) => a.reviewed_at - b.reviewed_at || a.id.localeCompare(b.id))
  let schedule = newCardSchedule(card.created_at)
  let forgotten = 0
  for (const log of counted) {
    const exam = nextExamStart(examDates, log.reviewed_at)
    const scheduler = makeScheduler(settingsForExam(settings, exam, log.reviewed_at))
    schedule = rateCard(schedule, log.rating, log.reviewed_at, scheduler, exam)
    if (log.rating === 1) forgotten++
  }
  return { ...schedule, is_leech: card.is_leech || forgotten >= LEECH_THRESHOLD }
}

const FIELDS: (keyof Schedule)[] = [
  'due',
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'learning_steps',
  'reps',
  'lapses',
  'state',
  'last_review',
  'is_leech',
]

export function sameSchedule(card: Card, schedule: Schedule): boolean {
  return FIELDS.every((f) => card[f] === schedule[f])
}
