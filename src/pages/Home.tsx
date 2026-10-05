import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import ExamDatesDialog from '../components/ExamDatesDialog'
import { ProgressBar, ProgressKey } from '../components/Counts'
import { ChevronIcon, MoreIcon, PaletteIcon, SettingsIcon } from '../components/Icons'
import { useLayout } from '../components/Layout'
import SyncBadge from '../components/SyncBadge'
import Modal from '../components/Modal'
import NameDialog from '../components/NameDialog'
import { btn } from '../components/ui'
import { useLibrary, useOverview } from '../db/hooks'
import { subjectOutline } from '../db/outline'
import { readyCount, type StudyOverview } from '../db/study'
import { daysUntil, nextExam } from '../scheduler/exams'
import {
  countCardsIn,
  createSet,
  createSubject,
  createTopic,
  deleteSubject,
  deleteTopic,
  renameSubject,
  renameTopic,
} from '../db/subjects'
import type { CardSet, Subject, Topic } from '../db/types'

type Dialog =
  | { kind: 'new-subject' }
  | { kind: 'menu'; subject: Subject }
  | { kind: 'rename'; subject: Subject }
  | { kind: 'exams'; subject: Subject }
  | { kind: 'new-set'; subject: Subject; topic: Topic | null }
  | { kind: 'delete'; subject: Subject; cardCount: number }
  | { kind: 'new-topic'; subject: Subject }
  | { kind: 'topic-menu'; topic: Topic }
  | { kind: 'rename-topic'; topic: Topic }
  | { kind: 'delete-topic'; topic: Topic }

export default function Home() {
  const library = useLibrary()
  const overview = useOverview()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const { openThemePicker, openAccount } = useLayout()
  const close = () => setDialog(null)

  if (!library || !overview) return null
  const { subjects, topics, sets } = library
  const groupsOf = (subject: Subject) => subjectOutline(subject, topics, sets)
  const ready = readyCount(
    overview,
    sets.map((s) => s.id),
  )
  const readyTotal = ready.due + ready.newToday

  return (
    <div className="flex flex-col gap-5 py-6 lg:py-10">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-muted">{today()}</span>
          <div className="-my-2 flex items-center gap-1 lg:hidden">
            <SyncBadge onClick={openAccount} />
            <button type="button" className={btn.icon} aria-label="Theme, colour and text size" onClick={openThemePicker}>
              <PaletteIcon />
            </button>
            <Link to="/settings" className={btn.icon} aria-label="Settings">
              <SettingsIcon />
            </Link>
          </div>
        </div>
        <h1 className="text-3xl tracking-tight lg:text-4xl">Burdis Flashcards</h1>
      </div>

      {subjects.length === 0 ? (
        <Welcome onStart={() => setDialog({ kind: 'new-subject' })} />
      ) : (
        <>
          {readyTotal > 0 ? (
            <div className="flex flex-col gap-3">
              {subjects.flatMap((subject, i) =>
                groupsOf(subject).map((group) => {
                  const groupReady = readyCount(
                    overview,
                    group.sets.map((s) => s.id),
                  )
                  const total = groupReady.due + groupReady.newToday
                  if (total === 0) return null
                  const colour = (i % 4) + 1
                  return (
                    <Link
                      key={group.key}
                      to={`/review?topic=${encodeURIComponent(group.key)}`}
                      className="hero-shadow flex min-h-20 items-center gap-4 rounded-card px-5 py-4 transition hover:brightness-110 active:scale-[0.99]"
                      style={{ background: `var(--subject-${colour}-badge)`, color: `var(--subject-${colour}-badge-ink)` }}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-xl font-bold">Review {group.topic?.name ?? subject.name}</span>
                        <span className="text-sm opacity-85">
                          {group.topic && `${subject.name} · `}
                          {readySummary(groupReady.due, groupReady.newToday)}
                        </span>
                      </span>
                      <span className="font-display text-4xl">{total}</span>
                      <ChevronIcon width={22} height={22} strokeWidth={2.5} />
                    </Link>
                  )
                }),
              )}
            </div>
          ) : (
            <div className="card flex min-h-20 flex-col justify-center px-5 py-4">
              <span className="text-lg font-bold">All caught up</span>
              <span className="text-sm text-muted">Nothing is due right now. Add some cards or come back later.</span>
            </div>
          )}

          {subjects.map((subject, i) => {
            const colour = (i % 4) + 1
            const exam = nextExam(subject.exam_dates, Date.now())
            return (
              <section key={subject.id} aria-labelledby={`subject-${subject.id}`} className="card overflow-hidden">
                <div
                  className="flex items-center gap-2 py-2 pr-2 pl-4"
                  style={{ background: `var(--subject-${colour}-head)`, color: `var(--subject-${colour}-head-ink)` }}
                >
                  <span className="h-3 w-3 shrink-0 rounded" style={{ background: `var(--subject-${colour})` }} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h2 id={`subject-${subject.id}`} className="font-display truncate text-lg">
                      {subject.name}
                    </h2>
                    {exam && <span className="truncate text-sm opacity-80">{examCountdown(exam.name, daysUntil(exam.start, Date.now()))}</span>}
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-btn hover:bg-black/5"
                    aria-label={`Options for ${subject.name}`}
                    onClick={() => setDialog({ kind: 'menu', subject })}
                  >
                    <MoreIcon />
                  </button>
                </div>
                {groupsOf(subject).map((group, _, groups) => (
                  <div key={group.key}>
                    {group.topic ? (
                      <div className="flex items-center gap-2 border-t border-line bg-raised py-1 pr-2 pl-4">
                        <h3 className="min-w-0 flex-1 truncate font-bold">{group.topic.name}</h3>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-btn hover:bg-black/5"
                          aria-label={`Options for ${group.topic.name}`}
                          onClick={() => group.topic && setDialog({ kind: 'topic-menu', topic: group.topic })}
                        >
                          <MoreIcon />
                        </button>
                      </div>
                    ) : (
                      groups.length > 1 &&
                      group.sets.length > 0 && (
                        <div className="border-t border-line bg-raised px-4 py-2 text-sm font-semibold text-muted">Other sets</div>
                      )
                    )}
                    <ul>
                      {group.sets.map((set) => (
                        <SetRow key={set.id} set={set} overview={overview} colour={colour} />
                      ))}
                      {group.topic && (
                        <li className="border-t border-line">
                          <button
                            type="button"
                            className="min-h-12 w-full px-4 text-left font-semibold text-accent hover:bg-raised"
                            onClick={() => setDialog({ kind: 'new-set', subject, topic: group.topic })}
                          >
                            + New set in {group.topic.name}
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
                <div className="flex border-t border-line">
                  <button
                    type="button"
                    className="min-h-12 flex-1 px-4 text-left font-semibold text-accent hover:bg-raised"
                    onClick={() => setDialog({ kind: 'new-set', subject, topic: null })}
                  >
                    + New set
                  </button>
                  <button
                    type="button"
                    className="min-h-12 flex-1 border-l border-line px-4 text-left font-semibold text-accent hover:bg-raised"
                    onClick={() => setDialog({ kind: 'new-topic', subject })}
                  >
                    + New topic
                  </button>
                </div>
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
        title={dialog?.kind === 'new-set' ? `New set in ${dialog.topic?.name ?? dialog.subject.name}` : ''}
        label="Set name"
        placeholder={dialog?.kind === 'new-set' && dialog.topic ? 'e.g. Economics' : 'e.g. Tudors – Henry VII'}
        submitLabel="Create"
        onSubmit={(name) => dialog?.kind === 'new-set' && void createSet(dialog.subject.id, name, dialog.topic?.id ?? null)}
        onClose={close}
      />
      <NameDialog
        open={dialog?.kind === 'new-topic'}
        title={dialog?.kind === 'new-topic' ? `New topic in ${dialog.subject.name}` : ''}
        label="Topic name"
        placeholder="e.g. 1900s Britain"
        submitLabel="Create"
        onSubmit={(name) => dialog?.kind === 'new-topic' && void createTopic(dialog.subject.id, name)}
        onClose={close}
      />
      <NameDialog
        open={dialog?.kind === 'rename-topic'}
        title="Rename topic"
        label="Topic name"
        initial={dialog?.kind === 'rename-topic' ? dialog.topic.name : ''}
        submitLabel="Rename"
        onSubmit={(name) => dialog?.kind === 'rename-topic' && void renameTopic(dialog.topic.id, name)}
        onClose={close}
      />
      <Modal open={dialog?.kind === 'topic-menu'} onClose={close} title={dialog?.kind === 'topic-menu' ? dialog.topic.name : ''}>
        {dialog?.kind === 'topic-menu' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                const subject = subjects.find((s) => s.id === dialog.topic.subject_id)
                if (subject) setDialog({ kind: 'new-set', subject, topic: dialog.topic })
              }}
            >
              Add a set
            </button>
            <button type="button" className={btn.secondary} onClick={() => setDialog({ kind: 'rename-topic', topic: dialog.topic })}>
              Rename
            </button>
            <button type="button" className={`${btn.secondary} text-danger`} onClick={() => setDialog({ kind: 'delete-topic', topic: dialog.topic })}>
              Delete…
            </button>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={dialog?.kind === 'delete-topic'}
        title={dialog?.kind === 'delete-topic' ? `Delete ${dialog.topic.name}?` : ''}
        message="Its sets and cards are kept and move to Other sets in the subject."
        confirmLabel="Delete"
        onConfirm={() => dialog?.kind === 'delete-topic' && void deleteTopic(dialog.topic.id)}
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
            <button type="button" className={btn.secondary} onClick={() => setDialog({ kind: 'new-topic', subject: dialog.subject })}>
              Add a topic
            </button>
            <button type="button" className={btn.secondary} onClick={() => setDialog({ kind: 'new-set', subject: dialog.subject, topic: null })}>
              Add a set
            </button>
            <button type="button" className={btn.secondary} onClick={() => setDialog({ kind: 'exams', subject: dialog.subject })}>
              Exam dates
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
      <ExamDatesDialog subject={dialog?.kind === 'exams' ? dialog.subject : null} onClose={close} />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title={dialog?.kind === 'delete' ? `Delete ${dialog.subject.name}?` : ''}
        message={
          dialog?.kind === 'delete'
            ? `This deletes the subject, all its topics and sets, and ${dialog.cardCount} ${dialog.cardCount === 1 ? 'card' : 'cards'}.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={() => dialog?.kind === 'delete' && void deleteSubject(dialog.subject.id)}
        onClose={close}
      />
    </div>
  )
}

function SetRow({ set, overview, colour }: { set: CardSet; overview: StudyOverview; colour: number }) {
  const counts = overview.bySet.get(set.id)
  const due = (counts?.due ?? 0) + (counts?.newToday ?? 0)
  return (
    <li className="border-t border-line">
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
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="card p-6 text-center">
      <h2 className="font-display mb-2 text-xl">Welcome</h2>
      <p className="mb-6 text-muted">
        Start by adding a subject, like History or Politics. Then add sets of cards inside it, or topics (like 1900s
        Britain) with sets inside them.
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

function examCountdown(name: string, days: number) {
  const what = name || 'Exam'
  if (days <= 0) return `${what} today`
  if (days === 1) return `${what} tomorrow`
  return `${what} in ${days} days`
}
