// Keeps this device and the cloud in step.
//
// Every change is saved on the device first and marked dirty (see db/db.ts).
// A sync then:
//   1. uploads every dirty record,
//   2. downloads everything changed in the cloud since the last sync, keeping
//      whichever version of a record was edited most recently, and
//   3. rebuilds the schedule of any card reviewed on more than one device
//      while offline, from the merged review logs (see replay.ts).
//
// Syncs run after sign-in, shortly after any local change, when the device
// comes back online, when the app is reopened, and every 30 seconds while it's
// open, so a card added on one device shows up on the others within a minute.

import { asSyncWrite, onLocalChanges, SYNCED_TABLES, type FlashcardDB, type SyncedTable } from '../db/db'
import { DEFAULT_SETTINGS } from '../db/settings'
import type { Card, ReviewLog, Settings } from '../db/types'
import type { Remote, ServerRow } from './remote'
import { replaySchedule, sameSchedule } from './replay'
import { examDatesFor } from '../scheduler/exams'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error'

export interface SyncStatus {
  state: SyncState
  /** Local changes not yet uploaded. */
  pending: number
  lastSyncedAt: number | null
  error: string | null
}

const PAGE = 1000
const PUSH_BATCH = 500
/** Re-read a little before the last pull, in case a slow write landed late. */
const PULL_OVERLAP_MS = 2 * 60_000
const POLL_MS = 30_000
const CHANGE_DELAY_MS = 1500

type Row = Record<string, unknown> & { id: string; updated_at: number; dirty?: number }

// ---- converting between device and cloud rows ----

export function toServer(table: SyncedTable, row: Row): Record<string, unknown> {
  const { dirty, ...rest } = row
  if (table === 'settings') {
      const { id, updated_at, ...data } = rest
    return { data, updated_at }
  }
  return rest
}

export function fromServer(table: SyncedTable, row: ServerRow): Row {
  const { user_id, server_updated_at, ...rest } = row
  if (table === 'settings') {
    const data = (rest.data ?? {}) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...data, id: 'settings', updated_at: Number(rest.updated_at) } as unknown as Row
  }
  return rest as Row
}

function sameContent(a: Row, b: Row): boolean {
  const strip = ({ dirty: _d, ...r }: Row) => JSON.stringify(r, Object.keys(r).sort())
  return strip(a) === strip(b)
}

// ---- one sync ----

export async function syncOnce(db: FlashcardDB, remote: Remote, now = Date.now()): Promise<void> {
  await pushAll(db, remote)
  await pullAll(db, remote, now)
}

async function pushAll(db: FlashcardDB, remote: Remote): Promise<void> {
  for (const table of SYNCED_TABLES) {
    const dirty = (await db.table(table).where('dirty').equals(1).toArray()) as Row[]
    for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
      const batch = dirty.slice(i, i + PUSH_BATCH)
      await remote.push(
        table,
        batch.map((r) => toServer(table, r)),
      )
      // Mark clean, unless the record changed again while it was uploading.
      await asSyncWrite(db, [table], async () => {
        for (const sent of batch) {
          const current = (await db.table(table).get(sent.id)) as Row | undefined
          if (current && sameContent(current, sent)) await db.table(table).update(sent.id, { dirty: 0 })
        }
      })
    }
  }
}

async function pullAll(db: FlashcardDB, remote: Remote, now: number): Promise<void> {
  const toReplay = new Set<string>()

  for (const table of SYNCED_TABLES) {
    const key = `pulled:${table}`
    const last = (await db.meta.get(key))?.value as string | undefined
    let since = last ? new Date(new Date(last).getTime() - PULL_OVERLAP_MS).toISOString() : null
    let newest = last ?? null

    for (;;) {
      const rows = await remote.pull(table, since, PAGE)
      if (!rows.length) break
      await asSyncWrite(db, [table], async () => {
        for (const serverRow of rows) {
          const incoming = fromServer(table, serverRow)
          const local = (await db.table(table).get(incoming.id)) as Row | undefined
          if (table === 'review_logs' && !local) toReplay.add((incoming as unknown as ReviewLog).card_id)
          if (local?.dirty && local.updated_at >= incoming.updated_at) {
            // Ours is newer and still waiting to upload: keep it.
            if (table === 'cards') toReplay.add(local.id)
            continue
          }
          if (local?.dirty && table === 'cards') toReplay.add(local.id)
          await db.table(table).put({ ...incoming, dirty: 0 })
        }
      })
      since = rows[rows.length - 1].server_updated_at
      if (!newest || since > newest) newest = since
      if (rows.length < PAGE) break
    }
    if (newest && newest !== last) {
      await asSyncWrite(db, ['meta'], () => db.meta.put({ key, value: newest }))
    }
  }

  if (toReplay.size) await replayCards(db, [...toReplay], now)
}

async function replayCards(db: FlashcardDB, cardIds: string[], now: number): Promise<void> {
  const settings = { ...DEFAULT_SETTINGS, ...(await db.settings.get('settings')) }
  await asSyncWrite(db, ['cards', 'review_logs', 'sets', 'subjects'], async () => {
    for (const id of cardIds) {
      const card = (await db.cards.get(id)) as Card | undefined
      if (!card) continue
      const logs = await db.review_logs.where('card_id').equals(id).toArray()
      if (!logs.some((l) => !l.deleted && !l.is_cram)) continue
      const set = await db.sets.get(card.set_id)
      const subject = set ? await db.subjects.get(set.subject_id) : undefined
      const schedule = replaySchedule(card, logs, settings, examDatesFor(subject, set))
      if (sameSchedule(card, schedule)) continue
      // The rebuilt schedule is a new change: save it and upload it next sync.
      await db.cards.put({ ...card, ...schedule, updated_at: Math.max(now, card.updated_at + 1), dirty: 1 })
    }
  })
}

export async function countPending(db: FlashcardDB): Promise<number> {
  let n = 0
  for (const table of SYNCED_TABLES) n += await db.table(table).where('dirty').equals(1).count()
  return n
}

// ---- running syncs in the background ----

export class SyncEngine {
  private status: SyncStatus = { state: 'idle', pending: 0, lastSyncedAt: null, error: null }
  private listeners = new Set<(s: SyncStatus) => void>()
  private running: Promise<void> | null = null
  private again = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private stops: (() => void)[] = []

  constructor(
    private db: FlashcardDB,
    private remote: Remote,
  ) {}

  getStatus(): SyncStatus {
    return this.status
  }

  subscribe(listener: (s: SyncStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    const soon = () => this.schedule(CHANGE_DELAY_MS)
    const now = () => void this.sync()
    const onVisible = () => document.visibilityState === 'visible' && now()
    const poll = setInterval(() => document.visibilityState === 'visible' && now(), POLL_MS)

    this.stops.push(onLocalChanges(() => {
      void this.refreshPending()
      soon()
    }))
    window.addEventListener('online', now)
    window.addEventListener('offline', now)
    document.addEventListener('visibilitychange', onVisible)
    this.stops.push(
      () => window.removeEventListener('online', now),
      () => window.removeEventListener('offline', now),
      () => document.removeEventListener('visibilitychange', onVisible),
      () => clearInterval(poll),
      () => this.timer && clearTimeout(this.timer),
    )
    now()
  }

  stop(): void {
    this.stops.forEach((s) => s())
    this.stops = []
  }

  /** Run a sync now (or straight after the one in progress). */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = this.run().finally(() => {
      this.running = null
      if (this.again) {
        this.again = false
        void this.sync()
      }
    })
    return this.running
  }

  private schedule(delay: number) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.sync(), delay)
  }

  private async run(): Promise<void> {
    if (!navigator.onLine) {
      this.set({ state: 'offline', pending: await countPending(this.db) })
      return
    }
    this.set({ state: 'syncing' })
    try {
      await syncOnce(this.db, this.remote)
      const pending = await countPending(this.db)
      this.set({ state: pending ? 'pending' : 'synced', pending, lastSyncedAt: Date.now(), error: null })
      // Rebuilt schedules from this sync still need uploading.
      if (pending) this.schedule(CHANGE_DELAY_MS)
    } catch (e) {
      const pending = await countPending(this.db)
      const offline = !navigator.onLine
      this.set({ state: offline ? 'offline' : 'error', pending, error: offline ? null : String((e as Error).message ?? e) })
      // Try again in a bit.
      this.schedule(POLL_MS)
    }
  }

  private async refreshPending() {
    const pending = await countPending(this.db)
    if (this.status.state === 'syncing') return this.set({ pending })
    this.set({ pending, state: !navigator.onLine ? 'offline' : pending ? 'pending' : this.status.state })
  }

  private set(changes: Partial<SyncStatus>) {
    this.status = { ...this.status, ...changes }
    this.listeners.forEach((l) => l(this.status))
  }
}
