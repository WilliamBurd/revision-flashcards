// Cloze notes: a sentence with blanks, e.g.
//   The Glorious Revolution took place in {{1688}} and put {{William III::king}} on the throne.
// Each blank becomes its own card. A blank may carry a hint after "::".
//
// The cloze form shows the sentence without the braces and lets you tap words
// to make blanks, so this file works with a sentence plus a list of blank
// positions, and converts to and from the stored {{...}} form.

import { splitBlank } from './format'

export interface Blank {
  /** Position in the sentence (without braces): start inclusive, end exclusive. */
  start: number
  end: number
  hint: string
}

export interface ClozeDraft {
  text: string
  blanks: Blank[]
}

const BLANK = /\{\{([\s\S]*?)\}\}/g

/** Stored form → sentence and blanks. Typed braces in the form are read the same way. */
export function parseCloze(stored: string): ClozeDraft {
  let text = ''
  const blanks: Blank[] = []
  let last = 0
  for (const m of stored.matchAll(BLANK)) {
    const { answer, hint } = splitBlank(m[1])
    text += stored.slice(last, m.index)
    if (answer) {
      blanks.push({ start: text.length, end: text.length + answer.length, hint })
      text += answer
    }
    last = m.index + m[0].length
  }
  text += stored.slice(last)
  return { text, blanks }
}

/** Sentence and blanks → stored form. */
export function buildCloze({ text, blanks }: ClozeDraft): string {
  let out = ''
  let last = 0
  for (const b of sortBlanks(blanks)) {
    out += text.slice(last, b.start) + '{{' + text.slice(b.start, b.end) + (b.hint ? `::${b.hint}` : '') + '}}'
    last = b.end
  }
  return out + text.slice(last)
}

/** The answers in a stored cloze sentence, in order (blank 1 first). */
export function clozeAnswers(stored: string): string[] {
  const { text, blanks } = parseCloze(stored)
  return blanks.map((b) => text.slice(b.start, b.end))
}

export function countBlanks(stored: string): number {
  return parseCloze(stored).blanks.length
}

const sortBlanks = (blanks: Blank[]) => [...blanks].sort((a, b) => a.start - b.start)

// ---- words you can tap ----

export interface Word {
  start: number
  end: number
}

// Letters and digits, keeping things like "Henry's", "1485-1509", "U.S." and
// "£1.5" or "40%" together as one word.
const WORD = /[£$€]?[\p{L}\p{N}]+(?:['’.\-–/:,][\p{L}\p{N}]+)*%?/gu

export function words(text: string): Word[] {
  return [...text.matchAll(WORD)].map((m) => ({ start: m.index, end: m.index + m[0].length }))
}

const onlySpace = (s: string) => /^[ \t]+$/.test(s)

/**
 * Tap a word: make it a blank, or stretch a blank it sits right next to, or
 * (if it's already in a blank) take it out of that blank.
 */
export function toggleWord(draft: ClozeDraft, word: Word): Blank[] {
  const { text } = draft
  const blanks = sortBlanks(draft.blanks)
  const all = words(text)
  const inside = blanks.find((b) => word.start >= b.start && word.end <= b.end)

  if (inside) {
    const rest = blanks.filter((b) => b !== inside)
    const ws = all.filter((w) => w.start >= inside.start && w.end <= inside.end)
    const at = ws.findIndex((w) => w.start === word.start)
    const before = ws.slice(0, at)
    const after = ws.slice(at + 1)
    if (before.length) rest.push({ start: inside.start, end: before[before.length - 1].end, hint: inside.hint })
    if (after.length) rest.push({ start: after[0].start, end: inside.end, hint: before.length ? '' : inside.hint })
    return sortBlanks(rest)
  }

  const left = blanks.find((b) => b.end <= word.start && onlySpace(text.slice(b.end, word.start)))
  const right = blanks.find((b) => b.start >= word.end && onlySpace(text.slice(word.end, b.start)))
  if (left && right) {
    return sortBlanks([
      ...blanks.filter((b) => b !== left && b !== right),
      { start: left.start, end: right.end, hint: left.hint || right.hint },
    ])
  }
  if (left) return blanks.map((b) => (b === left ? { ...b, end: word.end } : b))
  if (right) return blanks.map((b) => (b === right ? { ...b, start: word.start } : b))
  return sortBlanks([...blanks, { start: word.start, end: word.end, hint: '' }])
}

/**
 * The sentence was edited: move the blanks so they stay on the same words.
 * Typed {{braces}} in the new text become blanks too.
 */
export function editSentence(old: ClozeDraft, typed: string): ClozeDraft {
  const fresh = parseCloze(typed)
  const a = old.text
  const b = fresh.text
  // The changed region: everything between the common start and common end.
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  const oldEnd = a.length - s
  const newEnd = b.length - s
  const delta = b.length - a.length
  const move = (x: number, isEnd: boolean) => {
    if (x < p || (x === p && !isEnd)) return x
    if (x >= oldEnd) return x + delta
    return isEnd ? newEnd : p
  }

  const kept: Blank[] = []
  for (const blank of old.blanks) {
    let start = move(blank.start, false)
    let end = move(blank.end, true)
    while (start < end && /\s/.test(b[start])) start++
    while (end > start && /\s/.test(b[end - 1])) end--
    if (end > start) kept.push({ start, end, hint: blank.hint })
  }
  // Newly typed blanks win over any old blank they overlap.
  const overlaps = (x: Blank, y: Blank) => x.start < y.end && y.start < x.end
  const blanks = [...kept.filter((k) => !fresh.blanks.some((f) => overlaps(k, f))), ...fresh.blanks]
  return { text: b, blanks: sortBlanks(blanks) }
}
