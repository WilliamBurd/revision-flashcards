import { afterEach, describe, expect, it } from 'vitest'
import { FlashcardDB, type SyncedTable } from '../db/db'
import type { Card, Rating, ReviewLog } from '../db/types'
import { newCardSchedule, rateCard } from '../scheduler/fsrs'
import { countPending, syncOnce } from './engine'
import type { Remote, ServerRow } from './remote'
import { replaySchedule } from './replay'

/** An in-memory stand-in for Supabase, with the same rules as supabase/schema.sql. */
class MemoryRemote implements Remote {
  tables = new Map<string, Map<string, ServerRow>>()
  private tick = 0

  private clock() {
    this.tick++
    return new Date(Date.UTC(2026, 9, 1, 12, 0, 0, this.tick)).toISOString()
  }

  async pull(table: SyncedTable, since: string | null, limit: number) {
    const rows = [...(this.tables.get(table)?.values() ?? [])]
      .filter((r) => !since || r.server_updated_at > since)
      .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
    return rows.slice(0, limit).map((r) => structuredClone(r))
  }

  async push(table: SyncedTable, rows: Record<string, unknown>[]) {
    if (!this.tables.has(table)) this.tables.set(table, new Map())
    const t = this.tables.get(table)!
    for (const row of rows) {
      const key = table === 'settings' ? 'me' : (row.id as string)
      const old = t.get(key)
      // The schema's trigger: an older upload never replaces a newer row.
      if (old && (row.updated_at as number) < (old.updated_at as number)) continue
      t.set(key, { ...structuredClone(row), user_id: 'me', server_updated_at: this.clock() })
    }
  }
}

const dbs: FlashcardDB[] = []
let n = 0
function device() {
  const d = new FlashcardDB(`device-${++n}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

const T0 = new Date(2026, 9, 1, 9).getTime()
const base = (id: string, t: number) => ({ id, created_at: t, updated_at: t, deleted: false })

async function addCard(d: FlashcardDB, t = T0) {
  await d.subjects.add({ ...base('subj', t), name: 'History', sort_order: 0, exam_dates: [] })
  await d.sets.add({ ...base('set', t), subject_id: 'subj', name: 'Tudors', sort_order: 0, new_cards_per_day: 20, exam_date_override: null })
  await d.notes.add({ ...base('note', t), set_id: 'set', type: 'basic', front: 'Bosworth?', back: '1485', tags: [], make_reverse: false })
  await d.cards.add({ ...base('card', t), note_id: 'note', set_id: 'set', variant: 'forward', ...newCardSchedule(t), is_leech: false })
}

/** What recordReview does, against a given device. */
async function review(d: FlashcardDB, rating: Rating, at: number, id: string) {
  const card = (await d.cards.get('card'))!
  const log: ReviewLog = { ...base(id, at), card_id: 'card', rating, state_before: card.state, reviewed_at: at, duration_ms: 3000, is_cram: false }
  await d.review_logs.add(log)
  await d.cards.put({ ...card, ...rateCard(card, rating, at), updated_at: at })
}

describe('sync', () => {
  it('copies cards from one device to another', async () => {
    const remote = new MemoryRemote()
    const phone = device()
    const laptop = device()
    await addCard(laptop)
    expect(await countPending(laptop)).toBe(4)

    await syncOnce(laptop, remote)
    expect(await countPending(laptop)).toBe(0)
    await syncOnce(phone, remote)

    expect((await phone.notes.get('note'))?.front).toBe('Bosworth?')
    expect((await phone.cards.get('card'))?.set_id).toBe('set')
    expect(await countPending(phone)).toBe(0)
  })

  it('keeps the most recent edit when both devices change the same card', async () => {
    const remote = new MemoryRemote()
    const phone = device()
    const laptop = device()
    await addCard(laptop)
    await syncOnce(laptop, remote)
    await syncOnce(phone, remote)

    await laptop.notes.update('note', { back: 'Laptop', updated_at: T0 + 2000 })
    await phone.notes.update('note', { back: 'Phone', updated_at: T0 + 1000 })
    // The phone syncs last, but its edit is older, so the laptop's wins everywhere.
    await syncOnce(laptop, remote)
    await syncOnce(phone, remote)
    await syncOnce(laptop, remote)
    expect((await phone.notes.get('note'))?.back).toBe('Laptop')
    expect((await laptop.notes.get('note'))?.back).toBe('Laptop')
  })

  it('sends deletions to other devices', async () => {
    const remote = new MemoryRemote()
    const phone = device()
    const laptop = device()
    await addCard(laptop)
    await syncOnce(laptop, remote)
    await syncOnce(phone, remote)
    await phone.cards.update('card', { deleted: true, updated_at: T0 + 5000 })
    await syncOnce(phone, remote)
    await syncOnce(laptop, remote)
    expect((await laptop.cards.get('card'))?.deleted).toBe(true)
  })

  it('merges reviews of the same card done offline on two devices', async () => {
    const remote = new MemoryRemote()
    const phone = device()
    const laptop = device()
    await addCard(laptop)
    await syncOnce(laptop, remote)
    await syncOnce(phone, remote)

    // Both offline: the laptop reviews in the morning, the phone in the evening.
    const morning = T0 + 60_000
    const evening = T0 + 10 * 3600_000
    await review(laptop, 4, morning, 'log-laptop')
    await review(phone, 1, evening, 'log-phone')

    // Back online. A rebuilt schedule is itself a change to upload, so the
    // engine syncs again straight away; it settles within a few rounds.
    let rounds = 0
    do {
      await syncOnce(phone, remote)
      await syncOnce(laptop, remote)
      rounds++
    } while ((await countPending(phone)) + (await countPending(laptop)) > 0 && rounds < 5)
    expect(rounds).toBeLessThanOrEqual(3)

    const onPhone = (await phone.cards.get('card'))!
    const onLaptop = (await laptop.cards.get('card'))!
    expect(await phone.review_logs.count()).toBe(2)
    expect(await laptop.review_logs.count()).toBe(2)

    // Both devices agree, and the schedule reflects both ratings in time order.
    const expected = replaySchedule(onPhone as Card, await phone.review_logs.toArray(), {
      target_retention: 0.9,
      max_interval_days: 45,
      learning_steps: ['1m', '10m'],
      relearning_steps: ['10m'],
    })
    for (const c of [onPhone, onLaptop]) {
      expect(c.reps).toBe(2)
      expect(c.lapses).toBe(1)
      expect(c.due).toBe(expected.due)
      expect(c.last_review).toBe(evening)
    }
    expect(await countPending(phone)).toBe(0)
    expect(await countPending(laptop)).toBe(0)
  })

  it('uploads everything made before syncing existed', async () => {
    const remote = new MemoryRemote()
    const phone = device()
    await addCard(phone)
    await review(phone, 3, T0 + 1000, 'log-1')
    await syncOnce(phone, remote)
    expect(remote.tables.get('review_logs')?.size).toBe(1)
    expect(remote.tables.get('cards')?.get('card')?.reps).toBe(1)
  })

  it('syncs settings', async () => {
    const remote = new MemoryRemote()
    const phone = device()
    const laptop = device()
    await laptop.settings.put({
      id: 'settings',
      updated_at: T0,
      target_retention: 0.85,
      max_interval_days: 30,
      learning_steps: ['1m', '10m'],
      relearning_steps: ['10m'],
      new_cards_per_day_total: 15,
      extra_new_cards: { day: '', count: 0 },
      theme: 'auto',
    })
    await syncOnce(laptop, remote)
    await syncOnce(phone, remote)
    expect((await phone.settings.get('settings'))?.new_cards_per_day_total).toBe(15)
  })
})
