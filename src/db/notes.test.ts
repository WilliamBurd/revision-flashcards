import { beforeEach, describe, expect, it } from 'vitest'
import { parseBulk } from '../notes/bulk'
import { db } from './db'
import { addNote, addNotes, addTagToNotes, allTags, deleteNotes, moveNotes, removeTagFromNotes, updateNote } from './notes'
import { recordReview } from './study'
import { createSet, createSubject } from './subjects'
import { CardState } from './types'

let setId = ''
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  const subject = await createSubject('History')
  setId = (await createSet(subject.id, 'Stuarts')).id
})

const liveCards = async (noteId: string) =>
  (await db.cards.where('note_id').equals(noteId).toArray()).filter((c) => !c.deleted).sort((a, b) => a.variant.localeCompare(b.variant))

describe('Phase 3 acceptance', () => {
  it('pasting 30 lines creates 30 correct cards, in order', async () => {
    const text = Array.from({ length: 30 }, (_, i) => `Q${i + 1} - A${i + 1}`).join('\n')
    const lines = parseBulk(text)
    const notes = await addNotes(
      lines.map((l) => ({ setId, type: 'basic' as const, front: l.kind === 'basic' ? l.front : '', back: l.kind === 'basic' ? l.back : '' })),
    )
    expect(await db.cards.count()).toBe(30)
    const sorted = (await db.notes.toArray()).sort((a, b) => a.created_at - b.created_at)
    expect(sorted.map((n) => n.front)).toEqual(notes.map((n) => n.front))
    expect(sorted[29]).toMatchObject({ front: 'Q30', back: 'A30', set_id: setId, type: 'basic' })
  })

  it('a cloze note with 3 blanks creates 3 cards', async () => {
    const note = await addNote({ setId, type: 'cloze', front: 'In {{1688}}, {{William III}} and {{Mary II}} took the throne', back: '' })
    expect((await liveCards(note.id)).map((c) => c.variant)).toEqual(['1', '2', '3'])
  })
})

describe('editing notes keeps schedules', () => {
  it('adding a blank in the middle keeps the others’ progress', async () => {
    const note = await addNote({ setId, type: 'cloze', front: '{{1688}} brought {{William III}}', back: '' })
    const [first, second] = await liveCards(note.id)
    await recordReview(second.id, 3, 1000)
    const reviewed = await db.cards.get(second.id)

    await updateNote(note.id, { front: '{{1688}} brought {{Mary II}} and {{William III}}' })
    const cards = await liveCards(note.id)
    expect(cards).toHaveLength(3)
    const william = cards.find((c) => c.id === second.id)!
    expect(william.variant).toBe('3')
    expect(william.state).toBe(reviewed!.state)
    expect(william.due).toBe(reviewed!.due)
    expect(cards.find((c) => c.id === first.id)!.variant).toBe('1')
    expect(cards.find((c) => c.variant === '2')!.state).toBe(CardState.New)
  })

  it('removing a blank and putting it back restores its card', async () => {
    const note = await addNote({ setId, type: 'cloze', front: '{{a}} and {{b}}', back: '' })
    const b = (await liveCards(note.id))[1]
    await recordReview(b.id, 4, 1000)
    await updateNote(note.id, { front: '{{a}} and b' })
    expect(await liveCards(note.id)).toHaveLength(1)
    await updateNote(note.id, { front: '{{a}} and {{b}}' })
    const back = (await liveCards(note.id)).find((c) => c.id === b.id)
    expect(back?.state).not.toBe(CardState.New)
  })

  it('turns the reverse card on and off', async () => {
    const note = await addNote({ setId, type: 'basic', front: 'Q', back: 'A', makeReverse: true })
    expect((await liveCards(note.id)).map((c) => c.variant)).toEqual(['forward', 'reverse'])
    await updateNote(note.id, { make_reverse: false })
    expect((await liveCards(note.id)).map((c) => c.variant)).toEqual(['forward'])
    await updateNote(note.id, { make_reverse: true })
    expect((await liveCards(note.id)).map((c) => c.variant)).toEqual(['forward', 'reverse'])
  })
})

describe('bulk actions and tags', () => {
  it('moves, tags and deletes several notes at once', async () => {
    const subject = await createSubject('Politics')
    const other = await createSet(subject.id, 'Constitution')
    const [a, b] = await addNotes([
      { setId, type: 'basic', front: 'A', back: '1', tags: ['key date', 'Key Date', ' '] },
      { setId, type: 'cloze', front: '{{x}} {{y}}', back: '' },
    ])
    expect(a.tags).toEqual(['key date'])

    await moveNotes([a.id, b.id], other.id)
    expect((await db.cards.toArray()).every((c) => c.set_id === other.id)).toBe(true)

    await addTagToNotes([a.id, b.id], 'exam Q')
    await removeTagFromNotes([a.id], 'KEY DATE')
    expect((await db.notes.get(a.id))!.tags).toEqual(['exam Q'])
    expect(await allTags()).toEqual(['exam Q'])

    await deleteNotes([a.id, b.id])
    expect((await db.cards.toArray()).every((c) => c.deleted)).toBe(true)
  })
})
