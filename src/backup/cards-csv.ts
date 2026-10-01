// Cards as CSV: one row per note, with columns front, back, tags.
// A front with {{blanks}} becomes a blanks (cloze) card, with "back" as its note.

import { db } from '../db/db'
import { addNotes, type NewNote } from '../db/notes'
import { looksLikeHeader, parseCsv, toCsv } from './csv'

export async function exportSetCsv(setId: string): Promise<string> {
  const notes = (await db.notes.where('set_id').equals(setId).toArray())
    .filter((n) => !n.deleted)
    .sort((a, b) => a.created_at - b.created_at)
  return toCsv([['front', 'back', 'tags'], ...notes.map((n) => [n.front, n.back, n.tags.join('; ')])])
}

export interface CsvPlan {
  notes: NewNote[]
  skipped: number
}

/** Work out what a CSV file would add to a set, without adding anything yet. */
export function planCsvImport(text: string, setId: string): CsvPlan {
  const rows = parseCsv(text)
  if (rows.length && looksLikeHeader(rows[0])) rows.shift()
  const notes: NewNote[] = []
  let skipped = 0
  for (const [front = '', back = '', tags = ''] of rows) {
    const f = front.trim()
    const isCloze = /\{\{[^}]*\S[^}]*\}\}/.test(f)
    if (!f || (!isCloze && !back.trim())) {
      skipped++
      continue
    }
    notes.push({
      setId,
      type: isCloze ? 'cloze' : 'basic',
      front: f,
      back: back.trim(),
      tags: tags.split(/[;,]/),
    })
  }
  return { notes, skipped }
}

export async function importCsv(text: string, setId: string): Promise<CsvPlan> {
  const plan = planCsvImport(text, setId)
  if (plan.notes.length) await addNotes(plan.notes)
  return plan
}
