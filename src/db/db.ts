import Dexie, { type EntityTable } from 'dexie'
import type { Card, CardSet, Note, ReviewLog, Settings, Subject } from './types'

export class FlashcardDB extends Dexie {
  subjects!: EntityTable<Subject, 'id'>
  sets!: EntityTable<CardSet, 'id'>
  notes!: EntityTable<Note, 'id'>
  cards!: EntityTable<Card, 'id'>
  review_logs!: EntityTable<ReviewLog, 'id'>
  settings!: EntityTable<Settings, 'id'>

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
  }
}

export const db = new FlashcardDB()
