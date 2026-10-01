import { describe, expect, it } from 'vitest'
import { CardState } from '../db/types'
import { makeScheduler, newCardSchedule, previewIntervals, rateCard } from './fsrs'

const MIN = 60_000
const DAY = 24 * 60 * MIN
const now = new Date(2026, 9, 1, 12).getTime()

describe('FSRS wrapper', () => {
  it('starts new cards as New and due now', () => {
    const card = newCardSchedule(now)
    expect(card.state).toBe(CardState.New)
    expect(card.due).toBe(now)
    expect(card.reps).toBe(0)
  })

  it('uses learning steps of 1 minute then 10 minutes for new cards', () => {
    const card = newCardSchedule(now)
    const preview = previewIntervals(card, now)
    expect(preview[1].label).toBe('1m')
    expect(preview[3].label).toBe('10m')
    expect(preview[4].due - now).toBeGreaterThanOrEqual(1 * DAY)

    const afterAgain = rateCard(card, 1, now)
    expect(afterAgain.state).toBe(CardState.Learning)
    expect(afterAgain.due).toBe(now + MIN)
  })

  it('moves to daily intervals after both learning steps', () => {
    let card = newCardSchedule(now)
    card = rateCard(card, 3, now)
    expect(card.due).toBe(now + 10 * MIN)
    const later = now + 10 * MIN
    card = rateCard(card, 3, later)
    expect(card.state).toBe(CardState.Review)
    expect(card.due - later).toBeGreaterThanOrEqual(1 * DAY)
  })

  it('sends a forgotten review card to relearning for 10 minutes', () => {
    let card = newCardSchedule(now)
    card = rateCard(card, 4, now)
    const reviewTime = card.due
    card = rateCard(card, 1, reviewTime)
    expect(card.state).toBe(CardState.Relearning)
    expect(card.lapses).toBe(1)
    expect(card.due).toBe(reviewTime + 10 * MIN)
  })

  it('never schedules further ahead than the maximum interval', () => {
    const scheduler = makeScheduler()
    let card = newCardSchedule(now)
    let t = now
    for (let i = 0; i < 12; i++) {
      card = rateCard(card, 4, t, scheduler)
      expect(card.scheduled_days).toBeLessThanOrEqual(45)
      t = card.due
    }
    expect(card.scheduled_days).toBeGreaterThan(30)
  })

  it('respects a custom maximum interval', () => {
    const scheduler = makeScheduler({
      target_retention: 0.9,
      max_interval_days: 7,
      learning_steps: ['1m', '10m'],
      relearning_steps: ['10m'],
    })
    let card = newCardSchedule(now)
    let t = now
    for (let i = 0; i < 6; i++) {
      card = rateCard(card, 4, t, scheduler)
      t = card.due
    }
    expect(card.scheduled_days).toBeLessThanOrEqual(7)
  })
})
