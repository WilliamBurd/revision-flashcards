import { newId } from '../lib/ids'
import { db } from './db'
import { DEFAULT_NEW_CARDS_PER_SET } from './settings'
import type { CardSet, ExamDate, Subject } from './types'

const byOrder = (a: { sort_order: number; created_at: number }, b: { sort_order: number; created_at: number }) =>
  a.sort_order - b.sort_order || a.created_at - b.created_at

export async function listSubjects(): Promise<Subject[]> {
  return (await db.subjects.toArray()).filter((s) => !s.deleted).sort(byOrder)
}

export async function listSets(): Promise<CardSet[]> {
  return (await db.sets.toArray()).filter((s) => !s.deleted).sort(byOrder)
}

export async function createSubject(name: string): Promise<Subject> {
  const now = Date.now()
  const subjects = await listSubjects()
  const subject: Subject = {
    id: newId(),
    name: name.trim(),
    sort_order: subjects.length ? Math.max(...subjects.map((s) => s.sort_order)) + 1 : 0,
    exam_dates: [],
    created_at: now,
    updated_at: now,
    deleted: false,
  }
  await db.subjects.add(subject)
  return subject
}

export async function renameSubject(id: string, name: string): Promise<void> {
  await db.subjects.update(id, { name: name.trim(), updated_at: Date.now() })
}

export async function setExamDates(id: string, exams: ExamDate[]): Promise<void> {
  const clean = exams
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map((e) => ({ name: e.name.trim(), date: e.date }))
    .sort((a, b) => a.date.localeCompare(b.date))
  await db.subjects.update(id, { exam_dates: clean, updated_at: Date.now() })
}

export async function createSet(subjectId: string, name: string): Promise<CardSet> {
  const now = Date.now()
  const siblings = (await listSets()).filter((s) => s.subject_id === subjectId)
  const set: CardSet = {
    id: newId(),
    subject_id: subjectId,
    name: name.trim(),
    sort_order: siblings.length ? Math.max(...siblings.map((s) => s.sort_order)) + 1 : 0,
    new_cards_per_day: DEFAULT_NEW_CARDS_PER_SET,
    exam_date_override: null,
    created_at: now,
    updated_at: now,
    deleted: false,
  }
  await db.sets.add(set)
  return set
}

export async function updateSet(
  id: string,
  changes: Partial<Pick<CardSet, 'name' | 'new_cards_per_day' | 'exam_date_override'>>,
): Promise<void> {
  await db.sets.update(id, { ...changes, updated_at: Date.now() })
}

/** How many cards would go if this subject or set were deleted. */
export async function countCardsIn(scope: { subjectId?: string; setId?: string }): Promise<number> {
  const setIds = scope.setId
    ? [scope.setId]
    : (await listSets()).filter((s) => s.subject_id === scope.subjectId).map((s) => s.id)
  const cards = await db.cards.where('set_id').anyOf(setIds).toArray()
  return cards.filter((c) => !c.deleted).length
}

/** Soft-delete a set and everything in it. */
export async function deleteSet(id: string): Promise<void> {
  await db.transaction('rw', db.sets, db.notes, db.cards, async () => {
    const now = Date.now()
    const gone = { deleted: true, updated_at: now }
    await db.sets.update(id, gone)
    await db.notes.where('set_id').equals(id).modify(gone)
    await db.cards.where('set_id').equals(id).modify(gone)
  })
}

/** Soft-delete a subject, its sets, and every card in them. */
export async function deleteSubject(id: string): Promise<void> {
  await db.transaction('rw', db.subjects, db.sets, db.notes, db.cards, async () => {
    const now = Date.now()
    const gone = { deleted: true, updated_at: now }
    const setIds = (await db.sets.where('subject_id').equals(id).toArray()).map((s) => s.id)
    await db.subjects.update(id, gone)
    await db.sets.where('subject_id').equals(id).modify(gone)
    await db.notes.where('set_id').anyOf(setIds).modify(gone)
    await db.cards.where('set_id').anyOf(setIds).modify(gone)
  })
}
