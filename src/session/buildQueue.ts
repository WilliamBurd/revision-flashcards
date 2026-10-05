// Decides which card comes next in a review session (doc section 4.2).
//
// This is a pure function: give it the cards in the session's scope and what
// has happened so far, and it returns the next card. The review screen calls
// it again after every rating, with fresh data from the database, so the
// order always reflects the latest schedule.

import { CardState, type Card } from '../db/types'

/** If only learning cards are left, show ones due within this window early. */
export const LEARN_AHEAD_MS = 20 * 60_000

export interface QueueInput {
  /** Every non-deleted card in the session's scope. */
  cards: Card[]
  now: number
  /** Start of the next study day: review cards due before this are due today. */
  endOfDay: number
  /** How many more new cards may be introduced today, per set. */
  newRemainingBySet: Map<string, number>
  /** How many more new cards may be introduced today in each topic. */
  newRemainingByTopic: Map<string, number>
  /** Which topic each set counts towards. */
  topicOfSet: Map<string, string>
  /** Cards already reviewed today, so their siblings can be buried. */
  reviewedToday: { card_id: string; note_id: string }[]
  /** The card shown just before, which must not be shown again straight away. */
  lastCardId: string | null
  /** Reviews shown since the last new card, used to spread new cards out. */
  reviewsSinceNew: number
}

export interface QueueResult {
  card: Card | null
  /** Cards still to see now (including the one returned). */
  remaining: number
  /** If nothing is ready, when the next learning card becomes due today. */
  nextLearningDue: number | null
  /** New cards that exist but are held back by today's limit. */
  newHeldBack: number
}

const isLearning = (c: Card) => c.state === CardState.Learning || c.state === CardState.Relearning

export function pickNext(input: QueueInput): QueueResult {
  const { now, endOfDay, lastCardId } = input

  // Bury siblings: a card whose note already had a *different* card reviewed
  // today waits until tomorrow.
  const reviewedByNote = new Map<string, Set<string>>()
  for (const r of input.reviewedToday) {
    if (!reviewedByNote.has(r.note_id)) reviewedByNote.set(r.note_id, new Set())
    reviewedByNote.get(r.note_id)!.add(r.card_id)
  }
  const buried = (c: Card) => {
    const seen = reviewedByNote.get(c.note_id)
    return seen !== undefined && !seen.has(c.id)
  }
  const cards = input.cards.filter((c) => !c.deleted && !buried(c))

  const learningDue = cards
    .filter((c) => isLearning(c) && c.due <= now)
    .sort((a, b) => a.due - b.due)
  const reviewsDue = cards
    .filter((c) => c.state === CardState.Review && c.due < endOfDay)
    .sort((a, b) => a.due - b.due) // most overdue first

  // New cards, oldest first, within the per-set and per-topic limits.
  const allNew = cards
    .filter((c) => c.state === CardState.New)
    .sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id))
  const budget = new Map(input.newRemainingBySet)
  const topicBudget = new Map(input.newRemainingByTopic)
  const newAllowed: Card[] = []
  for (const c of allNew) {
    const setLeft = budget.get(c.set_id) ?? 0
    const topic = input.topicOfSet.get(c.set_id) ?? ''
    const topicLeft = topicBudget.get(topic) ?? 0
    if (topicLeft > 0 && setLeft > 0) {
      newAllowed.push(c)
      budget.set(c.set_id, setLeft - 1)
      topicBudget.set(topic, topicLeft - 1)
    }
  }
  const newHeldBack = allNew.length - newAllowed.length

  // Learning cards due soon, shown early if nothing else is left.
  const learningSoon = cards
    .filter((c) => isLearning(c) && c.due > now && c.due <= now + LEARN_AHEAD_MS && c.due < endOfDay)
    .sort((a, b) => a.due - b.due)
  const nextLearning = cards
    .filter((c) => isLearning(c) && c.due > now && c.due < endOfDay)
    .reduce<number | null>((min, c) => (min === null || c.due < min ? c.due : min), null)

  const readyNow = learningDue.length + reviewsDue.length + newAllowed.length
  // When only learning cards are left, they are shown early and count as remaining.
  const remaining = readyNow || learningSoon.length
  const notLast = (list: Card[]) => list.filter((c) => c.id !== lastCardId)

  const choose = (): Card | null => {
    // 1. Learning and relearning cards whose step has elapsed.
    const learning = notLast(learningDue)
    if (learning.length) return learning[0]

    // 2 and 3. Reviews, with new cards spread evenly between them.
    const reviews = notLast(reviewsDue)
    const fresh = notLast(newAllowed)
    if (reviews.length && fresh.length) {
      const gap = Math.max(1, Math.floor(reviews.length / fresh.length))
      return input.reviewsSinceNew >= gap ? fresh[0] : reviews[0]
    }
    if (reviews.length) return reviews[0]
    if (fresh.length) return fresh[0]

    // Nothing else is ready: show a learning card a little early.
    const soon = notLast(learningSoon)
    if (soon.length) return soon[0]

    // 4. The same card twice in a row only if it's the only card left.
    const all = [...learningDue, ...reviewsDue, ...newAllowed, ...learningSoon]
    return all.length ? all[0] : null
  }

  const card = choose()
  return {
    card,
    remaining,
    nextLearningDue: card ? null : nextLearning,
    newHeldBack,
  }
}
