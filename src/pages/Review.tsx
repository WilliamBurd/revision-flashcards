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
        <p className="flex-1 text-center text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
          {showingCard ? `${state.remaining} to go` : ''}
        </p>
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
          <button
            type="button"
            className="mx-auto flex w-full max-w-2xl flex-1 cursor-pointer flex-col overflow-y-auto px-5 py-6 text-left"
            onClick={() => void reveal()}
            disabled={state.phase === 'answer'}
            aria-label={state.phase === 'question' ? 'Show answer' : undefined}
          >
            <p className="text-xl leading-relaxed font-medium break-words whitespace-pre-wrap sm:text-2xl">{state.note.front}</p>
            {state.phase === 'answer' && (
              <>
                <hr className="my-6 border-slate-200 dark:border-slate-800" />
                <p className="text-xl leading-relaxed break-words whitespace-pre-wrap sm:text-2xl">{state.note.back}</p>
              </>
            )}
          </button>

          <div className="pb-safe border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto max-w-2xl p-3">
              {state.phase === 'question' ? (
                <button type="button" className={`${btn.primary} min-h-16 w-full text-lg`} onClick={() => void reveal()} title="Space">
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
          <p className="text-slate-600 dark:text-slate-300">
            Your next card is back in {formatInterval(state.nextDue - Date.now())}. Stay here and it will appear, or come back later.
          </p>
        </Finished>
      )}

      {state.phase === 'done' && (
        <Finished reviewed={reviewed}>
          {state.newHeldBack > 0 ? (
            <>
              <p className="text-slate-600 dark:text-slate-300">
                You've reached today's new card limit. {state.newHeldBack} new{' '}
                {state.newHeldBack === 1 ? 'card is' : 'cards are'} still waiting.
              </p>
              <button type="button" className={btn.secondary} onClick={() => void learnMore(LEARN_MORE)}>
                Learn {Math.min(LEARN_MORE, state.newHeldBack)} more today
              </button>
            </>
          ) : (
            <p className="text-slate-600 dark:text-slate-300">Nothing else is due. Nice work.</p>
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
      <h1 className="text-2xl font-bold">{reviewed > 0 ? `${reviewed} ${reviewed === 1 ? 'card' : 'cards'} reviewed` : 'All caught up'}</h1>
      {children}
      <Link to="/" className={btn.primary}>
        Back to home
      </Link>
    </div>
  )
}
