import { describe, expect, it } from 'vitest'
import { formatInterval } from './formatInterval'

const m = 60_000
const d = 24 * 60 * m

describe('formatInterval', () => {
  it.each([
    [30_000, '<1m'],
    [1 * m, '1m'],
    [10 * m, '10m'],
    [3 * 60 * m, '3h'],
    [1 * d, '1d'],
    [3 * d, '3d'],
    [13 * d, '13d'],
    [14 * d, '2w'],
    [45 * d, '6w'],
    [90 * d, '3mo'],
    [365 * d, '1y'],
    [548 * d, '1.5y'],
  ])('%i ms is %s', (ms, label) => {
    expect(formatInterval(ms)).toBe(label)
  })
})
