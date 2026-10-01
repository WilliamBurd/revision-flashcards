import { useLibrary, useTags } from '../db/hooks'
import { updateNote } from '../db/notes'
import type { Note } from '../db/types'
import CardForm from './CardForm'
import ClozeForm from './ClozeForm'

interface Props {
  note: Note
  onSaved: () => void | Promise<void>
  onCancel: () => void
}

/** Edit any note with the right form for its kind. Cards keep their schedules. */
export default function NoteEditor({ note, onSaved, onCancel }: Props) {
  const library = useLibrary()
  const tags = useTags()
  if (!library) return null
  const common = { mode: 'edit' as const, subjects: library.subjects, sets: library.sets, tagSuggestions: tags, onCancel }

  if (note.type === 'cloze') {
    return (
      <ClozeForm
        {...common}
        initial={{ front: note.front, extra: note.back, setId: note.set_id, tags: note.tags ?? [] }}
        onSave={async ({ front, extra, setId, tags }) => {
          await updateNote(note.id, { front, back: extra, set_id: setId, tags })
          await onSaved()
        }}
      />
    )
  }
  return (
    <CardForm
      {...common}
      initial={{ front: note.front, back: note.back, setId: note.set_id, tags: note.tags ?? [], reverse: note.make_reverse }}
      onSave={async ({ front, back, setId, tags, reverse }) => {
        await updateNote(note.id, { front, back, set_id: setId, tags, make_reverse: reverse })
        await onSaved()
      }}
    />
  )
}
