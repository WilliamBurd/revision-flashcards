import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import CardForm from '../components/CardForm'
import { CloseIcon, PencilIcon } from '../components/Icons'
import Modal from '../components/Modal'
import RatingButtons from '../components/RatingButtons'
import { btn } from '../components/ui'
import { useLibrary } from '../db/hooks'
import { updateNote } from '../db/notes'
import type { Scope } from '../db/study'
import type { Rating } from '../db/types'
import { formatInterval } from '../scheduler/formatInterval'
import { useReviewSession } from '../session/useReviewSession'

const LEARN_MORE = 10

export default function Review() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const subject = params.get('subject')
  const set = params.get('set')
  const scope = useMemo<Scope>(
    () => (set ? { kind: 'set', id: set } : subject ? { kind: 'subject', id: subject } : { kind: 'all' }),
    [set, subject],
  )
  const { state, reviewed, intervals, reveal, rate, refreshNote, learnMore } = useReviewSession(scope)
  const library = useLibrary()
  const [editing, setEditing] = useState(false)
  const showingCard = state.phase === 'question' || state.phase === 'answer'

  // Keyboard: Space or Enter reveals, 1-4 rate, E edits, Escape leaves.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing || e.ctrlKey || e.metaKey || e.altKey) return
      if (showingCard && (e.key === ' ' || e.key === 'Enter')) {
        // Stop Space or Enter also pressing whichever button has focus (like Edit).
        e.preventDefault()
        ;(document.activeElement as HTMLElement | null)?.blur()
        if (state.phase === 'question') void reveal()
      } else if (state.phase === 'answer' && ['1', '2', '3', '4'].includes(e.key)) {
        void rate(Number(e.key) as Rating)
      } else if (showingCard && e.key.toLowerCase() === 'e') {
        e.preventDefault() // so the "e" isn't typed into the edit form
        setEditing(true)
      } else if (e.key === 'Escape') {
        navigate('/')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, editing, showingCard, reveal, rate, navigate])

  return (
    <div className="pt-safe flex h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-2 px-2 py-2">
        <Link to="/" className={btn.icon} aria-label="End review" title="Escape">
          <CloseIcon />
        </Link>
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <p className="text-sm font-semibold text-muted" aria-live="polite">
            {showingCard ? `${state.remaining} to go` : ''}
          </p>
          {showingCard && (
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${(reviewed / (reviewed + state.remaining)) * 100}%` }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          className={`${btn.icon} ${showingCard ? '' : 'invisible'}`}
          aria-label="Edit this card"
          title="E"
          onClick={() => setEditing(true)}
        >
          <PencilIcon />
        </button>
      </header>

      {showingCard && (
        <>
          {/* Tapping anywhere on the card reveals the answer. */}
          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 px-4 pt-2 pb-4">
            <button
              type="button"
              className="card flex w-full cursor-pointer flex-col items-start gap-5 overflow-y-auto px-6 py-7 text-left"
              onClick={() => void reveal()}
              disabled={state.phase === 'answer'}
              aria-label={state.phase === 'question' ? 'Show answer' : undefined}
            >
              <span className="rounded-full px-2.5 py-1 text-xs font-bold tracking-wider uppercase bg-raised text-muted">Question</span>
              <p className="font-display text-2xl leading-snug break-words whitespace-pre-wrap sm:text-[1.75rem]">
                {state.note.front}
              </p>
              {state.phase === 'answer' ? (
                <>
                  <span className="h-px w-full bg-line" />
                  <span className="rounded-full px-2.5 py-1 text-xs font-bold tracking-wider uppercase bg-accent-soft text-on-accent-soft">Answer</span>
                  <p className="text-xl leading-relaxed break-words whitespace-pre-wrap sm:text-2xl">{state.note.back}</p>
                </>
              ) : (
                <span className="mt-auto self-center text-sm text-muted">Tap to reveal</span>
              )}
            </button>
          </div>

          <div className="pb-safe">
            <div className="mx-auto max-w-2xl px-4 pb-4">
              {state.phase === 'question' ? (
                <button type="button" className={`${btn.primary} min-h-17 w-full text-lg`} onClick={() => void reveal()} title="Space">
                  Show answer
                </button>
              ) : (
                <RatingButtons intervals={intervals} onRate={(r) => void rate(r)} />
              )}
            </div>
          </div>
        </>
      )}

      {state.phase === 'waiting' && (
        <Finished reviewed={reviewed}>
          <p className="text-muted">
            Your next card is back in {formatInterval(state.nextDue - Date.now())}. Stay here and it will appear, or come back later.
          </p>
        </Finished>
      )}

      {state.phase === 'done' && (
        <Finished reviewed={reviewed}>
          {state.newHeldBack > 0 ? (
            <>
              <p className="text-muted">
                You've reached today's new card limit. {state.newHeldBack} new{' '}
                {state.newHeldBack === 1 ? 'card is' : 'cards are'} still waiting.
              </p>
              <button type="button" className={btn.secondary} onClick={() => void learnMore(LEARN_MORE)}>
                Learn {Math.min(LEARN_MORE, state.newHeldBack)} more today
              </button>
            </>
          ) : (
            <p className="text-muted">Nothing else is due. Nice work.</p>
          )}
        </Finished>
      )}

      {library && showingCard && (
        <Modal open={editing} onClose={() => setEditing(false)} title="Edit card">
          <CardForm
            mode="edit"
            initial={{ front: state.note.front, back: state.note.back, setId: state.note.set_id }}
            subjects={library.subjects}
            sets={library.sets}
            onCancel={() => setEditing(false)}
            onSave={async ({ front, back, setId }) => {
              await updateNote(state.note.id, { front, back, set_id: setId })
              await refreshNote()
              setEditing(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

function Finished({ reviewed, children }: { reviewed: number; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl">{reviewed > 0 ? `${reviewed} ${reviewed === 1 ? 'card' : 'cards'} reviewed` : 'All caught up'}</h1>
      {children}
      <Link to="/" className={btn.primary}>
        Back to home
      </Link>
    </div>
  )
}
