import { describe, expect, it } from 'vitest'
import { asSyncWrite, FlashcardDB } from './db'

const subject = (id: string) => ({
  id,
  name: 'History',
  sort_order: 0,
  exam_dates: [],
  created_at: 1,
  updated_at: 1,
  deleted: false,
})

describe('dirty tracking', () => {
  it('marks local creates and updates dirty, but not sync writes', async () => {
    const db = new FlashcardDB('dirty-test')
    await db.subjects.add(subject('a'))
    expect((await db.subjects.get('a'))?.dirty).toBe(1)

    await asSyncWrite(db, ['subjects'], async () => {
      await db.subjects.update('a', { dirty: 0 })
      await db.subjects.put({ ...subject('b'), dirty: 0 })
      await db.subjects.put({ ...subject('a'), name: 'From server', dirty: 0 })
    })
    expect((await db.subjects.get('a'))?.dirty).toBe(0)
    expect((await db.subjects.get('b'))?.dirty).toBe(0)

    await db.subjects.update('a', { name: 'Renamed' })
    expect((await db.subjects.get('a'))?.dirty).toBe(1)
    await db.subjects.where('id').equals('b').modify({ name: 'Bulk' })
    expect((await db.subjects.get('b'))?.dirty).toBe(1)
    await db.delete()
  })
})
