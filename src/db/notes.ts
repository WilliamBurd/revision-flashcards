import { newId } from '../lib/ids'
import { newCardSchedule } from '../scheduler/fsrs'
import { db } from './db'
import type { Card, Note } from './types'

/** Add a basic note and the one card it makes. */
export async function addBasicNote(setId: string, front: string, back: string): Promise<Note> {
  const now = Date.now()
  const note: Note = {
    id: newId(),
    set_id: setId,
    type: 'basic',
    front: front.trim(),
    back: back.trim(),
    tags: [],
    make_reverse: false,
    created_at: now,
    updated_at: now,
    deleted: false,
  }
  const card: Card = {
    id: newId(),
    note_id: note.id,
    set_id: setId,
    variant: 'forward',
    ...newCardSchedule(now),
    is_leech: false,
    created_at: now,
    updated_at: now,
    deleted: false,
  }
  await db.transaction('rw', db.notes, db.cards, async () => {
    await db.notes.add(note)
    await db.cards.add(card)
  })
  return note
}

/**
 * Change a note's text or set. Its cards keep their schedule: only the text
 * (which cards read from the note) and the set change.
 */
export async function updateNote(
  id: string,
  changes: Partial<Pick<Note, 'front' | 'back' | 'set_id'>>,
): Promise<void> {
  const now = Date.now()
  const clean = { ...changes }
  if (clean.front !== undefined) clean.front = clean.front.trim()
  if (clean.back !== undefined) clean.back = clean.back.trim()
  await db.transaction('rw', db.notes, db.cards, async () => {
    await db.notes.update(id, { ...clean, updated_at: now })
    if (changes.set_id) {
      await db.cards.where('note_id').equals(id).modify({ set_id: changes.set_id, updated_at: now })
    }
  })
}

/** Soft-delete a note and its cards. */
export async function deleteNote(id: string): Promise<void> {
  const gone = { deleted: true, updated_at: Date.now() }
  await db.transaction('rw', db.notes, db.cards, async () => {
    await db.notes.update(id, gone)
    await db.cards.where('note_id').equals(id).modify(gone)
  })
}
