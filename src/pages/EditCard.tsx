import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CardForm from '../components/CardForm'
import ConfirmDialog from '../components/ConfirmDialog'
import { btn } from '../components/ui'
import { db } from '../db/db'
import { useLibrary } from '../db/hooks'
import { deleteNote, updateNote } from '../db/notes'

export default function EditCard() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const library = useLibrary()
  const note = useLiveQuery(() => db.notes.get(id), [id])
  const [confirming, setConfirming] = useState(false)

  if (!library || note === undefined) return null
  if (!note || note.deleted) {
    return <p className="py-6 text-slate-600 dark:text-slate-300">This card has been deleted.</p>
  }

  return (
    <div className="py-6">
      <h1 className="mb-6 text-2xl font-bold">Edit card</h1>
      <CardForm
        mode="edit"
        initial={{ front: note.front, back: note.back, setId: note.set_id }}
        subjects={library.subjects}
        sets={library.sets}
        onCancel={() => navigate(-1)}
        onSave={async ({ front, back, setId }) => {
          await updateNote(note.id, { front, back, set_id: setId })
          navigate(-1)
        }}
      />
      <button type="button" className={`${btn.ghost} mt-8 text-rose-600 dark:text-rose-400`} onClick={() => setConfirming(true)}>
        Delete card
      </button>
      <ConfirmDialog
        open={confirming}
        title="Delete this card?"
        message="This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteNote(note.id)
          navigate(-1)
        }}
        onClose={() => setConfirming(false)}
      />
    </div>
  )
}
