// Shapes of everything stored on the device.
//
// Every record has a UUID made on the device (so it can be created offline),
// plus created_at / updated_at / deleted so it can be synced in Phase 2.
// Times are stored as milliseconds since 1970 (Date.now()), which IndexedDB
// can index and sort quickly.

export interface SyncFields {
  id: string
  created_at: number
  updated_at: number
  /** Soft delete: deleted records stay so the deletion can sync to other devices. */
  deleted: boolean
  /**
   * 1 when this record has changes not yet sent to the cloud. Set
   * automatically on every local write (see db.ts); never sent to the server.
   */
  dirty?: number
}

export interface ExamDate {
  name: string
  /** YYYY-MM-DD */
  date: string
}

export interface Subject extends SyncFields {
  name: string
  sort_order: number
  exam_dates: ExamDate[]
}

/** A set of cards. Called CardSet in code because `Set` is built into JavaScript. */
export interface CardSet extends SyncFields {
  subject_id: string
  name: string
  sort_order: number
  new_cards_per_day: number
  /** YYYY-MM-DD, overrides the subject's exam dates (Phase 4). */
  exam_date_override: string | null
}

export type NoteType = 'basic' | 'cloze'

/** What you type in. One basic note makes one card (two if reversed). */
export interface Note extends SyncFields {
  set_id: string
  type: NoteType
  front: string
  back: string
  tags: string[]
  make_reverse: boolean
}

/** 'forward', 'reverse', or the cloze blank number as a string ('1', '2', ...). */
export type CardVariant = string

/** Matches ts-fsrs's State enum. */
export const CardState = {
  New: 0,
  Learning: 1,
  Review: 2,
  Relearning: 3,
} as const
export type CardState = (typeof CardState)[keyof typeof CardState]

/** What gets studied. Its text comes from its note. */
export interface Card extends SyncFields {
  note_id: string
  set_id: string
  variant: CardVariant
  // FSRS memory state
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: CardState
  last_review: number | null
  is_leech: boolean
}

/** 1 No Idea, 2 Barely, 3 Kind Of, 4 Confident (FSRS Again, Hard, Good, Easy). */
export type Rating = 1 | 2 | 3 | 4

/** Append-only history of every rating. */
export interface ReviewLog extends SyncFields {
  card_id: string
  rating: Rating
  state_before: CardState
  reviewed_at: number
  duration_ms: number
  is_cram: boolean
}

export interface Settings {
  /** Always 'settings': there is one settings row per device. */
  id: 'settings'
  updated_at: number
  dirty?: number
  /** 0.8 to 0.95 */
  target_retention: number
  max_interval_days: number
  learning_steps: string[]
  relearning_steps: string[]
  /** Cap on new cards per day across all sets (each set also has its own limit). */
  new_cards_per_day_total: number
  /** Extra new cards allowed today, from the "Learn more new cards" button. */
  extra_new_cards: { day: string; count: number }
  /** Phase 4 syncs this; for now the theme lives on each device (lib/theme.ts). */
  theme: 'auto' | 'colourful' | 'midnight' | 'notebook' | 'ocean' | 'arcade' | 'clean'
}
