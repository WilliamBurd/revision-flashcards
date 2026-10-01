import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import NoteEditor from '../components/NoteEditor'
import { btn } from '../components/ui'
import { db } from '../db/db'
import { deleteNote } from '../db/notes'

export default function EditCard() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const note = useLiveQuery(() => db.notes.get(id), [id])
  const [confirming, setConfirming] = useState(false)

  if (note === undefined) return null
  if (!note || note.deleted) {
    return <p className="py-6 text-muted">This card has been deleted.</p>
  }

  return (
    <div className="py-6">
      <h1 className="mb-6 text-2xl font-bold">{note.type === 'cloze' ? 'Edit cloze card' : 'Edit card'}</h1>
      <NoteEditor key={note.id} note={note} onCancel={() => navigate(-1)} onSaved={() => navigate(-1)} />
      <button type="button" className={`${btn.ghost} mt-8 text-danger`} onClick={() => setConfirming(true)}>
        Delete card
      </button>
      <ConfirmDialog
        open={confirming}
        title={cardsLabel(note)}
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

function cardsLabel(note: { type: string; make_reverse: boolean }) {
  return note.type === 'cloze' ? 'Delete this sentence and all its cards?' : note.make_reverse ? 'Delete this card and its reverse?' : 'Delete this card?'
}
