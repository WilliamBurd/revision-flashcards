import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import {
  allowMoreNewCards,
  intervalsFor,
  loadQueueInput,
  recordReview,
  setIdsInScope,
  undoReview,
  type ReviewResult,
  type Scope,
} from '../db/study'
import { CardState, type Card, type Note, type Rating } from '../db/types'
import { pickNext } from './buildQueue'
import { cramAfterRating, shuffle } from './cram'

export type SessionState =
  | { phase: 'loading' }
  | { phase: 'question' | 'answer'; card: Card; note: Note; remaining: number }
  | { phase: 'waiting'; nextDue: number }
  | { phase: 'done'; newHeldBack: number }

export interface SessionSummary {
  reviewed: number
  noIdea: number
  /** Time spent answering, adding up the time on each card. */
  timeMs: number
}

interface UndoEntry {
  result: ReviewResult
  rating: Rating
  durationMs: number
  lastCardId: string | null
  reviewsSinceNew: number
  cramQueue: string[] | null
}

/**
 * Runs a review session: picks the next card from fresh database data after
 * every rating, and saves each rating the moment it's made.
 *
 * In cram mode every card in the scope comes up once in a random order, and
 * cards rated No Idea come back a few cards later. Cram ratings are logged
 * but never change a card's schedule.
 */
export function useReviewSession(scope: Scope, cram = false) {
  const [state, setState] = useState<SessionState>({ phase: 'loading' })
  const [summary, setSummary] = useState<SessionSummary>({ reviewed: 0, noIdea: 0, timeMs: 0 })
  const [intervals, setIntervals] = useState<Record<Rating, { label: string }> | null>(null)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const session = useRef({
    lastCardId: null as string | null,
    reviewsSinceNew: 0,
    shownAt: 0,
    busy: false,
    cramQueue: null as string[] | null,
  })
  const scopeKey = JSON.stringify(scope)

  const show = useCallback(async (card: Card, remaining: number) => {
    const note = await db.notes.get(card.note_id)
    if (!note) return false
    session.current.shownAt = Date.now()
    setIntervals(null)
    setState({ phase: 'question', card, note, remaining })
    return true
  }, [])

  const loadNext = useCallback(async () => {
    const s = session.current
    if (cram) {
      if (s.cramQueue === null) {
        const setIds = new Set(await setIdsInScope(JSON.parse(scopeKey) as Scope))
        const cards = (await db.cards.toArray()).filter((c) => !c.deleted && setIds.has(c.set_id))
        s.cramQueue = shuffle(cards.map((c) => c.id))
      }
      while (s.cramQueue.length) {
        const card = await db.cards.get(s.cramQueue[0])
        if (card && !card.deleted && (await show(card, s.cramQueue.length))) return
        s.cramQueue = s.cramQueue.slice(1) // deleted meanwhile
      }
      setState({ phase: 'done', newHeldBack: 0 })
      return
    }
    const input = await loadQueueInput(JSON.parse(scopeKey) as Scope, s)
    const next = pickNext(input)
    if (!next.card) {
      setState(next.nextLearningDue ? { phase: 'waiting', nextDue: next.nextLearningDue } : { phase: 'done', newHeldBack: next.newHeldBack })
      return
    }
    // A card without its note can't be shown; treat it as gone.
    if (!(await show(next.card, next.remaining))) setState({ phase: 'done', newHeldBack: next.newHeldBack })
  }, [scopeKey, cram, show])

  useEffect(() => {
    void loadNext()
  }, [loadNext])

  // While waiting for a learning card, check again when it's due.
  useEffect(() => {
    if (state.phase !== 'waiting') return
    const timer = setTimeout(() => void loadNext(), Math.max(1000, state.nextDue - Date.now() + 500))
    return () => clearTimeout(timer)
  }, [state, loadNext])

  const reveal = useCallback(async () => {
    if (state.phase !== 'question') return
    if (cram) {
      setIntervals({ 1: { label: 'Again' }, 2: { label: 'Done' }, 3: { label: 'Done' }, 4: { label: 'Done' } })
    } else {
      setIntervals(await intervalsFor(state.card))
    }
    setState({ ...state, phase: 'answer' })
  }, [state, cram])

  const rate = useCallback(
    async (rating: Rating) => {
      if (state.phase !== 'answer' || session.current.busy) return
      const s = session.current
      s.busy = true
      try {
        const { card } = state
        const durationMs = Date.now() - s.shownAt
        const result = await recordReview(card.id, rating, durationMs, Date.now(), { cram })
        setUndoStack((u) => [
          ...u,
          { result, rating, durationMs, lastCardId: s.lastCardId, reviewsSinceNew: s.reviewsSinceNew, cramQueue: s.cramQueue },
        ])
        s.lastCardId = card.id
        s.reviewsSinceNew = card.state === CardState.New ? 0 : s.reviewsSinceNew + 1
        if (s.cramQueue) s.cramQueue = cramAfterRating(s.cramQueue, rating)
        setSummary((m) => ({ reviewed: m.reviewed + 1, noIdea: m.noIdea + (rating === 1 ? 1 : 0), timeMs: m.timeMs + durationMs }))
        await loadNext()
      } finally {
        s.busy = false
      }
    },
    [state, cram, loadNext],
  )

  /** Take back the last rating and show that card again. */
  const undo = useCallback(async () => {
    const last = undoStack[undoStack.length - 1]
    const s = session.current
    if (!last || s.busy) return
    s.busy = true
    try {
      await undoReview(last.result)
      setUndoStack((u) => u.slice(0, -1))
      s.lastCardId = last.lastCardId
      s.reviewsSinceNew = last.reviewsSinceNew
      s.cramQueue = last.cramQueue
      setSummary((m) => ({
        reviewed: m.reviewed - 1,
        noIdea: m.noIdea - (last.rating === 1 ? 1 : 0),
        timeMs: m.timeMs - last.durationMs,
      }))
      const card = await db.cards.get(last.result.before.id)
      if (card && !card.deleted) {
        const remaining = s.cramQueue ? s.cramQueue.length : Math.max(1, state.phase === 'question' || state.phase === 'answer' ? state.remaining + 1 : 1)
        await show(card, remaining)
      } else {
        await loadNext()
      }
    } finally {
      s.busy = false
    }
  }, [undoStack, state, show, loadNext])

  /** Reload the current card after its note was edited mid-review. */
  const refreshNote = useCallback(async () => {
    if (state.phase !== 'question' && state.phase !== 'answer') return
    const [note, card] = await Promise.all([db.notes.get(state.note.id), db.cards.get(state.card.id)])
    // Removing a cloze blank or a reverse card can delete the card being shown.
    if (!note || note.deleted || !card || card.deleted) return void loadNext()
    // Keep whatever phase the card is in now; only swap in the new text.
    setState((s) => ((s.phase === 'question' || s.phase === 'answer') && s.card.id === card.id ? { ...s, note, card } : s))
  }, [state, loadNext])

  const learnMore = useCallback(
    async (count: number) => {
      await allowMoreNewCards(count)
      await loadNext()
    },
    [loadNext],
  )

  return { state, summary, reviewed: summary.reviewed, intervals, reveal, rate, undo, canUndo: undoStack.length > 0, refreshNote, learnMore, loadNext }
}
