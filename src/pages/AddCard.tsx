import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CardForm from '../components/CardForm'
import { btn, input, panel } from '../components/ui'
import { useLibrary } from '../db/hooks'
import { addBasicNote } from '../db/notes'
import { getLastSetId, setLastSetId } from '../db/settings'
import { createSet, createSubject } from '../db/subjects'
import type { CardSet, Subject } from '../db/types'

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
  const [setId] = useState(() => (sets.some((s) => s.id === wanted) ? wanted! : sets[0].id))

  return (
    <div className="py-6">
      <h1 className="mb-6 text-2xl font-bold">Add cards</h1>
      <CardForm
        mode="add"
        initial={{ front: '', back: '', setId }}
        subjects={subjects}
        sets={sets}
        onSetChange={setLastSetId}
        onSave={async ({ front, back, setId }) => {
          await addBasicNote(setId, front, back)
          setLastSetId(setId)
        }}
      />
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
