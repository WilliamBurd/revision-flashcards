import { describe, expect, it } from 'vitest'
import type { Card } from '../db/types'
import { cardIdFor, cardSides, planCards, wantedCards } from './cards'

const card = (variant: string, id = `card-${variant}`) => ({ id, variant }) as Card
const cloze = (front: string) => ({ type: 'cloze' as const, front, make_reverse: false })

describe('wantedCards', () => {
  it('makes one card per blank, and a reverse only when asked', () => {
    expect(wantedCards(cloze('{{a}} {{b}} {{c}}')).map((w) => w.variant)).toEqual(['1', '2', '3'])
    expect(wantedCards({ type: 'basic', front: 'Q', make_reverse: false }).map((w) => w.variant)).toEqual(['forward'])
    expect(wantedCards({ type: 'basic', front: 'Q', make_reverse: true }).map((w) => w.variant)).toEqual(['forward', 'reverse'])
  })
})

describe('planCards', () => {
  it('adds and removes the reverse card', () => {
    const basic = { type: 'basic' as const, front: 'Q', make_reverse: false }
    const on = planCards(basic, { ...basic, make_reverse: true }, [card('forward')])
    expect(on.create.map((w) => w.variant)).toEqual(['reverse'])
    expect(on.remove).toEqual([])
    const off = planCards({ ...basic, make_reverse: true }, basic, [card('forward'), card('reverse')])
    expect(off.remove.map((c) => c.variant)).toEqual(['reverse'])
  })

  it('keeps each blank on its card when a blank is added in the middle', () => {
    const before = cloze('{{1688}} {{William III}}')
    const after = cloze('{{1688}} {{Mary II}} {{William III}}')
    const plan = planCards(before, after, [card('1'), card('2')])
    expect(plan.keep).toEqual([
      { card: card('1'), variant: '1' },
      { card: card('2'), variant: '3' },
    ])
    expect(plan.create.map((w) => w.variant)).toEqual(['2'])
    expect(plan.remove).toEqual([])
  })

  it('keeps a blank whose text was corrected in place', () => {
    const plan = planCards(cloze('in {{1458}}'), cloze('in {{1485}}'), [card('1')])
    expect(plan.keep).toEqual([{ card: card('1'), variant: '1' }])
    expect(plan.create).toEqual([])
  })

  it('removes only the card of a removed blank', () => {
    const plan = planCards(cloze('{{a}} {{b}} {{c}}'), cloze('a {{b}} {{c}}'), [card('1'), card('2'), card('3')])
    expect(plan.remove.map((c) => c.id)).toEqual(['card-1'])
    expect(plan.keep.map((k) => [k.card.id, k.variant])).toEqual([
      ['card-2', '1'],
      ['card-3', '2'],
    ])
  })
})

describe('cardIdFor', () => {
  it('is the same every time, different per key, and shaped like a UUID', () => {
    const a = cardIdFor('note-1', 'reverse')
    expect(a).toBe(cardIdFor('note-1', 'reverse'))
    expect(a).not.toBe(cardIdFor('note-1', 'forward'))
    expect(a).not.toBe(cardIdFor('note-2', 'reverse'))
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('cardSides', () => {
  it('swaps sides for a reverse card and hides one blank for cloze', () => {
    const note = { type: 'basic' as const, front: 'Q', back: 'A' }
    expect(cardSides(note, { variant: 'reverse' })).toMatchObject({ question: 'A', answer: 'Q' })
    expect(cardSides({ type: 'cloze', front: '{{a}} {{b}}', back: 'extra' }, { variant: '2' })).toEqual({
      question: '{{a}} {{b}}',
      answer: 'extra',
      cloze: 2,
    })
  })
})
