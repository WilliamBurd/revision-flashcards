import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BulkAdd from '../components/BulkAdd'
import CardForm, { type SharedValues } from '../components/CardForm'
import ClozeForm from '../components/ClozeForm'
import { btn, input, panel } from '../components/ui'
import { useLibrary, useTags } from '../db/hooks'
import { addNote, addNotes, type NewNote } from '../db/notes'
import { getLastSetId, setLastSetId } from '../db/settings'
import { createSet, createSubject } from '../db/subjects'
import type { CardSet, Subject } from '../db/types'

type Tab = 'card' | 'cloze' | 'bulk'
const TABS: { id: Tab; label: string }[] = [
  { id: 'card', label: 'Card' },
  { id: 'cloze', label: 'Cloze' },
  { id: 'bulk', label: 'Paste many' },
]

export default function AddCard() {
  const library = useLibrary()
  const [params] = useSearchParams()
  if (!library) return null
  const { subjects, sets } = library

  if (sets.length === 0) return <FirstSet hasSubject={subjects[0]?.id} />
  return <QuickAdd subjects={subjects} sets={sets} wanted={params.get('set') ?? getLastSetId()} />
}

function QuickAdd({ subjects, sets, wanted }: { subjects: Subject[]; sets: CardSet[]; wanted: string | null }) {
  // Start with the set from the link, else the last one used, else the first.
  // Worked out once, so later changes to the database don't reset the form.
  const [shared, setShared] = useState<SharedValues>(() => ({
    setId: sets.some((s) => s.id === wanted) ? wanted! : sets[0].id,
    tags: [],
  }))
  const [tab, setTab] = useState<Tab>('card')
  const tags = useTags()
  const onSharedChange = (next: SharedValues) => {
    setShared(next)
    setLastSetId(next.setId)
  }
  const common = { subjects, sets, tagSuggestions: tags, onSharedChange }

  return (
    <div className="py-6">
      <h1 className="mb-4 text-2xl font-bold">Add cards</h1>
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

/** Cards need a set to go in, so offer to make one right here. */
function FirstSet({ hasSubject }: { hasSubject: string | undefined }) {
  const [subjectName, setSubjectName] = useState('')
  const [setName, setSetName] = useState('')
  const ready = setName.trim() && (hasSubject || subjectName.trim())

  return (
    <div className="py-6">
      <h1 className="mb-6 text-2xl font-bold">Add cards</h1>
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
