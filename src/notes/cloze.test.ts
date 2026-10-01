import { describe, expect, it } from 'vitest'
import { buildCloze, clozeAnswers, countBlanks, editSentence, parseCloze, toggleWord, words, type ClozeDraft } from './cloze'

const S = 'The Glorious Revolution took place in 1688 and put William III and Mary II on the throne.'
const word = (d: ClozeDraft, w: string) => words(d.text).find((x) => d.text.slice(x.start, x.end) === w)!
const tap = (d: ClozeDraft, ...ws: string[]) => ws.reduce((acc, w) => ({ ...acc, blanks: toggleWord(acc, word(acc, w)) }), d)

describe('cloze sentences', () => {
  it('reads and writes blanks and hints', () => {
    const stored = 'Took place in {{1688::year}} under {{William III}}.'
    const d = parseCloze(stored)
    expect(d.text).toBe('Took place in 1688 under William III.')
    expect(d.blanks).toEqual([
      { start: 14, end: 18, hint: 'year' },
      { start: 25, end: 36, hint: '' },
    ])
    expect(buildCloze(d)).toBe(stored)
    expect(clozeAnswers(stored)).toEqual(['1688', 'William III'])
  })

  it('counts 3 blanks for 3 cards', () => {
    expect(countBlanks('In {{1688}}, {{William III}} and {{Mary II}} took the throne')).toBe(3)
    expect(countBlanks('No blanks {{}} here')).toBe(0)
  })
})

describe('tapping words', () => {
  const start: ClozeDraft = { text: S, blanks: [] }

  it('makes a blank from a tapped word', () => {
    expect(buildCloze(tap(start, '1688'))).toContain('in {{1688}} and')
  })

  it('stretches a blank to the next word', () => {
    const d = tap(start, 'William', 'III', 'Mary', 'II', '1688')
    expect(clozeAnswers(buildCloze(d))).toEqual(['1688', 'William III', 'Mary II'])
  })

  it('tapping again takes a word out of its blank', () => {
    const d = tap(start, 'William', 'III')
    expect(clozeAnswers(buildCloze(tap(d, 'III')))).toEqual(['William'])
    expect(tap(tap(start, '1688'), '1688').blanks).toEqual([])
  })

  it('keeps punctuation out of blanks', () => {
    const d = tap({ text: 'In 1485, Henry won.', blanks: [] }, '1485')
    expect(buildCloze(d)).toBe('In {{1485}}, Henry won.')
  })

  it('keeps dates, money and names as one word', () => {
    const text = "Henry's reign 1485-1509 cost £1.5m (40%)"
    expect(words(text).map((w) => text.slice(w.start, w.end))).toEqual(["Henry's", 'reign', '1485-1509', 'cost', '£1.5m', '40%'])
  })
})

describe('editing the sentence', () => {
  it('keeps blanks on their words when text is added before them', () => {
    const d = tap({ text: 'Bosworth was in 1485.', blanks: [] }, '1485')
    const e = editSentence(d, 'The Battle of Bosworth was in 1485.')
    expect(buildCloze(e)).toBe('The Battle of Bosworth was in {{1485}}.')
  })

  it('keeps a blank when its own word is corrected', () => {
    const d = tap({ text: 'Bosworth was in 1458.', blanks: [] }, '1458')
    expect(buildCloze(editSentence(d, 'Bosworth was in 1485.'))).toBe('Bosworth was in {{1485}}.')
  })

  it('drops a blank whose text is deleted', () => {
    const d = tap({ text: 'Bosworth was in 1485.', blanks: [] }, '1485')
    expect(editSentence(d, 'Bosworth was in .').blanks).toEqual([])
  })

  it('turns typed braces into blanks', () => {
    const d = tap({ text: 'Bosworth was in 1485.', blanks: [] }, '1485')
    const e = editSentence(d, '{{Bosworth}} was in 1485.')
    expect(e.text).toBe('Bosworth was in 1485.')
    expect(clozeAnswers(buildCloze(e))).toEqual(['Bosworth', '1485'])
  })
})
