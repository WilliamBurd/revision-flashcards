// Full backups as JSON: subjects, topics, sets, notes, cards (with their schedules)
// and the review history. Importing merges by id, so the same file can be
// imported twice without making duplicates.

import { db } from '../db/db'
import type { Card, CardSet, Note, ReviewLog, Subject, Topic } from '../db/types'

export const BACKUP_APP = 'burdis-flashcards'
export const BACKUP_VERSION = 1

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exported_at: string
  subjects: Subject[]
  /** Missing from backups made before topics existed. */
  topics?: Topic[]
  sets: CardSet[]
  notes: Note[]
  cards: Card[]
  review_logs: ReviewLog[]
}

type Row = { id: string; updated_at: number; deleted: boolean; dirty?: number }

const clean = <T extends Row>(rows: T[]): T[] =>
  rows.filter((r) => !r.deleted).map(({ dirty: _dirty, ...r }) => r as T)

/** Everything, or just one set (with its subject and topic so it has somewhere to go). */
export async function exportBackup(only?: { setId: string }, now = Date.now()): Promise<Backup> {
  let sets = clean(await db.sets.toArray())
  if (only) sets = sets.filter((s) => s.id === only.setId)
  const setIds = new Set(sets.map((s) => s.id))
  const subjectIds = new Set(sets.map((s) => s.subject_id))
  let subjects = clean(await db.subjects.toArray())
  if (only) subjects = subjects.filter((s) => subjectIds.has(s.id))
  const topicIds = new Set(sets.map((s) => s.topic_id))
  let topics = clean(await db.topics.toArray())
  if (only) topics = topics.filter((t) => topicIds.has(t.id))
  const notes = clean(await db.notes.toArray()).filter((n) => setIds.has(n.set_id))
  const cards = clean(await db.cards.toArray()).filter((c) => setIds.has(c.set_id))
  const cardIds = new Set(cards.map((c) => c.id))
  const review_logs = clean(await db.review_logs.toArray()).filter((l) => cardIds.has(l.card_id))
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exported_at: new Date(now).toISOString(),
    subjects,
    topics,
    sets,
    notes,
    cards,
    review_logs,
  }
}

export class BackupError extends Error {}

/** Check a parsed file really is a backup from this app. */
export function readBackup(data: unknown): Backup {
  const b = data as Partial<Backup> | null
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP) {
    throw new BackupError("This isn't a Burdis Flashcards backup file.")
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app. Update the app and try again.')
  }
  for (const key of ['subjects', 'sets', 'notes', 'cards', 'review_logs'] as const) {
    if (!Array.isArray(b[key]) || b[key].some((r: unknown) => !r || typeof (r as Row).id !== 'string')) {
      throw new BackupError('This backup file is damaged and could not be read.')
    }
  }
  if (b.topics !== undefined && (!Array.isArray(b.topics) || b.topics.some((r: unknown) => !r || typeof (r as Row).id !== 'string'))) {
    throw new BackupError('This backup file is damaged and could not be read.')
  }
  return b as Backup
}

export interface ImportResult {
  subjects: number
  sets: number
  notes: number
  cards: number
  reviews: number
}

/**
 * Merge a backup into this device. A record is taken from the file when this
 * device doesn't have it, has deleted it, or has an older copy; otherwise the
 * newer copy here is kept. Imported records are stamped with the current
 * time so they sync to other devices.
 */
export async function importBackup(backup: Backup, now = Date.now()): Promise<ImportResult> {
  const result: ImportResult = { subjects: 0, sets: 0, notes: 0, cards: 0, reviews: 0 }
  await db.transaction('rw', [db.subjects, db.topics, db.sets, db.notes, db.cards, db.review_logs], async () => {
    async function merge<T extends Row>(table: typeof db.subjects | typeof db.topics | typeof db.sets | typeof db.notes | typeof db.cards, rows: T[]) {
      let n = 0
      for (const { dirty: _dirty, ...incoming } of rows) {
        const local = (await table.get(incoming.id)) as Row | undefined
        if (local && !local.deleted && local.updated_at >= incoming.updated_at) continue
        await (table as unknown as { put: (r: Row) => Promise<unknown> }).put({ ...incoming, deleted: false, updated_at: now })
        n++
      }
      return n
    }
    result.subjects = await merge(db.subjects, backup.subjects)
    await merge(db.topics, backup.topics ?? [])
    result.sets = await merge(db.sets, backup.sets)
    result.notes = await merge(db.notes, backup.notes)
    result.cards = await merge(db.cards, backup.cards)
    // The review history only ever grows: add whatever is missing.
    for (const { dirty: _dirty, ...log } of backup.review_logs) {
      if (await db.review_logs.get(log.id)) continue
      await db.review_logs.add({ ...log, updated_at: now })
      result.reviews++
    }
  })
  return result
}

/** Offer a file to save. */
export function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A file name safe on every system, e.g. "History - Tudors". */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'cards'
}
