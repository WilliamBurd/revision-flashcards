import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { Card, CardSet, Note, ReviewLog, Settings, Subject } from './types'

/** Small key-value store for sync bookkeeping (who owns this data, last pull times). */
export interface Meta {
  key: string
  value: unknown
}

/** The tables that sync to the cloud, in the order they're sent. */
export const SYNCED_TABLES = ['subjects', 'sets', 'notes', 'cards', 'review_logs', 'settings'] as const
export type SyncedTable = (typeof SYNCED_TABLES)[number]

export class FlashcardDB extends Dexie {
  subjects!: EntityTable<Subject, 'id'>
  sets!: EntityTable<CardSet, 'id'>
  notes!: EntityTable<Note, 'id'>
  cards!: EntityTable<Card, 'id'>
  review_logs!: EntityTable<ReviewLog, 'id'>
  settings!: EntityTable<Settings, 'id'>
  meta!: EntityTable<Meta, 'key'>

  constructor(name = 'revision-flashcards') {
    super(name)
    // Only indexed fields are listed here; every other field is still stored.
    this.version(1).stores({
      subjects: 'id, updated_at',
      sets: 'id, subject_id, updated_at',
      notes: 'id, set_id, updated_at',
      cards: 'id, note_id, set_id, due, updated_at',
      review_logs: 'id, card_id, reviewed_at, updated_at',
      settings: 'id',
    })
    // Version 2 (Phase 2): a `dirty` flag on everything that syncs, and a meta table.
    // Everything made before syncing existed is marked dirty so it gets uploaded.
    this.version(2)
      .stores({
        subjects: 'id, updated_at, dirty',
        sets: 'id, subject_id, updated_at, dirty',
        notes: 'id, set_id, updated_at, dirty',
        cards: 'id, note_id, set_id, due, updated_at, dirty',
        review_logs: 'id, card_id, reviewed_at, updated_at, dirty',
        settings: 'id, dirty',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        for (const table of SYNCED_TABLES) {
          await tx.table(table).toCollection().modify({ dirty: 1 })
        }
      })

    // Every local change marks the record dirty, so the sync engine knows to
    // upload it. Writes made by the sync engine itself are tagged and skipped.
    for (const name of SYNCED_TABLES) {
      const table = this.table(name)
      table.hook('creating', (_key, obj, tx) => {
        if (!isSyncWrite(tx)) obj.dirty = 1
        onLocalChange()
      })
      table.hook('updating', (mods, _key, _obj, tx) => {
        if (isSyncWrite(tx)) return undefined
        onLocalChange()
        return 'dirty' in mods ? undefined : { dirty: 1 }
      })
    }
  }
}

const syncTransactions = new WeakSet<object>()

/** Run database writes on behalf of the sync engine (they don't mark records dirty). */
export function asSyncWrite<T>(db: FlashcardDB, tables: string[], fn: () => Promise<T>): Promise<T> {
  return db.transaction('rw', tables, async (tx) => {
    syncTransactions.add(tx)
    return fn()
  })
}

function isSyncWrite(tx: Transaction): boolean {
  // Hooks may see a child transaction; walk up to the one we tagged.
  let t: (Transaction & { parent?: Transaction }) | undefined = tx
  while (t) {
    if (syncTransactions.has(t)) return true
    t = t.parent
  }
  return false
}

// The sync engine listens for local changes so it can upload them soon after.
const listeners = new Set<() => void>()
let notifyQueued = false

function onLocalChange() {
  if (notifyQueued) return
  notifyQueued = true
  // A timer, not a microtask, so listeners run outside the write's transaction
  // (inside it they could only read the tables that transaction locked).
  setTimeout(() => {
    notifyQueued = false
    Dexie.ignoreTransaction(() => listeners.forEach((l) => l()))
  }, 0)
}

export function onLocalChanges(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const db = new FlashcardDB()
