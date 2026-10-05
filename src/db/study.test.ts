import { beforeEach, describe, expect, it } from 'vitest'
import { pickNext } from '../session/buildQueue'
import { db } from './db'
import { addBasicNote, updateNote } from './notes'
import { allowMoreNewCards, getOverview, loadQueueInput, readyCount, recordReview, undoReview } from './study'
import { countCardsIn, createSet, createSubject, createTopic, deleteSubject, deleteTopic, listSets, setExamDates } from './subjects'

const MIN = 60_000

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('study flow (Phase 1 acceptance)', () => {
  it('adds 20 cards, reviews them, and shows correct counts after reopening', async () => {
    const subject = await createSubject('History')
    const set = await createSet(subject.id, 'Tudors')
    for (let i = 1; i <= 20; i++) await addBasicNote(set.id, `Q${i}`, `A${i}`)

    let overview = await getOverview()
    expect(overview.bySet.get(set.id)).toMatchObject({ total: 20, new: 20, due: 0, newToday: 20 })

    // Review every card once, rating each "Kind Of".
    let lastCardId: string | null = null
    for (let i = 0; i < 20; i++) {
      const next = pickNext(await loadQueueInput({ kind: 'set', id: set.id }, { lastCardId, reviewsSinceNew: 0 }))
      expect(next.card).not.toBeNull()
      await recordReview(next.card!.id, 3, 4000)
      lastCardId = next.card!.id
    }

    // "Reopen": close the database and open it again from storage.
    db.close()
    await db.open()

    overview = await getOverview()
    // All 20 are now in learning, due again in 10 minutes, so none are due right now.
    expect(overview.bySet.get(set.id)).toMatchObject({ total: 20, new: 0, due: 0, newToday: 0 })
    // Ten minutes later they are all due.
    overview = await getOverview(Date.now() + 11 * MIN)
    expect(overview.bySet.get(set.id)?.due).toBe(20)
    expect(await db.review_logs.count()).toBe(20)
  })

  it('caps new cards at 20 a day, and "learn more" raises the cap', async () => {
    const subject = await createSubject('Politics')
    const set = await createSet(subject.id, 'UK Constitution')
    for (let i = 0; i < 30; i++) await addBasicNote(set.id, `Q${i}`, `A${i}`)
    const cards = await db.cards.toArray()
    for (const c of cards.slice(0, 20)) await recordReview(c.id, 3, 1000)

    let overview = await getOverview()
    expect(overview.bySet.get(set.id)).toMatchObject({ new: 10, newToday: 0 })

    await allowMoreNewCards(10)
    overview = await getOverview()
    expect(overview.bySet.get(set.id)?.newToday).toBe(10)
  })

  it('flags a card as a leech after 6 "No Idea" ratings', async () => {
    const subject = await createSubject('History')
    const set = await createSet(subject.id, 'Tudors')
    await addBasicNote(set.id, 'Q', 'A')
    const [card] = await db.cards.toArray()
    let t = Date.now()
    for (let i = 0; i < 5; i++) {
      const { card: c } = await recordReview(card.id, 1, 1000, t)
      expect(c.is_leech).toBe(false)
      t += 2 * MIN
    }
    expect((await recordReview(card.id, 1, 1000, t)).card.is_leech).toBe(true)
  })

  it('editing a note keeps the card schedule', async () => {
    const subject = await createSubject('History')
    const set = await createSet(subject.id, 'Tudors')
    const note = await addBasicNote(set.id, 'Battle of Bosworth?', '1458')
    const [card] = await db.cards.toArray()
    const { card: rated } = await recordReview(card.id, 4, 1000)
    await updateNote(note.id, { back: '1485' })
    const after = await db.cards.get(card.id)
    expect(after?.due).toBe(rated.due)
    expect(after?.reps).toBe(1)
    expect((await db.notes.get(note.id))?.back).toBe('1485')
  })

  it('deleting a subject removes its sets and cards', async () => {
    const subject = await createSubject('History')
    const set = await createSet(subject.id, 'Tudors')
    await addBasicNote(set.id, 'Q', 'A')
    await addBasicNote(set.id, 'Q2', 'A2')
    expect(await countCardsIn({ subjectId: subject.id })).toBe(2)
    await deleteSubject(subject.id)
    expect((await getOverview()).bySet.size).toBe(0)
    expect((await db.cards.toArray()).every((c) => c.deleted)).toBe(true)
  })
})

describe('cram and undo (Phase 4)', () => {
  it('cram ratings leave due dates unchanged', async () => {
    const subject = await createSubject('History')
    const set = await createSet(subject.id, 'Tudors')
    for (let i = 0; i < 3; i++) await addBasicNote(set.id, `Q${i}`, `A${i}`)
    const cards = await db.cards.toArray()
    await recordReview(cards[0].id, 3, 1000)
    const before = await db.cards.toArray()
    for (const c of before) await recordReview(c.id, 1, 1000, Date.now(), { cram: true })
    expect(await db.cards.toArray()).toEqual(before)
    // Logged, but not counted towards today's new cards.
    expect((await db.review_logs.toArray()).filter((l) => l.is_cram)).toHaveLength(3)
    expect((await getOverview()).bySet.get(set.id)?.newToday).toBe(2)
  })

  it('undo puts the schedule back and deletes the log', async () => {
    const subject = await createSubject('History')
    const set = await createSet(subject.id, 'Tudors')
    await addBasicNote(set.id, 'Q', 'A')
    const [card] = await db.cards.toArray()
    const result = await recordReview(card.id, 4, 1000)
    expect(result.card.due).not.toBe(card.due)
    await undoReview(result)
    const after = await db.cards.get(card.id)
    expect({ ...after, updated_at: 0, dirty: 0 }).toEqual({ ...card, updated_at: 0, dirty: 0 })
    expect((await db.review_logs.get(result.logId))?.deleted).toBe(true)
  })

  it('no card counts as due after its exam', async () => {
    const subject = await createSubject('History')
    const set = await createSet(subject.id, 'Tudors')
    await addBasicNote(set.id, 'Q', 'A')
    const [card] = await db.cards.toArray()
    await recordReview(card.id, 4, 1000)
    const now = Date.now()
    // Pretend it is known for a month, then add an exam in 5 days.
    await db.cards.update(card.id, { state: 2, due: now + 30 * 24 * 3600_000, scheduled_days: 30 })
    const exam = new Date(now + 5 * 24 * 3600_000)
    const date = `${exam.getFullYear()}-${String(exam.getMonth() + 1).padStart(2, '0')}-${String(exam.getDate()).padStart(2, '0')}`
    await setExamDates(subject.id, [{ name: 'Paper 1', date }])
    expect((await getOverview(now)).bySet.get(set.id)?.due).toBe(0)
    expect((await getOverview(now + 4 * 24 * 3600_000 + 3600_000)).bySet.get(set.id)?.due).toBe(1)
  })
})

describe('new card limit per topic', () => {
  it('gives each subject without topics its own 20 new cards a day', async () => {
    const history = await createSubject('History')
    const politics = await createSubject('Politics')
    const tudors = await createSet(history.id, 'Tudors')
    const stuarts = await createSet(history.id, 'Stuarts')
    const uk = await createSet(politics.id, 'UK')
    for (let i = 0; i < 15; i++) {
      await addBasicNote(tudors.id, `T${i}`, 'A')
      await addBasicNote(stuarts.id, `S${i}`, 'A')
      await addBasicNote(uk.id, `U${i}`, 'A')
    }
    // Study 20 new History cards.
    for (const c of (await db.cards.toArray()).filter((c) => c.set_id !== uk.id).slice(0, 20)) await recordReview(c.id, 3, 1000)

    const overview = await getOverview()
    expect(readyCount(overview, [tudors.id, stuarts.id]).newToday).toBe(0)
    expect(readyCount(overview, [uk.id]).newToday).toBe(15)
    const next = pickNext(await loadQueueInput({ kind: 'subject', id: politics.id }, { lastCardId: null, reviewsSinceNew: 0 }))
    expect(next.card?.set_id).toBe(uk.id)
  })
})

describe('topics', () => {
  it('gives each topic in a subject its own 20 new cards a day and its own review', async () => {
    const history = await createSubject('History')
    const britain = await createTopic(history.id, '1900s Britain')
    const tudors = await createTopic(history.id, 'Tudors')
    const culture = await createSet(history.id, 'Culture', britain.id)
    const economics = await createSet(history.id, 'Economics', britain.id)
    const henry = await createSet(history.id, 'Henry VII', tudors.id)
    const loose = await createSet(history.id, 'Loose cards')
    for (let i = 0; i < 15; i++) {
      await addBasicNote(culture.id, `C${i}`, 'A')
      await addBasicNote(economics.id, `E${i}`, 'A')
      await addBasicNote(henry.id, `H${i}`, 'A')
      await addBasicNote(loose.id, `L${i}`, 'A')
    }
    // Study 20 new cards from 1900s Britain (culture and economics together).
    let lastCardId: string | null = null
    for (let i = 0; i < 20; i++) {
      const next = pickNext(await loadQueueInput({ kind: 'topic', id: britain.id }, { lastCardId, reviewsSinceNew: 0 }))
      expect([culture.id, economics.id]).toContain(next.card!.set_id)
      await recordReview(next.card!.id, 3, 1000)
      lastCardId = next.card!.id
    }

    const overview = await getOverview()
    expect(readyCount(overview, [culture.id, economics.id]).newToday).toBe(0)
    expect(readyCount(overview, [henry.id]).newToday).toBe(15)
    expect(readyCount(overview, [loose.id]).newToday).toBe(15)
    const tudorQueue = await loadQueueInput({ kind: 'topic', id: tudors.id }, { lastCardId: null, reviewsSinceNew: 0 })
    expect(new Set(tudorQueue.cards.map((c) => c.set_id))).toEqual(new Set([henry.id]))
    const looseQueue = await loadQueueInput({ kind: 'topic', id: `subject:${history.id}` }, { lastCardId: null, reviewsSinceNew: 0 })
    expect(new Set(looseQueue.cards.map((c) => c.set_id))).toEqual(new Set([loose.id]))
  })

  it('keeps the sets and cards when a topic is deleted', async () => {
    const history = await createSubject('History')
    const britain = await createTopic(history.id, '1900s Britain')
    const culture = await createSet(history.id, 'Culture', britain.id)
    await addBasicNote(culture.id, 'Q', 'A')
    await deleteTopic(britain.id)
    expect((await listSets()).find((s) => s.id === culture.id)?.topic_id).toBeNull()
    expect(await countCardsIn({ setId: culture.id })).toBe(1)
  })
})
