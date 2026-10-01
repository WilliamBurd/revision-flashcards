import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import Counts from '../components/Counts'
import { MoreIcon } from '../components/Icons'
import Modal from '../components/Modal'
import NameDialog from '../components/NameDialog'
import { btn, panel } from '../components/ui'
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
  const close = () => setDialog(null)

  if (!library || !overview) return null
  const { subjects, sets } = library
  const ready = readyCount(
    overview,
    sets.map((s) => s.id),
  )
  const readyTotal = ready.due + ready.newToday

  return (
    <div className="py-6">
      <h1 className="mb-6 text-2xl font-bold lg:hidden">Revision</h1>

      {subjects.length === 0 ? (
        <Welcome onStart={() => setDialog({ kind: 'new-subject' })} />
      ) : (
        <>
          <Link
            to="/review"
            className={`${btn.primary} mb-8 min-h-16 w-full text-lg ${readyTotal ? '' : 'pointer-events-none opacity-60'}`}
            aria-disabled={!readyTotal}
          >
            {readyTotal ? `Review all due (${readyTotal})` : 'Nothing due right now'}
          </Link>

          <div className="flex flex-col gap-6">
            {subjects.map((subject) => {
              const subjectSets = sets.filter((s) => s.subject_id === subject.id)
              const subjectReady = readyCount(
                overview,
                subjectSets.map((s) => s.id),
              )
              const subjectTotal = subjectReady.due + subjectReady.newToday
              return (
                <section key={subject.id} aria-labelledby={`subject-${subject.id}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <h2 id={`subject-${subject.id}`} className="flex-1 text-lg font-semibold">
                      {subject.name}
                    </h2>
                    {subjectTotal > 0 && (
                      <Link to={`/review?subject=${subject.id}`} className={btn.ghost}>
                        Review ({subjectTotal})
                      </Link>
                    )}
                    <button
                      type="button"
                      className={btn.icon}
                      aria-label={`Options for ${subject.name}`}
                      onClick={() => setDialog({ kind: 'menu', subject })}
                    >
                      <MoreIcon />
                    </button>
                  </div>
                  <ul className={`${panel} divide-y divide-slate-200 dark:divide-slate-800`}>
                    {subjectSets.map((set) => (
                      <li key={set.id}>
                        <Link
                          to={`/sets/${set.id}`}
                          className="flex min-h-14 flex-col justify-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <span className="font-medium">{set.name}</span>
                          <Counts counts={overview.bySet.get(set.id)} />
                        </Link>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        className="min-h-12 w-full px-4 text-left font-medium text-indigo-600 hover:bg-slate-50 dark:text-indigo-400 dark:hover:bg-slate-800/50"
                        onClick={() => setDialog({ kind: 'new-set', subject })}
                      >
                        + New set
                      </button>
                    </li>
                  </ul>
                </section>
              )
            })}
          </div>

          <button type="button" className={`${btn.secondary} mt-8 w-full`} onClick={() => setDialog({ kind: 'new-subject' })}>
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
              className={`${btn.secondary} text-rose-600 dark:text-rose-400`}
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
    <div className={`${panel} p-6 text-center`}>
      <h2 className="mb-2 text-xl font-semibold">Welcome</h2>
      <p className="mb-6 text-slate-600 dark:text-slate-300">
        Start by adding a subject, like History or Politics. Then add sets of cards inside it.
      </p>
      <button type="button" className={btn.primary} onClick={onStart}>
        Add your first subject
      </button>
    </div>
  )
}
