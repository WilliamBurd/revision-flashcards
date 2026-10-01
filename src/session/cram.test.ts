import { describe, expect, it } from 'vitest'
import { cramAfterRating, shuffle } from './cram'

describe('cram queue', () => {
  it('shuffles without losing anything', () => {
    const ids = Array.from({ length: 50 }, (_, i) => String(i))
    expect([...shuffle(ids)].sort()).toEqual([...ids].sort())
  })

  it('drops a card once known and brings No Idea back three cards later', () => {
    expect(cramAfterRating(['a', 'b', 'c', 'd', 'e'], 3)).toEqual(['b', 'c', 'd', 'e'])
    expect(cramAfterRating(['a', 'b', 'c', 'd', 'e'], 1)).toEqual(['b', 'c', 'd', 'a', 'e'])
    expect(cramAfterRating(['a', 'b'], 1)).toEqual(['b', 'a'])
    expect(cramAfterRating(['a'], 1)).toEqual(['a'])
    expect(cramAfterRating([], 1)).toEqual([])
  })
})
