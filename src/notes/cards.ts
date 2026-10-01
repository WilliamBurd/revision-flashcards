// Which cards a note makes, and what each card shows.
//
//   basic note   → a 'forward' card, plus a 'reverse' card if make_reverse
//   cloze note   → one card per blank, with variant '1', '2', ...
//
// When a note is edited, its cards keep their schedules. For cloze notes the
// blanks are matched up by their text first, then by position, so fixing one
// blank or adding a new one doesn't move another blank's progress.

import type { Card, Note } from '../db/types'
import { clozeAnswers } from './cloze'

export interface WantedCard {
  variant: string
  /** Stable name for the card within its note, used to make its ID. */
  key: string
}

export function wantedCards(note: Pick<Note, 'type' | 'front' | 'make_reverse'>): WantedCard[] {
  if (note.type === 'cloze') {
    const seen = new Map<string, number>()
    return clozeAnswers(note.front).map((answer, i) => {
      const norm = normalise(answer)
      const n = (seen.get(norm) ?? 0) + 1
      seen.set(norm, n)
      return { variant: String(i + 1), key: `cloze:${norm}#${n}` }
    })
  }
  const out: WantedCard[] = [{ variant: 'forward', key: 'forward' }]
  if (note.make_reverse) out.push({ variant: 'reverse', key: 'reverse' })
  return out
}

const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export interface CardPlan {
  /** Existing cards to keep, with their (possibly renumbered) variant. */
  keep: { card: Card; variant: string }[]
  create: WantedCard[]
  remove: Card[]
}

/**
 * Work out what happens to a note's cards when it changes from `before` to
 * `after`. `existing` is the note's current, non-deleted cards.
 */
export function planCards(
  before: Pick<Note, 'type' | 'front' | 'make_reverse'>,
  after: Pick<Note, 'type' | 'front' | 'make_reverse'>,
  existing: Card[],
): CardPlan {
  const wanted = wantedCards(after)
  if (after.type !== 'cloze') {
    const byVariant = new Map(existing.map((c) => [c.variant, c]))
    const keep = wanted.filter((w) => byVariant.has(w.variant)).map((w) => ({ card: byVariant.get(w.variant)!, variant: w.variant }))
    const kept = new Set(keep.map((k) => k.card.id))
    return {
      keep,
      create: wanted.filter((w) => !byVariant.has(w.variant)),
      remove: existing.filter((c) => !kept.has(c.id)),
    }
  }

  // Cloze: old blank i belongs to the card with variant i.
  const oldAnswers = before.type === 'cloze' ? clozeAnswers(before.front).map(normalise) : []
  const newAnswers = clozeAnswers(after.front).map(normalise)
  const oldCards = oldAnswers.map((answer, i) => ({ answer, index: i, card: existing.find((c) => c.variant === String(i + 1)) }))
  const free = oldCards.filter((o) => o.card)
  const match = new Map<number, Card>() // new blank index → card

  // 1. Same text: pair each new blank with the nearest unused old blank with that text.
  newAnswers.forEach((answer, i) => {
    const same = free.filter((o) => o.answer === answer)
    if (!same.length) return
    const best = same.reduce((a, b) => (Math.abs(b.index - i) < Math.abs(a.index - i) ? b : a))
    match.set(i, best.card!)
    free.splice(free.indexOf(best), 1)
  })
  // 2. Then by position: the remaining new blanks take the remaining old ones in order
  // (a fixed typo keeps its schedule). Only where the old blank was at the same place.
  newAnswers.forEach((_, i) => {
    if (match.has(i)) return
    const at = free.findIndex((o) => o.index === i)
    if (at < 0) return
    match.set(i, free[at].card!)
    free.splice(at, 1)
  })

  const keep = [...match].map(([i, card]) => ({ card, variant: String(i + 1) }))
  const kept = new Set(keep.map((k) => k.card.id))
  return {
    keep,
    create: wanted.filter((_, i) => !match.has(i)),
    remove: existing.filter((c) => !kept.has(c.id)),
  }
}

/**
 * A card ID worked out from its note and key, so two devices that make the
 * same new card while offline give it the same ID instead of making two.
 * (Synchronous on purpose: it runs inside database transactions.)
 */
export function cardIdFor(noteId: string, key: string): string {
  const str = `${noteId}/${key}`
  // cyrb128: a fast 128-bit string hash. It only needs to be repeatable, not secret.
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  const hex = [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('')
  // Shape it as a UUID (version 8, "custom"), which the cloud database expects.
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export interface CardSides {
  /** Text for the question side. */
  question: string
  /** Text shown under the line after revealing ('' for a cloze card with no extra). */
  answer: string
  /** For cloze cards: which blank this card hides (1-based). */
  cloze: number | null
}

/** What a card shows, from its note. */
export function cardSides(note: Pick<Note, 'type' | 'front' | 'back'>, card: Pick<Card, 'variant'>): CardSides {
  if (note.type === 'cloze') return { question: note.front, answer: note.back, cloze: Number(card.variant) || 1 }
  if (card.variant === 'reverse') return { question: note.back, answer: note.front, cloze: null }
  return { question: note.front, answer: note.back, cloze: null }
}
