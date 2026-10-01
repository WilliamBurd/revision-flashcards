// Thin wrapper round ts-fsrs, so the rest of the app never touches the
// library directly and always uses the settings from the doc:
// 90% target retention, 45-day maximum interval, learning steps 1m then 10m,
// relearning step 10m, and fuzz so cards added together spread out.

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card as FsrsCard,
  type FSRS,
  type Grade,
  type Steps,
} from 'ts-fsrs'
import type { Card, CardState, Rating } from '../db/types'
import { formatInterval } from './formatInterval'

export interface SchedulerSettings {
  target_retention: number
  max_interval_days: number
  learning_steps: string[]
  relearning_steps: string[]
}

export const DEFAULT_SCHEDULER_SETTINGS: SchedulerSettings = {
  target_retention: 0.9,
  max_interval_days: 45,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
}

/** The four buttons, in order. Ratings 1-4 map to FSRS Again, Hard, Good, Easy. */
export const RATINGS: { rating: Rating; label: string }[] = [
  { rating: 1, label: 'No Idea' },
  { rating: 2, label: 'Barely' },
  { rating: 3, label: 'Kind Of' },
  { rating: 4, label: 'Confident' },
]

/** A card rated "No Idea" this many times in total is flagged as a leech. */
export const LEECH_THRESHOLD = 6

export function makeScheduler(settings: SchedulerSettings = DEFAULT_SCHEDULER_SETTINGS): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: settings.target_retention,
      maximum_interval: settings.max_interval_days,
      enable_fuzz: true,
      enable_short_term: true,
      learning_steps: settings.learning_steps as Steps,
      relearning_steps: settings.relearning_steps as Steps,
    }),
  )
}

/** The FSRS fields for a brand-new card. */
export function newCardSchedule(now: number) {
  return fromFsrsCard(createEmptyCard(new Date(now)))
}

type ScheduleFields = Pick<
  Card,
  | 'due'
  | 'stability'
  | 'difficulty'
  | 'elapsed_days'
  | 'scheduled_days'
  | 'learning_steps'
  | 'reps'
  | 'lapses'
  | 'state'
  | 'last_review'
>

function toFsrsCard(card: ScheduleFields): FsrsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review === null ? undefined : new Date(card.last_review),
  }
}

function fromFsrsCard(c: FsrsCard): ScheduleFields {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as CardState,
    last_review: c.last_review ? c.last_review.getTime() : null,
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * ts-fsrs can go a day or two past the maximum interval (it keeps "Confident"
 * longer than "Kind Of" even at the cap), so enforce the cap here.
 */
function capInterval(c: FsrsCard, now: number, maxDays: number): FsrsCard {
  if (c.scheduled_days <= maxDays) return c
  return { ...c, scheduled_days: maxDays, due: new Date(now + maxDays * DAY_MS) }
}

/** When each button would bring the card back, for the labels under the buttons. */
export function previewIntervals(
  card: ScheduleFields,
  now: number,
  scheduler: FSRS = makeScheduler(),
): Record<Rating, { due: number; label: string }> {
  const preview = scheduler.repeat(toFsrsCard(card), new Date(now))
  const out = {} as Record<Rating, { due: number; label: string }>
  for (const { rating } of RATINGS) {
    const capped = capInterval(preview[rating as Grade].card, now, scheduler.parameters.maximum_interval)
    const due = capped.due.getTime()
    out[rating] = { due, label: formatInterval(due - now) }
  }
  return out
}

/**
 * Apply a rating. Returns the card's new schedule fields; the caller saves
 * them (and the review log) straight away.
 */
export function rateCard(
  card: ScheduleFields,
  rating: Rating,
  now: number,
  scheduler: FSRS = makeScheduler(),
): ScheduleFields {
  const result = scheduler.next(toFsrsCard(card), new Date(now), rating as Grade)
  return fromFsrsCard(capInterval(result.card, now, scheduler.parameters.maximum_interval))
}
