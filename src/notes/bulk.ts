// Paste many: one card per line.
//
//   Battle of Bosworth - 1485          → basic card (front - back)
//   Star Chamber set up in {{1487}}    → cloze card
//
// Each line splits at the first separator only, so a hyphen later in the
// answer is fine. Bullets or numbers at the start of a line are removed, so
// notes can be pasted as they are.

import { countBlanks } from './cloze'

export type Separator = 'auto' | 'dash' | 'tab' | 'custom'

export type BulkLine =
  | { line: number; kind: 'basic'; front: string; back: string }
  | { line: number; kind: 'cloze'; front: string; blanks: number }
  | { line: number; kind: 'error'; text: string; error: string }

const LIST_MARK = /^\s*(?:[-•*▪◦‣]\s+|\d{1,3}[.)]\s+)/
// " - ", plus the en and em dashes Word and Google Docs turn hyphens into.
const DASHES = [' - ', ' – ', ' — ']

function splitAt(line: string, sep: Separator, custom: string): [string, string] | null {
  const candidates =
    sep === 'tab' ? ['\t'] : sep === 'dash' ? DASHES : sep === 'custom' ? (custom ? [custom] : []) : ['\t', ...DASHES]
  // The earliest separator in the line wins (tabs first for 'auto', as pasted tables use them).
  let best: { at: number; len: number } | null = null
  for (const c of candidates) {
    const at = line.indexOf(c)
    if (at < 0) continue
    if (sep === 'auto' && c === '\t') {
      best = { at, len: 1 }
      break
    }
    if (!best || at < best.at) best = { at, len: c.length }
  }
  if (!best) return null
  return [line.slice(0, best.at), line.slice(best.at + best.len)]
}

export function parseBulk(input: string, sep: Separator = 'auto', custom = ''): BulkLine[] {
  const out: BulkLine[] = []
  input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((raw, i) => {
      const line = i + 1
      const text = raw.replace(LIST_MARK, '').trim()
      if (!text) return
      const blanks = countBlanks(text)
      if (blanks > 0) {
        out.push({ line, kind: 'cloze', front: text, blanks })
        return
      }
      // "Front -" with nothing after still counts as split, with an empty back.
      const parts = splitAt(text, sep, custom) ?? splitAt(`${text} `, sep, custom)
      if (!parts) {
        out.push({ line, kind: 'error', text, error: 'No separator found' })
        return
      }
      const front = parts[0].trim()
      const back = parts[1].trim()
      if (!front) out.push({ line, kind: 'error', text, error: 'Front is empty' })
      else if (!back) out.push({ line, kind: 'error', text, error: 'Back is empty' })
      else out.push({ line, kind: 'basic', front, back })
    })
  return out
}

/** How many cards a parsed paste makes (cloze lines make one per blank, reversed basics two). */
export function bulkCardCount(lines: BulkLine[], reverse: boolean): number {
  return lines.reduce((n, l) => n + (l.kind === 'basic' ? (reverse ? 2 : 1) : l.kind === 'cloze' ? l.blanks : 0), 0)
}
