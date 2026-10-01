import { newId } from '../lib/ids'
import { cardIdFor, planCards, type WantedCard } from '../notes/cards'
import { newCardSchedule } from '../scheduler/fsrs'
import { db } from './db'
import type { Card, Note, NoteType } from './types'

export interface NewNote {
  setId: string
  type: NoteType
  front: string
  back: string
  tags?: string[]
  makeReverse?: boolean
}

/** Tidy a list of tags: trimmed, no empties, no repeats (ignoring capitals). */
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, ' ')
    if (!tag || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    out.push(tag)
  }
  return out
}

function makeCards(note: Note, wanted: WantedCard[], now: number): Card[] {
  // Each card a millisecond apart, so a sentence's blanks are learned in order.
  return wanted.map((w, i) => ({
      id: cardIdFor(note.id, w.key),
      note_id: note.id,
      set_id: note.set_id,
      variant: w.variant,
      ...newCardSchedule(now),
      is_leech: false,
      created_at: now + i,
      updated_at: now,
      deleted: false,
    }))
}

function buildNote(input: NewNote, now: number): Note {
  return {
    id: newId(),
    set_id: input.setId,
    type: input.type,
    front: input.front.trim(),
    back: input.back.trim(),
    tags: cleanTags(input.tags ?? []),
    make_reverse: input.type === 'basic' && !!input.makeReverse,
    created_at: now,
    updated_at: now,
    deleted: false,
  }
}

/**
 * Add several notes and their cards in one go. Each note is stamped a little
 * after the one before, so new cards are studied in the order they were
 * typed or pasted.
 */
/** Room between notes for each one's cards (a sentence with more blanks than this is unlikely). */
const NOTE_GAP_MS = 50

export async function addNotes(inputs: NewNote[]): Promise<Note[]> {
  const start = Date.now()
  const prepared = inputs.map((input, i) => {
    const at = start + i * NOTE_GAP_MS
    const note = buildNote(input, at)
    const { create } = planCards(note, note, [])
    return { note, cards: makeCards(note, create, at) }
  })
  await db.transaction('rw', db.notes, db.cards, async () => {
    await db.notes.bulkAdd(prepared.map((p) => p.note))
    await db.cards.bulkAdd(prepared.flatMap((p) => p.cards))
  })
  return prepared.map((p) => p.note)
}

export async function addNote(input: NewNote): Promise<Note> {
  return (await addNotes([input]))[0]
}

/** Add a basic note and the one card it makes. */
export function addBasicNote(setId: string, front: string, back: string): Promise<Note> {
  return addNote({ setId, type: 'basic', front, back })
}

export type NoteChanges = Partial<Pick<Note, 'front' | 'back' | 'set_id' | 'tags' | 'make_reverse'>>

/**
 * Change a note. Its cards keep their schedules: they read their text from
 * the note, and only cards that are no longer wanted (a removed blank, or
 * reversed turned off) are deleted. New blanks or a reverse card are added.
 */
export async function updateNote(id: string, changes: NoteChanges): Promise<void> {
  const now = Date.now()
  const clean = { ...changes }
  if (clean.front !== undefined) clean.front = clean.front.trim()
  if (clean.back !== undefined) clean.back = clean.back.trim()
  if (clean.tags !== undefined) clean.tags = cleanTags(clean.tags)

  await db.transaction('rw', db.notes, db.cards, async () => {
    const before = await db.notes.get(id)
    if (!before) return
    const after: Note = { ...before, ...clean, updated_at: now }
    if (after.type !== 'basic') after.make_reverse = false
    await db.notes.put(after)

    const existing = (await db.cards.where('note_id').equals(id).toArray()).filter((c) => !c.deleted)
    const plan = planCards(before, after, existing)
    for (const { card, variant } of plan.keep) {
      if (card.variant !== variant || card.set_id !== after.set_id) {
        await db.cards.update(card.id, { variant, set_id: after.set_id, updated_at: now })
      }
    }
    for (const card of plan.remove) await db.cards.update(card.id, { deleted: true, updated_at: now })
    for (const fresh of makeCards(after, plan.create, now)) {
      // A card with this ID may exist already: deleted earlier (a blank
      // removed and put back), so bring it back with its old schedule.
      const old = await db.cards.get(fresh.id)
      if (!old) await db.cards.add(fresh)
      else if (old.deleted) await db.cards.update(old.id, { deleted: false, variant: fresh.variant, set_id: after.set_id, updated_at: now })
      else await db.cards.add({ ...fresh, id: newId() })
    }
  })
}

/** Soft-delete a note and its cards. */
export async function deleteNote(id: string): Promise<void> {
  await deleteNotes([id])
}

export async function deleteNotes(ids: string[]): Promise<void> {
  const gone = { deleted: true, updated_at: Date.now() }
  await db.transaction('rw', db.notes, db.cards, async () => {
    await db.notes.where('id').anyOf(ids).modify(gone)
    await db.cards.where('note_id').anyOf(ids).modify(gone)
  })
}

export async function moveNotes(ids: string[], setId: string): Promise<void> {
  const changes = { set_id: setId, updated_at: Date.now() }
  await db.transaction('rw', db.notes, db.cards, async () => {
    await db.notes.where('id').anyOf(ids).modify(changes)
    await db.cards.where('note_id').anyOf(ids).modify(changes)
  })
}

export async function addTagToNotes(ids: string[], tag: string): Promise<void> {
  const now = Date.now()
  await db.notes
    .where('id')
    .anyOf(ids)
    .modify((n) => {
      n.tags = cleanTags([...n.tags, tag])
      n.updated_at = now
    })
}

export async function removeTagFromNotes(ids: string[], tag: string): Promise<void> {
  const now = Date.now()
  const lower = tag.toLowerCase()
  await db.notes
    .where('id')
    .anyOf(ids)
    .modify((n) => {
      n.tags = n.tags.filter((t) => t.toLowerCase() !== lower)
      n.updated_at = now
    })
}

/** Every tag in use, most used first. */
export async function allTags(): Promise<string[]> {
  const counts = new Map<string, { tag: string; n: number }>()
  await db.notes.each((n) => {
    if (n.deleted) return
    for (const tag of n.tags ?? []) {
      const k = tag.toLowerCase()
      const e = counts.get(k)
      if (e) e.n++
      else counts.set(k, { tag, n: 1 })
    }
  })
  return [...counts.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)).map((e) => e.tag)
}
