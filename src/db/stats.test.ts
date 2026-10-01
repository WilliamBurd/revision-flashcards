import { describe, expect, it } from 'vitest'
import { dayKey } from '../lib/day'
import { streakFrom } from './stats'

const DAY = 24 * 3600_000

describe('streak', () => {
  const now = new Date(2026, 9, 10, 12).getTime()
  const keys = (...ago: number[]) => new Set(ago.map((n) => dayKey(now - n * DAY)))

  it('counts days in a row up to today', () => expect(streakFrom(keys(0, 1, 2, 4), now)).toBe(3))
  it("still counts if today hasn't been studied yet", () => expect(streakFrom(keys(1, 2), now)).toBe(2))
  it('is zero after a missed day', () => expect(streakFrom(keys(2, 3), now)).toBe(0))
})
