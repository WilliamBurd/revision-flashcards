import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CloseIcon, PencilIcon, UndoIcon } from '../components/Icons'
import Modal from '../components/Modal'
import NoteEditor from '../components/NoteEditor'
import RatingButtons from '../components/RatingButtons'
import RichText from '../components/RichText'
import { btn } from '../components/ui'
import type { Scope } from '../db/study'
import type { Rating } from '../db/types'
import { cardSides } from '../notes/cards'
import { formatInterval } from '../scheduler/formatInterval'
import { useReviewSession, type SessionSummary } from '../session/useReviewSession'

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
  const cram = params.get('cram') === '1'
  const { state, summary, reviewed, intervals, reveal, rate, undo, canUndo, refreshNote, learnMore } = useReviewSession(scope, cram)
  const [editing, setEditing] = useState(false)
  const showingCard = state.phase === 'question' || state.phase === 'answer'
  const sides = showingCard ? cardSides(state.note, state.card) : null

  // Keyboard: Space or Enter reveals, 1-4 rate, E edits, Z undoes, Escape leaves.
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
      } else if (canUndo && e.key.toLowerCase() === 'z') {
        void undo()
      } else if (e.key === 'Escape') {
        navigate('/')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, editing, showingCard, reveal, rate, undo, canUndo, navigate])

  return (
    <div className="pt-safe flex h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-2 px-2 py-2">
        <Link to="/" className={btn.icon} aria-label="End review" title="Escape">
          <CloseIcon />
        </Link>
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <p className="text-sm font-semibold text-muted" aria-live="polite">
            {cram && <span className="mr-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold tracking-wider text-on-accent-soft uppercase">Cram</span>}
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
          className={`${btn.icon} ${canUndo ? '' : 'invisible'}`}
          aria-label="Undo last rating"
          title="Undo (Z)"
          onClick={() => void undo()}
        >
          <UndoIcon />
        </button>
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

      {showingCard && sides && (
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
              <RichText
                text={sides.question}
                cloze={sides.cloze ? { active: sides.cloze, revealed: state.phase === 'answer' } : undefined}
                className="font-display w-full text-2xl leading-snug sm:text-[1.75rem]"
              />
              {state.phase === 'answer' ? (
                sides.answer && (
                  <>
                    <span className="h-px w-full bg-line" />
                    <span className="rounded-full px-2.5 py-1 text-xs font-bold tracking-wider uppercase bg-accent-soft text-on-accent-soft">
                      {sides.cloze ? 'Note' : 'Answer'}
                    </span>
                    <RichText text={sides.answer} className="w-full text-xl leading-relaxed sm:text-2xl" />
                  </>
                )
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
                <>
                  <RatingButtons intervals={intervals} onRate={(r) => void rate(r)} />
                  {cram && <p className="mt-2 text-center text-xs text-muted">Cram doesn't change when cards are next due.</p>}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {state.phase === 'waiting' && (
        <Finished summary={summary} canUndo={canUndo} onUndo={() => void undo()}>
          <p className="text-muted">
            Your next card is back in {formatInterval(state.nextDue - Date.now())}. Stay here and it will appear, or come back later.
          </p>
        </Finished>
      )}

      {state.phase === 'done' && (
        <Finished summary={summary} canUndo={canUndo} onUndo={() => void undo()}>
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
            <p className="text-muted">{cram ? "That's every card in this cram. Nice work." : 'Nothing else is due. Nice work.'}</p>
          )}
        </Finished>
      )}

      {showingCard && (
        <Modal open={editing} onClose={() => setEditing(false)} title="Edit card">
          <NoteEditor
            key={state.note.id}
            note={state.note}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              await refreshNote()
              setEditing(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

function Finished({ summary, canUndo, onUndo, children }: { summary: SessionSummary; canUndo: boolean; onUndo: () => void; children: ReactNode }) {
  const { reviewed, noIdea, timeMs } = summary
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl">{reviewed > 0 ? 'Session done' : 'All caught up'}</h1>
      {reviewed > 0 && (
        <dl className="grid w-full grid-cols-3 gap-2">
          <SummaryStat label={reviewed === 1 ? 'card reviewed' : 'cards reviewed'} value={String(reviewed)} />
          <SummaryStat label="No Idea" value={String(noIdea)} />
          <SummaryStat label="time taken" value={formatDuration(timeMs)} />
        </dl>
      )}
      {children}
      <Link to="/" className={btn.primary}>
        Back to home
      </Link>
      {canUndo && (
        <button type="button" className={btn.ghost} onClick={onUndo}>
          Undo last rating
        </button>
      )}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card flex flex-col-reverse items-center px-2 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-2xl font-bold">{value}</dd>
    </div>
  )
}

/** e.g. "45s", "3m 20s", "1h 5m" */
function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
