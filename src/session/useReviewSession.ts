import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import { getSettings } from '../db/settings'
import { allowMoreNewCards, loadQueueInput, recordReview, type Scope } from '../db/study'
import { CardState, type Card, type Note, type Rating } from '../db/types'
import { makeScheduler, previewIntervals } from '../scheduler/fsrs'
import { pickNext } from './buildQueue'

export type SessionState =
  | { phase: 'loading' }
  | { phase: 'question' | 'answer'; card: Card; note: Note; remaining: number }
  | { phase: 'waiting'; nextDue: number }
  | { phase: 'done'; newHeldBack: number }

/**
 * Runs a review session: picks the next card from fresh database data after
 * every rating, and saves each rating the moment it's made.
 */
export function useReviewSession(scope: Scope) {
  const [state, setState] = useState<SessionState>({ phase: 'loading' })
  const [reviewed, setReviewed] = useState(0)
  const [intervals, setIntervals] = useState<Record<Rating, { label: string }> | null>(null)
  const session = useRef({ lastCardId: null as string | null, reviewsSinceNew: 0, shownAt: 0, busy: false })
  const scopeKey = JSON.stringify(scope)

  const loadNext = useCallback(async () => {
    const input = await loadQueueInput(JSON.parse(scopeKey) as Scope, session.current)
    const next = pickNext(input)
    if (!next.card) {
      setState(next.nextLearningDue ? { phase: 'waiting', nextDue: next.nextLearningDue } : { phase: 'done', newHeldBack: next.newHeldBack })
      return
    }
    const note = await db.notes.get(next.card.note_id)
    if (!note) {
      // A card without its note can't be shown; treat it as gone.
      setState({ phase: 'done', newHeldBack: next.newHeldBack })
      return
    }
    session.current.shownAt = Date.now()
    setIntervals(null)
    setState({ phase: 'question', card: next.card, note, remaining: next.remaining })
  }, [scopeKey])

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
    const settings = await getSettings()
    setIntervals(previewIntervals(state.card, Date.now(), makeScheduler(settings)))
    setState({ ...state, phase: 'answer' })
  }, [state])

  const rate = useCallback(
    async (rating: Rating) => {
      if (state.phase !== 'answer' || session.current.busy) return
      session.current.busy = true
      try {
        const { card } = state
        await recordReview(card.id, rating, Date.now() - session.current.shownAt)
        session.current.lastCardId = card.id
        session.current.reviewsSinceNew = card.state === CardState.New ? 0 : session.current.reviewsSinceNew + 1
        setReviewed((n) => n + 1)
        await loadNext()
      } finally {
        session.current.busy = false
      }
    },
    [state, loadNext],
  )

  /** Reload the current card's text after it was edited mid-review. */
  const refreshNote = useCallback(async () => {
    if (state.phase !== 'question' && state.phase !== 'answer') return
    const note = await db.notes.get(state.note.id)
    if (!note || note.deleted) return void loadNext()
    // Keep whatever phase the card is in now; only swap in the new text.
    setState((s) => ((s.phase === 'question' || s.phase === 'answer') && s.note.id === note.id ? { ...s, note } : s))
  }, [state, loadNext])

  const learnMore = useCallback(
    async (count: number) => {
      await allowMoreNewCards(count)
      await loadNext()
    },
    [loadNext],
  )

  return { state, reviewed, intervals, reveal, rate, refreshNote, learnMore, loadNext }
}
