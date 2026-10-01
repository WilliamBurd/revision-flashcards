import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import { ProgressBar, ProgressKey } from '../components/Counts'
import { ChevronIcon, MoreIcon, PaletteIcon } from '../components/Icons'
import { useLayout } from '../components/Layout'
import Modal from '../components/Modal'
import NameDialog from '../components/NameDialog'
import { btn } from '../components/ui'
import { useLibrary, useOverview } from '../db/hooks'
import { readyCount } from '../db/study'
import { countCardsIn, createSet, createSubject, deleteSubject, renameSubject } from '../db/subjects'
import type { Subject } from '../db/types'

type Dialog =
  | { kind: 'new-subject' }
  | { kind: 'menu'; subject: Subject }
  | { kind: 'rename'; subject: Subject }
  | { kind: 'new-set'; subject: Subject }
  | { kind: 'delete'; subject: Subject; cardCount: number }

export default function Home() {
  const library = useLibrary()
  const overview = useOverview()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const { openThemePicker } = useLayout()
  const close = () => setDialog(null)

  if (!library || !overview) return null
  const { subjects, sets } = library
  const ready = readyCount(
    overview,
    sets.map((s) => s.id),
  )
  const readyTotal = ready.due + ready.newToday

  return (
    <div className="flex flex-col gap-5 py-6 lg:py-10">
      <div className="flex items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-semibold text-muted">{today()}</span>
          <h1 className="text-3xl tracking-tight lg:text-4xl">Revision</h1>
        </div>
        <button type="button" className={`${btn.icon} lg:hidden`} aria-label="Change theme" onClick={openThemePicker}>
          <PaletteIcon />
        </button>
      </div>

      {subjects.length === 0 ? (
        <Welcome onStart={() => setDialog({ kind: 'new-subject' })} />
      ) : (
        <>
          {readyTotal > 0 ? (
            <Link
              to="/review"
              className="hero-shadow flex min-h-20 items-center gap-4 rounded-card bg-accent px-5 py-4 text-on-accent transition hover:bg-accent-strong active:scale-[0.99]"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-xl font-bold">Review all due</span>
                <span className="text-sm opacity-85">{readySummary(ready.due, ready.newToday)}</span>
              </span>
              <span className="font-display text-4xl">{readyTotal}</span>
              <ChevronIcon width={22} height={22} strokeWidth={2.5} />
            </Link>
          ) : (
            <div className="card flex min-h-20 flex-col justify-center px-5 py-4">
              <span className="text-lg font-bold">All caught up</span>
              <span className="text-sm text-muted">Nothing is due right now. Add some cards or come back later.</span>
            </div>
          )}

          {subjects.map((subject, i) => {
            const subjectSets = sets.filter((s) => s.subject_id === subject.id)
            const subjectReady = readyCount(
              overview,
              subjectSets.map((s) => s.id),
            )
            const subjectTotal = subjectReady.due + subjectReady.newToday
            const colour = (i % 4) + 1
            return (
              <section key={subject.id} aria-labelledby={`subject-${subject.id}`} className="card overflow-hidden">
                <div
                  className="flex items-center gap-2 py-2 pr-2 pl-4"
                  style={{ background: `var(--subject-${colour}-head)`, color: `var(--subject-${colour}-head-ink)` }}
                >
                  <span className="h-3 w-3 shrink-0 rounded" style={{ background: `var(--subject-${colour})` }} />
                  <h2 id={`subject-${subject.id}`} className="font-display min-w-0 flex-1 truncate text-lg">
                    {subject.name}
                  </h2>
                  {subjectTotal > 0 && (
                    <Link
                      to={`/review?subject=${subject.id}`}
                      className="inline-flex min-h-11 items-center rounded-btn px-3 text-sm font-semibold hover:bg-black/5"
                    >
                      Review {subjectTotal}
                    </Link>
                  )}
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-btn hover:bg-black/5"
                    aria-label={`Options for ${subject.name}`}
                    onClick={() => setDialog({ kind: 'menu', subject })}
                  >
                    <MoreIcon />
                  </button>
                </div>
                <ul>
                  {subjectSets.map((set) => {
                    const counts = overview.bySet.get(set.id)
                    const due = (counts?.due ?? 0) + (counts?.newToday ?? 0)
                    return (
                      <li key={set.id} className="border-t border-line">
                        <Link to={`/sets/${set.id}`} className="flex flex-col gap-2.5 px-4 py-3.5 hover:bg-raised">
                          <span className="flex items-center gap-3">
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-semibold">{set.name}</span>
                              <span className="text-sm text-muted">
                                {counts?.new ?? 0} new · {counts?.total ?? 0} {counts?.total === 1 ? 'card' : 'cards'}
                              </span>
                            </span>
                            <span
                              className={`min-w-9 rounded-full px-2.5 py-1 text-center text-sm font-bold ${due ? '' : 'bg-line text-muted'}`}
                              style={due ? { background: `var(--subject-${colour}-badge)`, color: `var(--subject-${colour}-badge-ink)` } : undefined}
                              aria-label={`${due} to review`}
                            >
                              {due}
                            </span>
                          </span>
                          <ProgressBar counts={counts} />
                        </Link>
                      </li>
                    )
                  })}
                  <li className="border-t border-line">
                    <button
                      type="button"
                      className="min-h-12 w-full px-4 text-left font-semibold text-accent hover:bg-raised"
                      onClick={() => setDialog({ kind: 'new-set', subject })}
                    >
                      + New set
                    </button>
                  </li>
                </ul>
              </section>
            )
          })}

          <ProgressKey />

          <button type="button" className={`${btn.secondary} w-full`} onClick={() => setDialog({ kind: 'new-subject' })}>
            + New subject
          </button>
        </>
      )}

      <NameDialog
        open={dialog?.kind === 'new-subject'}
        title="New subject"
        label="Subject name"
        placeholder="e.g. History"
        submitLabel="Create"
        onSubmit={(name) => void createSubject(name)}
        onClose={close}
      />
      <NameDialog
        open={dialog?.kind === 'new-set'}
        title={dialog?.kind === 'new-set' ? `New set in ${dialog.subject.name}` : ''}
        label="Set name"
        placeholder="e.g. Tudors – Henry VII"
        submitLabel="Create"
        onSubmit={(name) => dialog?.kind === 'new-set' && void createSet(dialog.subject.id, name)}
        onClose={close}
      />
      <NameDialog
        open={dialog?.kind === 'rename'}
        title="Rename subject"
        label="Subject name"
        initial={dialog?.kind === 'rename' ? dialog.subject.name : ''}
        submitLabel="Rename"
        onSubmit={(name) => dialog?.kind === 'rename' && void renameSubject(dialog.subject.id, name)}
        onClose={close}
      />
      <Modal open={dialog?.kind === 'menu'} onClose={close} title={dialog?.kind === 'menu' ? dialog.subject.name : ''}>
        {dialog?.kind === 'menu' && (
          <div className="flex flex-col gap-2">
            <button type="button" className={btn.secondary} onClick={() => setDialog({ kind: 'new-set', subject: dialog.subject })}>
              Add a set
            </button>
            <button type="button" className={btn.secondary} onClick={() => setDialog({ kind: 'rename', subject: dialog.subject })}>
              Rename
            </button>
            <button
              type="button"
              className={`${btn.secondary} text-danger`}
              onClick={async () => {
                const cardCount = await countCardsIn({ subjectId: dialog.subject.id })
                setDialog({ kind: 'delete', subject: dialog.subject, cardCount })
              }}
            >
              Delete…
            </button>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title={dialog?.kind === 'delete' ? `Delete ${dialog.subject.name}?` : ''}
        message={
          dialog?.kind === 'delete'
            ? `This deletes the subject, all its sets and ${dialog.cardCount} ${dialog.cardCount === 1 ? 'card' : 'cards'}.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={() => dialog?.kind === 'delete' && void deleteSubject(dialog.subject.id)}
        onClose={close}
      />
    </div>
  )
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="card p-6 text-center">
      <h2 className="font-display mb-2 text-xl">Welcome</h2>
      <p className="mb-6 text-muted">
        Start by adding a subject, like History or Politics. Then add sets of cards inside it.
      </p>
      <button type="button" className={btn.primary} onClick={onStart}>
        Add your first subject
      </button>
    </div>
  )
}

function today() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function readySummary(due: number, fresh: number) {
  const parts = []
  if (due) parts.push(`${due} ${due === 1 ? 'review' : 'reviews'}`)
  if (fresh) parts.push(`${fresh} new ${fresh === 1 ? 'card' : 'cards'}`)
  return parts.join(' · ')
}
