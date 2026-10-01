import { describe, expect, it } from 'vitest'
import { dayKey, dayStart, nextDayStart } from './day'

const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime()

describe('study day', () => {
  it('starts at 4am', () => {
    expect(dayStart(at(2026, 10, 1, 15))).toBe(at(2026, 10, 1, 4))
    expect(nextDayStart(at(2026, 10, 1, 15))).toBe(at(2026, 10, 2, 4))
  })

  it('counts 1am as the previous day', () => {
    expect(dayKey(at(2026, 10, 2, 1))).toBe('2026-10-01')
    expect(dayKey(at(2026, 10, 2, 4))).toBe('2026-10-02')
  })

  it('handles month ends', () => {
    expect(dayKey(at(2026, 11, 1, 2))).toBe('2026-10-31')
    expect(nextDayStart(at(2026, 12, 31, 23))).toBe(at(2027, 1, 1, 4))
  })
})
