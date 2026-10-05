import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BulkAdd from '../components/BulkAdd'
import CardForm, { type SharedValues } from '../components/CardForm'
import { ChevronIcon, CloseIcon } from '../components/Icons'
import ClozeForm from '../components/ClozeForm'
import NameDialog from '../components/NameDialog'
import { btn, input, panel } from '../components/ui'
import { useLibrary, useTags } from '../db/hooks'
import { addNote, addNotes, type NewNote } from '../db/notes'
import { getLastSetId, setLastSetId } from '../db/settings'
import { createSet, createSubject } from '../db/subjects'
import { setLabel, subjectOutline } from '../db/outline'
import type { CardSet, Subject, Topic } from '../db/types'

type Tab = 'card' | 'cloze' | 'bulk'
const TABS: { id: Tab; label: string }[] = [
  { id: 'card', label: 'Card' },
  { id: 'cloze', label: 'Blanks' },
  { id: 'bulk', label: 'Paste many' },
]

export default function AddCard() {
  const library = useLibrary()
  const [params] = useSearchParams()
  if (!library) return null
  const { subjects, topics, sets } = library

  if (sets.length === 0) return <FirstSet hasSubject={subjects[0]?.id} />
  const fromLink = params.get('set')
  return <QuickAdd subjects={subjects} topics={topics} sets={sets} wanted={fromLink ?? getLastSetId()} picked={!!fromLink && sets.some((s) => s.id === fromLink)} />
}

function QuickAdd({
  subjects,
  topics,
  sets,
  wanted,
  picked,
}: {
  subjects: Subject[]
  topics: Topic[]
  sets: CardSet[]
  wanted: string | null
  picked: boolean
}) {
  // Start with the set from the link, else the last one used, else the first.
  // Worked out once, so later changes to the database don't reset the form.
  const [shared, setShared] = useState<SharedValues>(() => ({
    setId: sets.some((s) => s.id === wanted) ? wanted! : sets[0].id,
    tags: [],
  }))
  const [tab, setTab] = useState<Tab>('card')
  // Coming from a set's "Add cards" button, the set is already chosen.
  const [choosing, setChoosing] = useState(!picked)
  const tags = useTags()
  const onSharedChange = (next: SharedValues) => {
    setShared(next)
    setLastSetId(next.setId)
  }
  const common = { subjects, sets, tagSuggestions: tags, onSharedChange, hideSet: true }
  const set = sets.find((s) => s.id === shared.setId) ?? sets[0]
  const subject = subjects.find((s) => s.id === set.subject_id)

  if (choosing) {
    return (
      <div className="py-6">
        <AddHeader />
        <SetPicker
          subjects={subjects}
          topics={topics}
          sets={sets}
          current={getLastSetId()}
          onPick={(setId) => {
            onSharedChange({ ...shared, setId })
            setChoosing(false)
          }}
        />
      </div>
    )
  }

  return (
    // Keyed by set, so each form starts fresh in the set just picked.
    <div className="py-6" key={shared.setId}>
      <AddHeader />
      <div className="card mb-4 flex items-center gap-3 px-4 py-2.5">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-semibold text-muted">Adding to</span>
          <span className="truncate font-semibold">
            {subject?.name} · {setLabel(set, topics)}
          </span>
        </span>
        <button type="button" className={`${btn.ghost} -mr-2 shrink-0 text-accent`} onClick={() => setChoosing(true)}>
          Change
        </button>
      </div>
      <div role="tablist" aria-label="Kind of card" className="mb-6 grid grid-cols-3 gap-1 rounded-btn bg-raised p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 rounded-btn px-2 font-semibold ${tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'card' && (
        <CardForm
          mode="add"
          initial={{ front: '', back: '', reverse: false, ...shared }}
          {...common}
          onSave={async ({ front, back, setId, tags, reverse }) => {
            await addNote({ setId, type: 'basic', front, back, tags, makeReverse: reverse })
            setLastSetId(setId)
          }}
        />
      )}
      {tab === 'cloze' && (
        <ClozeForm
          mode="add"
          initial={{ front: '', extra: '', ...shared }}
          {...common}
          onSave={async ({ front, extra, setId, tags }) => {
            await addNote({ setId, type: 'cloze', front, back: extra, tags })
            setLastSetId(setId)
          }}
        />
      )}
      {tab === 'bulk' && (
        <BulkAdd
          initial={shared}
          {...common}
          onSave={async (lines, { setId, tags }, reverse) => {
            await addNotes(
              lines.flatMap((l): NewNote[] =>
                l.kind === 'basic'
                  ? [{ setId, type: 'basic', front: l.front, back: l.back, tags, makeReverse: reverse }]
                  : l.kind === 'cloze'
                    ? [{ setId, type: 'cloze', front: l.front, back: '', tags }]
                    : [],
              ),
            )
            setLastSetId(setId)
          }}
        />
      )}
    </div>
  )
}

/** Step one of adding: which set the cards go in. */
function SetPicker({
  subjects,
  topics,
  sets,
  current,
  onPick,
}: {
  subjects: Subject[]
  topics: Topic[]
  sets: CardSet[]
  current: string | null
  onPick: (setId: string) => void
}) {
  const [newSetIn, setNewSetIn] = useState<{ subject: Subject; topic: Topic | null } | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">Which set are these cards for?</p>
      {subjects.map((subject) => {
        const groups = subjectOutline(subject, topics, sets)
        return (
          <section key={subject.id} aria-label={subject.name} className="card overflow-hidden">
            <h2 className="font-display border-b border-line px-4 py-2 text-base">{subject.name}</h2>
            {groups.map((group) => (
              <div key={group.key}>
                {group.topic && <h3 className="border-b border-line bg-raised px-4 py-1.5 text-sm font-bold">{group.topic.name}</h3>}
                <ul className="divide-y divide-line border-b border-line">
                  {group.sets.map((set) => (
                    <li key={set.id}>
                      <button
                        type="button"
                        onClick={() => onPick(set.id)}
                        className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-semibold hover:bg-raised"
                      >
                        <span className="min-w-0 flex-1 truncate">{set.name}</span>
                        {set.id === current && <span className="shrink-0 text-xs font-normal text-muted">Last used</span>}
                        <ChevronIcon width={18} height={18} className="shrink-0 text-muted" />
                      </button>
                    </li>
                  ))}
                  {group.topic && (
                    <li>
                      <button
                        type="button"
                        className="min-h-12 w-full px-4 text-left font-semibold text-accent hover:bg-raised"
                        onClick={() => setNewSetIn({ subject, topic: group.topic })}
                      >
                        + New set in {group.topic.name}
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            ))}
            <button
              type="button"
              className="min-h-12 w-full px-4 text-left font-semibold text-accent hover:bg-raised"
              onClick={() => setNewSetIn({ subject, topic: null })}
            >
              + New set in {subject.name}
            </button>
          </section>
        )
      })}
      <NameDialog
        open={newSetIn !== null}
        title={newSetIn ? `New set in ${newSetIn.topic?.name ?? newSetIn.subject.name}` : ''}
        label="Set name"
        placeholder={newSetIn?.topic ? 'e.g. Economics' : 'e.g. Tudors – Henry VII'}
        submitLabel="Create"
        onSubmit={async (name) => {
          if (!newSetIn) return
          const set = await createSet(newSetIn.subject.id, name, newSetIn.topic?.id ?? null)
          onPick(set.id)
        }}
        onClose={() => setNewSetIn(null)}
      />
    </div>
  )
}

/** The title, with a button to leave (back where you came from, or Home). */
function AddHeader() {
  const navigate = useNavigate()
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h1 className="text-2xl font-bold">Add cards</h1>
      <button
        type="button"
        className={`${btn.ghost} -mr-3`}
        onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/'))}
      >
        <CloseIcon width={20} height={20} /> Done
      </button>
    </div>
  )
}

/** Cards need a set to go in, so offer to make one right here. */
function FirstSet({ hasSubject }: { hasSubject: string | undefined }) {
  const [subjectName, setSubjectName] = useState('')
  const [setName, setSetName] = useState('')
  const ready = setName.trim() && (hasSubject || subjectName.trim())

  return (
    <div className="py-6">
      <AddHeader />
      <form
        className={`${panel} flex flex-col gap-4 p-5`}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!ready) return
          const subjectId = hasSubject ?? (await createSubject(subjectName)).id
          const set = await createSet(subjectId, setName)
          setLastSetId(set.id)
        }}
      >
        <p className="text-muted">Cards go into a set. Create one to get started.</p>
        {!hasSubject && (
          <div>
            <label htmlFor="first-subject" className="mb-1 block text-sm font-medium">
              Subject
            </label>
            <input
              id="first-subject"
              className={input}
              placeholder="e.g. History"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <div>
          <label htmlFor="first-set" className="mb-1 block text-sm font-medium">
            Set
          </label>
          <input
            id="first-set"
            className={input}
            placeholder="e.g. Tudors – Henry VII"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            autoFocus={!!hasSubject}
          />
        </div>
        <button type="submit" className={btn.primary} disabled={!ready}>
          Create and start adding
        </button>
      </form>
    </div>
  )
}
