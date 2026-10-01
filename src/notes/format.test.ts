import { describe, expect, it } from 'vitest'
import { docToText, parseBlocks, parseInline, textToDoc, toPlain, type PMNode } from './format'

describe('parseInline', () => {
  it('reads bold and italics', () => {
    expect(parseInline('a **b** _c_ *d*')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'd' }] },
    ])
  })

  it('leaves plain text alone', () => {
    for (const s of ['5 * 3 * 2', 'snake_case_name', 'a ** b', 'Henry VII (1485-1509)', 'unclosed **bold', '{{1688}}']) {
      expect(parseInline(s)).toEqual([{ type: 'text', text: s }])
    }
  })

  it('keeps escaped symbols as typed', () => {
    expect(parseInline('\\*not italic\\*')).toEqual([{ type: 'text', text: '*not italic*' }])
  })

  it('reads blanks only in cloze text, numbering them in order', () => {
    const out = parseInline('In {{1688}}, **{{William III::king}}**', true)
    expect(out[1]).toEqual({ type: 'cloze', index: 1, answer: '1688', hint: '' })
    expect(out[3]).toEqual({ type: 'bold', children: [{ type: 'cloze', index: 2, answer: 'William III', hint: 'king' }] })
  })
})

describe('parseBlocks', () => {
  it('groups lines into paragraphs and bullet lists', () => {
    const blocks = parseBlocks('Causes:\n- religion\n- money\nAfter')
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'list', 'paragraph'])
    expect(blocks[1].type === 'list' && blocks[1].items.length).toBe(2)
  })
})

describe('toPlain', () => {
  it('strips marks and braces for searching', () => {
    expect(toPlain('**Glorious** _Revolution_ in {{1688::year}}\n- one')).toBe('Glorious Revolution in 1688 one')
  })
})

describe('editor documents', () => {
  const t = (text: string, marks?: string[]): PMNode =>
    marks ? { type: 'text', text, marks: marks.map((type) => ({ type })) } : { type: 'text', text }
  const p = (...content: PMNode[]): PMNode => ({ type: 'paragraph', content })

  it('turns marks into text that reads back the same', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [
        p(t('The '), t('Glorious ', ['bold']), t('Revolution', ['bold', 'italic']), t(' of '), t('1688', ['italic'])),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('a * b'))] }] },
        p(t('- not a bullet')),
      ],
    }
    const text = docToText(doc)
    expect(text).toBe('The **Glorious _Revolution_** of _1688_\n- a \\* b\n\\- not a bullet')
    expect(docToText(textToDoc(text))).toBe(text)
    expect(toPlain(text)).toBe('The Glorious Revolution of 1688 a * b - not a bullet')
  })

  it('round-trips awkward neighbouring marks', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [p(t('one ', ['italic']), t('two', ['bold', 'italic']), t(' three', ['bold']), t(' x'), t('y', ['italic']), t('z'))],
    }
    const text = docToText(doc)
    expect(text).toBe('_one_ **_two_ three** x*y*z')
    expect(docToText(textToDoc(text))).toBe(text)
    expect(toPlain(text)).toBe('one two three xyz')
  })

  it('keeps plain text exactly as typed', () => {
    for (const s of ['When was the Battle of Bosworth?', '1485', 'Line one\nLine two']) {
      expect(docToText(textToDoc(s))).toBe(s)
    }
  })

  it('treats an empty editor as empty text', () => {
    expect(docToText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('')
  })
})
