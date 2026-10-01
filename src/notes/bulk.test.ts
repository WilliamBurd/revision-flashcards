import { describe, expect, it } from 'vitest'
import { bulkCardCount, parseBulk } from './bulk'

describe('parseBulk', () => {
  it('makes 30 cards from 30 lines', () => {
    const text = Array.from({ length: 30 }, (_, i) => `Question ${i + 1} - Answer ${i + 1}`).join('\n')
    const lines = parseBulk(text)
    expect(lines).toHaveLength(30)
    expect(lines.every((l) => l.kind === 'basic')).toBe(true)
    expect(lines[29]).toEqual({ line: 30, kind: 'basic', front: 'Question 30', back: 'Answer 30' })
    expect(bulkCardCount(lines, false)).toBe(30)
    expect(bulkCardCount(lines, true)).toBe(60)
  })

  it('splits at the first separator only', () => {
    expect(parseBulk('Wars of the Roses - 1455 - 1487')[0]).toMatchObject({ front: 'Wars of the Roses', back: '1455 - 1487' })
  })

  it('accepts tabs and the dashes Word makes', () => {
    expect(parseBulk('A\tB')[0]).toMatchObject({ front: 'A', back: 'B' })
    expect(parseBulk('A – B')[0]).toMatchObject({ front: 'A', back: 'B' })
    expect(parseBulk('A — B')[0]).toMatchObject({ front: 'A', back: 'B' })
    // In auto mode a tab wins, so a hyphen inside a spreadsheet cell stays.
    expect(parseBulk('Lancaster - York\tRoses')[0]).toMatchObject({ front: 'Lancaster - York', back: 'Roses' })
  })

  it('uses only the separator chosen', () => {
    expect(parseBulk('A - B', 'tab')[0]).toMatchObject({ kind: 'error', error: 'No separator found' })
    expect(parseBulk('A = B', 'custom', '=')[0]).toMatchObject({ front: 'A', back: 'B' })
  })

  it('removes bullets and numbers from pasted notes', () => {
    const lines = parseBulk('- Bosworth - 1485\n• Stoke - 1487\n3. Blackheath - 1497\n**Bold** - kept')
    expect(lines.map((l) => l.kind === 'basic' && l.front)).toEqual(['Bosworth', 'Stoke', 'Blackheath', '**Bold**'])
  })

  it('skips blank lines and flags lines that did not split', () => {
    const lines = parseBulk('A - B\n\n   \nJust a heading\nC - \nD - E')
    expect(lines.map((l) => l.kind)).toEqual(['basic', 'error', 'error', 'basic'])
    expect(lines[1]).toMatchObject({ line: 4, error: 'No separator found' })
    expect(lines[2]).toMatchObject({ line: 5, error: 'Back is empty' })
  })

  it('treats a line with blanks as a cloze card', () => {
    const lines = parseBulk('The Star Chamber was set up in {{1487}} by {{Henry VII}}')
    expect(lines[0]).toMatchObject({ kind: 'cloze', blanks: 2 })
    expect(bulkCardCount(lines, true)).toBe(2)
  })
})
