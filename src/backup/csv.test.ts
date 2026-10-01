import { describe, expect, it } from 'vitest'
import { planCsvImport } from './cards-csv'
import { looksLikeHeader, parseCsv, toCsv } from './csv'

describe('csv', () => {
  it('reads quotes, commas and line breaks', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n"two\nlines",x,\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['two\nlines', 'x', ''],
    ])
  })

  it('guesses tabs and semicolons', () => {
    expect(parseCsv('a\tb\nc\td')).toEqual([['a', 'b'], ['c', 'd']])
    expect(parseCsv('a;b\nc;d')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('round-trips', () => {
    const rows = [['front', 'back'], ['When?', '1066, "Hastings"\n- **bold**']]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })

  it('spots a header row', () => {
    expect(looksLikeHeader(['Front', 'Back'])).toBe(true)
    expect(looksLikeHeader(['When was Hastings?', '1066'])).toBe(false)
  })

  it('turns rows into notes, with {{blanks}} as blanks cards', () => {
    const plan = planCsvImport('front,back,tags\nQ1,A1,tudors; kings\n{{1688}} revolution,,\n,orphan\nno back,', 'set')
    expect(plan.skipped).toBe(2)
    expect(plan.notes).toMatchObject([
      { type: 'basic', front: 'Q1', back: 'A1', tags: ['tudors', ' kings'] },
      { type: 'cloze', front: '{{1688}} revolution', back: '' },
    ])
  })
})
