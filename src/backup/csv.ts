// CSV in and out, for moving cards to and from spreadsheets and other apps.
// Quoted fields can hold commas, quotes ("") and line breaks.

/** Read CSV text into rows. The separator is guessed from the first line (comma, tab or semicolon). */
export function parseCsv(text: string, separator?: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const sep = separator ?? guessSeparator(src)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"' && field === '') {
      quoted = true
    } else if (ch === sep) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  // Blank lines carry nothing.
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

function guessSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const outsideQuotes = firstLine.replace(/"[^"]*"/g, '')
  const counts = [',', '\t', ';'].map((s) => [s, outsideQuotes.split(s).length - 1] as const)
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ','
}

function quote(field: string): string {
  return /[",\r\n]/.test(field) || field !== field.trim() ? `"${field.replace(/"/g, '""')}"` : field
}

/** Rows to CSV text, with Windows line endings so Excel is happy. */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n'
}

const HEADER_WORDS = new Set(['front', 'back', 'question', 'answer', 'tags', 'term', 'definition'])

/** True if the first row looks like column names rather than a card. */
export function looksLikeHeader(row: string[]): boolean {
  return row.length > 0 && HEADER_WORDS.has(row[0].trim().toLowerCase())
}
