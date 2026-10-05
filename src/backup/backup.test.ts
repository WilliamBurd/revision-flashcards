import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { addBasicNote, addNote } from '../db/notes'
import { recordReview } from '../db/study'
import { createSet, createSubject, createTopic, deleteSet } from '../db/subjects'
import { exportBackup, importBackup, readBackup } from './backup'
import { exportSetCsv, importCsv } from './cards-csv'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const strip = <T extends { dirty?: number; updated_at: number }>(rows: T[]) =>
  rows.map(({ dirty: _d, updated_at: _u, ...r }) => r).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

async function snapshot() {
  return {
    subjects: strip(await db.subjects.toArray()),
    topics: strip(await db.topics.toArray()),
    sets: strip(await db.sets.toArray()),
    notes: strip(await db.notes.toArray()),
    cards: strip(await db.cards.toArray()),
    review_logs: strip(await db.review_logs.toArray()),
  }
}

async function makeLibrary() {
  const subject = await createSubject('History')
  const topic = await createTopic(subject.id, 'Early modern England')
  const set = await createSet(subject.id, 'Tudors', topic.id)
  for (let i = 0; i < 5; i++) await addBasicNote(set.id, `Q${i}`, `A${i}`)
  await addNote({ setId: set.id, type: 'cloze', front: '{{1485}} Bosworth, {{Henry VII}} wins', back: '', tags: ['battles'] })
  const cards = await db.cards.toArray()
  for (const [i, c] of cards.entries()) await recordReview(c.id, ((i % 4) + 1) as 1 | 2 | 3 | 4, 3000)
  return { subject, set }
}

describe('backup (Phase 4 acceptance)', () => {
  it('an exported file re-imports with no lost cards or progress', async () => {
    await makeLibrary()
    const before = await snapshot()
    const file = JSON.stringify(await exportBackup())

    // Wipe the device, as if on a new phone.
    await Promise.all(db.tables.map((t) => t.clear()))
    await importBackup(readBackup(JSON.parse(file)))

    expect(await snapshot()).toEqual(before)
  })

  it('importing twice makes no duplicates, and keeps newer progress here', async () => {
    await makeLibrary()
    const backup = await exportBackup()
    const card = (await db.cards.toArray())[0]
    const reviewed = (await recordReview(card.id, 4, 1000, Date.now() + 1000)).card

    const result = await importBackup(backup)
    expect(result).toMatchObject({ cards: 0, reviews: 0 })
    expect((await db.cards.get(card.id))?.due).toBe(reviewed.due)
    expect(await db.cards.count()).toBe(backup.cards.length)
  })

  it('brings back a set deleted since the backup', async () => {
    const { set } = await makeLibrary()
    const backup = await exportBackup({ setId: set.id })
    await deleteSet(set.id)
    await importBackup(backup)
    expect((await db.cards.toArray()).every((c) => !c.deleted)).toBe(true)
    expect((await db.sets.get(set.id))?.deleted).toBe(false)
  })

  it('rejects files that are not backups', () => {
    expect(() => readBackup({ hello: 1 })).toThrow(/isn't a Burdis Flashcards backup/)
  })

  it('a set exported as CSV imports into another set with the same cards', async () => {
    const { subject, set } = await makeLibrary()
    const other = await createSet(subject.id, 'Copy')
    const result = await importCsv(await exportSetCsv(set.id), other.id)
    expect(result.notes).toHaveLength(6)
    const count = async (id: string) => (await db.cards.where('set_id').equals(id).toArray()).length
    expect(await count(other.id)).toBe(await count(set.id))
  })
})
