import { describe, expect, it } from 'vitest'
import { buildCloze, parseCloze, toggleWord, words } from '../notes/cloze'
import { parseBlocks } from '../notes/format'
import { toggleBullets, toggleMark } from './MarkupBar'

describe('markup buttons for plain text boxes', () => {
  it('wraps and unwraps the selection', () => {
    const on = toggleMark('Henry VII won', 0, 9, '**')
    expect(on).toEqual({ text: '**Henry VII** won', start: 2, end: 11 })
    expect(toggleMark(on.text, on.start, on.end, '**').text).toBe('Henry VII won')
    expect(toggleMark('a b ', 2, 4, '_').text).toBe('a _b_ ')
  })

  it('inserts an empty pair with the cursor inside', () => {
    expect(toggleMark('ab', 1, 1, '**')).toEqual({ text: 'a****b', start: 3, end: 3 })
  })

  it('turns lines into bullets and back', () => {
    const on = toggleBullets('one\ntwo\nthree', 0, 7)
    expect(on.text).toBe('- one\n- two\nthree')
    expect(toggleBullets(on.text, 0, 11).text).toBe('one\ntwo\nthree')
  })

  it('a bold word in a Blanks sentence can still be made a blank', () => {
    const draft = parseCloze('The Revolution was in **1688**.')
    const w = words(draft.text).find((x) => draft.text.slice(x.start, x.end) === '1688')!
    const stored = buildCloze({ ...draft, blanks: toggleWord(draft, w) })
    expect(stored).toBe('The Revolution was in **{{1688}}**.')
    const [block] = parseBlocks(stored, true)
    expect(JSON.stringify(block)).toContain('"type":"bold"')
    expect(JSON.stringify(block)).toContain('"type":"cloze"')
  })
})
