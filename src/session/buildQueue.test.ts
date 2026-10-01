import { describe, expect, it } from 'vitest'
import { CardState, type Card } from '../db/types'
import { pickNext, type QueueInput } from './buildQueue'

const MIN = 60_000
const DAY = 24 * 60 * MIN
const now = new Date(2026, 9, 1, 12).getTime()
const endOfDay = new Date(2026, 9, 2, 4).getTime()

let seq = 0
function card(overrides: Partial<Card> = {}): Card {
  seq++
  return {
    id: overrides.id ?? `c${seq}`,
    note_id: overrides.note_id ?? `n${seq}`,
    set_id: 'set1',
    variant: 'forward',
    due: now,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: CardState.New,
    last_review: null,
    is_leech: false,
    created_at: now - 1000 + seq,
    updated_at: now,
    deleted: false,
    ...overrides,
  }
}
const review = (dueOffset: number, o: Partial<Card> = {}) => card({ state: CardState.Review, due: now + dueOffset, ...o })
const learning = (dueOffset: number, o: Partial<Card> = {}) => card({ state: CardState.Learning, due: now + dueOffset, ...o })

function input(cards: Card[], o: Partial<QueueInput> = {}): QueueInput {
  return {
    cards,
    now,
    endOfDay,
    newRemainingBySet: new Map([['set1', 20], ['set2', 20]]),
    newRemainingTotal: 20,
    reviewedToday: [],
    lastCardId: null,
    reviewsSinceNew: 0,
    ...o,
  }
}

describe('pickNext', () => {
  it('returns nothing when there are no cards', () => {
    const r = pickNext(input([]))
    expect(r.card).toBeNull()
    expect(r.remaining).toBe(0)
  })

  it('shows learning cards whose step has elapsed first', () => {
    const l = learning(-MIN)
    const r = pickNext(input([review(-DAY), card(), l]))
    expect(r.card?.id).toBe(l.id)
    expect(r.remaining).toBe(3)
  })

  it('shows the most overdue review first', () => {
    const a = review(-1 * DAY)
    const b = review(-5 * DAY)
    const c = review(2 * 60 * MIN) // later today, still due today
    expect(pickNext(input([a, b, c])).card?.id).toBe(b.id)
  })

  it('does not show reviews due tomorrow or later', () => {
    const r = pickNext(input([review(DAY)]))
    expect(r.card).toBeNull()
  })

  it('spreads new cards between reviews', () => {
    const reviews = [review(-4 * DAY), review(-3 * DAY), review(-2 * DAY), review(-DAY)]
    const fresh = [card(), card()]
    const cards = [...reviews, ...fresh]
    // 4 reviews and 2 new cards: one new card after every 2 reviews.
    expect(pickNext(input(cards, { reviewsSinceNew: 0 })).card?.state).toBe(CardState.Review)
    expect(pickNext(input(cards, { reviewsSinceNew: 1 })).card?.state).toBe(CardState.Review)
    expect(pickNext(input(cards, { reviewsSinceNew: 2 })).card?.id).toBe(fresh[0].id)
  })

  it('introduces new cards in the order they were created', () => {
    const first = card({ created_at: now - 5000 })
    const second = card({ created_at: now - 1000 })
    expect(pickNext(input([second, first])).card?.id).toBe(first.id)
  })

  it('respects the per-set new card limit', () => {
    const cards = [card(), card(), card({ set_id: 'set2' })]
    const r = pickNext(input(cards, { newRemainingBySet: new Map([['set1', 0], ['set2', 5]]) }))
    expect(r.card?.set_id).toBe('set2')
    expect(r.remaining).toBe(1)
    expect(r.newHeldBack).toBe(2)
  })

  it('respects the overall new card limit', () => {
    const cards = Array.from({ length: 30 }, () => card())
    const r = pickNext(input(cards, { newRemainingTotal: 20 }))
    expect(r.remaining).toBe(20)
    expect(r.newHeldBack).toBe(10)
  })

  it('stops new cards when the daily limit is used up', () => {
    const r = pickNext(input([card()], { newRemainingTotal: 0 }))
    expect(r.card).toBeNull()
    expect(r.newHeldBack).toBe(1)
  })

  it('never shows the same card twice in a row when others are available', () => {
    const a = learning(-2 * MIN)
    const b = review(-DAY)
    expect(pickNext(input([a, b], { lastCardId: a.id })).card?.id).toBe(b.id)
  })

  it('repeats a card only when it is the only one left', () => {
    const a = learning(-MIN)
    expect(pickNext(input([a], { lastCardId: a.id })).card?.id).toBe(a.id)
  })

  it('shows a learning card early when nothing else is left', () => {
    const a = learning(5 * MIN)
    const b = learning(8 * MIN)
    const r = pickNext(input([b, a]))
    expect(r.card?.id).toBe(a.id)
    expect(r.remaining).toBe(2)
  })

  it('reports when the next learning card is due if it is too far off', () => {
    const a = learning(60 * MIN)
    const r = pickNext(input([a]))
    expect(r.card).toBeNull()
    expect(r.nextLearningDue).toBe(now + 60 * MIN)
  })

  it('buries siblings of a card already reviewed today', () => {
    const forward = review(-DAY, { id: 'fwd', note_id: 'note1' })
    const reverse = review(-2 * DAY, { id: 'rev', note_id: 'note1' })
    const other = review(-DAY, { note_id: 'note2' })
    const r = pickNext(
      input([forward, reverse, other], { reviewedToday: [{ card_id: 'fwd', note_id: 'note1' }], lastCardId: 'fwd' }),
    )
    expect(r.card?.id).toBe(other.id)
    expect(r.remaining).toBe(2) // the reviewed card itself is not buried
  })

  it('skips deleted cards', () => {
    expect(pickNext(input([review(-DAY, { deleted: true })])).card).toBeNull()
  })
})
