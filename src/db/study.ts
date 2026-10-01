// Reading and writing study progress: due counts, today's new-card budget,
// loading a review session, and saving each rating.

import { dayKey, dayStart, nextDayStart } from '../lib/day'
import { newId } from '../lib/ids'
import { examDatesFor, latestBeforeExam, nextExamStart, settingsForExam } from '../scheduler/exams'
import { LEECH_THRESHOLD, makeScheduler, previewIntervals, rateCard } from '../scheduler/fsrs'
import type { QueueInput } from '../session/buildQueue'
import { db } from './db'
import { getSettings, updateSettings } from './settings'
import { listSets } from './subjects'
import { CardState, type Card, type CardSet, type Rating, type ReviewLog, type Settings } from './types'

export type Scope = { kind: 'all' } | { kind: 'subject'; id: string } | { kind: 'set'; id: string }

export interface SetCounts {
  total: number
  /** Learning cards due now plus review cards due today. */
  due: number
  /** New cards not yet studied. */
  new: number
  /** New cards that can still be introduced today in this set. */
  newToday: number
  /** Studied, but not yet on a 3-week-plus interval. */
  learning: number
  /** On an interval of 3 weeks or more. */
  known: number
}

/** A card counts as "known" once its interval reaches this many days. */
export const KNOWN_INTERVAL_DAYS = 21

interface Budget {
  newRemainingBySet: Map<string, number>
  newRemainingBySubject: Map<string, number>
  subjectOfSet: Map<string, string>
}

function extraToday(settings: Settings, now: number): number {
  return settings.extra_new_cards.day === dayKey(now) ? settings.extra_new_cards.count : 0
}

async function todaysLogs(now: number): Promise<ReviewLog[]> {
  const logs = await db.review_logs.where('reviewed_at').aboveOrEqual(dayStart(now)).toArray()
  return logs.filter((l) => !l.deleted && !l.is_cram)
}

/**
 * How many new cards are still allowed today, per set and per subject. Each
 * subject has its own daily limit, so studying History first never uses up
 * Politics' new cards.
 */
function newBudget(settings: Settings, sets: CardSet[], logs: ReviewLog[], cardSet: Map<string, string>, now: number): Budget {
  const extra = extraToday(settings, now)
  const subjectOfSet = new Map(sets.map((s) => [s.id, s.subject_id]))
  const introducedBySet = new Map<string, number>()
  const introducedBySubject = new Map<string, number>()
  for (const log of logs) {
    if (log.state_before !== CardState.New) continue
    const setId = cardSet.get(log.card_id)
    if (!setId) continue
    introducedBySet.set(setId, (introducedBySet.get(setId) ?? 0) + 1)
    const subjectId = subjectOfSet.get(setId)
    if (subjectId) introducedBySubject.set(subjectId, (introducedBySubject.get(subjectId) ?? 0) + 1)
  }
  const newRemainingBySet = new Map<string, number>()
  const newRemainingBySubject = new Map<string, number>()
  for (const set of sets) {
    newRemainingBySet.set(set.id, Math.max(0, set.new_cards_per_day + extra - (introducedBySet.get(set.id) ?? 0)))
    if (!newRemainingBySubject.has(set.subject_id)) {
      const used = introducedBySubject.get(set.subject_id) ?? 0
      newRemainingBySubject.set(set.subject_id, Math.max(0, settings.new_cards_per_day_total + extra - used))
    }
  }
  return { newRemainingBySet, newRemainingBySubject, subjectOfSet }
}

/**
 * Every card not deleted. A card due after its next exam counts as due the
 * day before instead, so cards scheduled before an exam date was added still
 * come up in time.
 */
export async function liveCards(now: number): Promise<Card[]> {
  const [cards, sets, subjects] = await Promise.all([db.cards.toArray(), db.sets.toArray(), db.subjects.toArray()])
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const latestBySet = new Map<string, number>()
  for (const set of sets) {
    const exam = nextExamStart(examDatesFor(subjectById.get(set.subject_id), set), now)
    if (exam !== null) latestBySet.set(set.id, latestBeforeExam(exam, now))
  }
  return cards
    .filter((c) => !c.deleted)
    .map((c) => {
      const latest = latestBySet.get(c.set_id)
      return latest !== undefined && c.state !== CardState.New && c.due > latest ? { ...c, due: latest } : c
    })
}

export interface StudyOverview {
  bySet: Map<string, SetCounts>
  /** New cards still allowed today in each subject. */
  newRemainingBySubject: Map<string, number>
  subjectOfSet: Map<string, string>
}

/** Counts for every set, for the home screen and set pages. */
export async function getOverview(now = Date.now()): Promise<StudyOverview> {
  const [settings, sets, cards, logs] = await Promise.all([getSettings(), listSets(), liveCards(now), todaysLogs(now)])
  const cardSet = new Map(cards.map((c) => [c.id, c.set_id]))
  const budget = newBudget(settings, sets, logs, cardSet, now)
  const endOfDay = nextDayStart(now)

  const bySet = new Map<string, SetCounts>()
  for (const set of sets) bySet.set(set.id, { total: 0, due: 0, new: 0, newToday: 0, learning: 0, known: 0 })
  for (const card of cards) {
    const counts = bySet.get(card.set_id)
    if (!counts) continue
    counts.total++
    if (card.state === CardState.New) counts.new++
    else if (card.state === CardState.Review && card.scheduled_days >= KNOWN_INTERVAL_DAYS) counts.known++
    else counts.learning++
    if (card.state === CardState.New) continue
    if (card.state === CardState.Review ? card.due < endOfDay : card.due <= now) counts.due++
  }
  for (const [setId, counts] of bySet) {
    const subjectLeft = budget.newRemainingBySubject.get(budget.subjectOfSet.get(setId) ?? '') ?? 0
    counts.newToday = Math.min(counts.new, budget.newRemainingBySet.get(setId) ?? 0, subjectLeft)
  }
  return { bySet, newRemainingBySubject: budget.newRemainingBySubject, subjectOfSet: budget.subjectOfSet }
}

/** Cards ready to study now in a scope: due cards plus today's new cards. */
export function readyCount(overview: StudyOverview, setIds: string[]): { due: number; newToday: number } {
  let due = 0
  const newBySubject = new Map<string, number>()
  for (const id of setIds) {
    const c = overview.bySet.get(id)
    if (!c) continue
    due += c.due
    const subject = overview.subjectOfSet.get(id) ?? ''
    newBySubject.set(subject, (newBySubject.get(subject) ?? 0) + c.newToday)
  }
  // Sets in one subject share that subject's daily limit.
  let newToday = 0
  for (const [subject, n] of newBySubject) newToday += Math.min(n, overview.newRemainingBySubject.get(subject) ?? 0)
  return { due, newToday }
}

export async function setIdsInScope(scope: Scope): Promise<string[]> {
  const sets = await listSets()
  if (scope.kind === 'set') return sets.some((s) => s.id === scope.id) ? [scope.id] : []
  if (scope.kind === 'subject') return sets.filter((s) => s.subject_id === scope.id).map((s) => s.id)
  return sets.map((s) => s.id)
}

/** Everything the session queue needs, read fresh from the database. */
export async function loadQueueInput(
  scope: Scope,
  session: Pick<QueueInput, 'lastCardId' | 'reviewsSinceNew'>,
  now = Date.now(),
): Promise<QueueInput> {
  const [settings, sets, cards, logs, setIds] = await Promise.all([
    getSettings(),
    listSets(),
    liveCards(now),
    todaysLogs(now),
    setIdsInScope(scope),
  ])
  const inScope = new Set(setIds)
  const cardById = new Map(cards.map((c) => [c.id, c]))
  const budget = newBudget(settings, sets, logs, new Map(cards.map((c) => [c.id, c.set_id])), now)
  return {
    cards: cards.filter((c) => inScope.has(c.set_id)),
    now,
    endOfDay: nextDayStart(now),
    ...budget,
    reviewedToday: logs.flatMap((l) => {
      const card = cardById.get(l.card_id)
      return card ? [{ card_id: card.id, note_id: card.note_id }] : []
    }),
    ...session,
  }
}

/** The scheduler for a card right now: its exam (if any) and the settings that apply. */
async function schedulingFor(card: Card, now: number) {
  const settings = await getSettings()
  const set = await db.sets.get(card.set_id)
  const subject = set ? await db.subjects.get(set.subject_id) : undefined
  const exam = nextExamStart(examDatesFor(subject, set), now)
  return { scheduler: makeScheduler(settingsForExam(settings, exam, now)), exam }
}

/** When each button would bring this card back, for the labels under the buttons. */
export async function intervalsFor(card: Card, now = Date.now()) {
  const { scheduler, exam } = await schedulingFor(card, now)
  return previewIntervals(card, now, scheduler, exam)
}

export interface ReviewResult {
  card: Card
  /** The card as it was before, so the rating can be undone. */
  before: Card
  logId: string
}

/**
 * Save a rating straight away: the card's new schedule and a review log entry
 * are written together, so an interrupted session loses nothing.
 * A cram rating is logged but leaves the card's schedule alone.
 */
export async function recordReview(
  cardId: string,
  rating: Rating,
  durationMs: number,
  now = Date.now(),
  options: { cram?: boolean } = {},
): Promise<ReviewResult> {
  const card0 = await db.cards.get(cardId)
  if (!card0) throw new Error('Card not found')
  const { scheduler, exam } = await schedulingFor(card0, now)
  return db.transaction('rw', db.cards, db.review_logs, async () => {
    const card = await db.cards.get(cardId)
    if (!card) throw new Error('Card not found')
    const log: ReviewLog = {
      id: newId(),
      card_id: cardId,
      rating,
      state_before: card.state,
      reviewed_at: now,
      duration_ms: Math.round(durationMs),
      is_cram: !!options.cram,
      created_at: now,
      updated_at: now,
      deleted: false,
    }
    await db.review_logs.add(log)
    if (options.cram) return { card, before: card, logId: log.id }
    const forgotten = await db.review_logs
      .where('card_id')
      .equals(cardId)
      .filter((l) => l.rating === 1 && !l.is_cram && !l.deleted)
      .count()
    const updated: Card = {
      ...card,
      ...rateCard(card, rating, now, scheduler, exam),
      is_leech: card.is_leech || forgotten >= LEECH_THRESHOLD,
      updated_at: now,
    }
    await db.cards.put(updated)
    return { card: updated, before: card, logId: log.id }
  })
}

const SCHEDULE_FIELDS = [
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
] as const

/**
 * Undo a rating: its log entry is deleted (so it syncs as deleted and is left
 * out of any replay) and the card's schedule goes back to how it was.
 */
export async function undoReview(result: ReviewResult, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.cards, db.review_logs, async () => {
    await db.review_logs.update(result.logId, { deleted: true, updated_at: now })
    const log = await db.review_logs.get(result.logId)
    if (log?.is_cram) return
    const restore: Partial<Card> = { updated_at: now }
    for (const f of SCHEDULE_FIELDS) (restore as Record<string, unknown>)[f] = result.before[f]
    await db.cards.update(result.before.id, restore)
  })
}

/** "Learn more new cards": raise today's new-card limits by `count`. */
export async function allowMoreNewCards(count: number, now = Date.now()): Promise<void> {
  const settings = await getSettings()
  await updateSettings({ extra_new_cards: { day: dayKey(now), count: extraToday(settings, now) + count } })
}
