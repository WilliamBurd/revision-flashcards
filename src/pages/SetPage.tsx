import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import { CountsLine, ProgressBar, ProgressKey } from '../components/Counts'
import { BackIcon } from '../components/Icons'
import NameDialog from '../components/NameDialog'
import { CardsBadge, NotePreview } from '../components/NotePreview'
import { btn, input, panel } from '../components/ui'
import { db } from '../db/db'
import { useOverview } from '../db/hooks'
import { deleteSet, updateSet } from '../db/subjects'
import { download, exportBackup, safeFileName } from '../backup/backup'
import { exportSetCsv, importCsv } from '../backup/cards-csv'
import type { Card, Note } from '../db/types'

export default function SetPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const overview = useOverview()
  const data = useLiveQuery(async () => {
    const set = await db.sets.get(id)
    if (!set || set.deleted) return null
    const [subject, notes, cards] = await Promise.all([
      db.subjects.get(set.subject_id),
      db.notes.where('set_id').equals(id).toArray(),
      db.cards.where('set_id').equals(id).toArray(),
    ])
    const cardsByNote = new Map<string, Card[]>()
    for (const c of cards) if (!c.deleted) cardsByNote.set(c.note_id, [...(cardsByNote.get(c.note_id) ?? []), c])
    return {
      set,
      subject,
      notes: notes.filter((n) => !n.deleted).sort((a, b) => b.created_at - a.created_at),
      cardsByNote,
    }
  }, [id])
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)

  if (data === undefined || !overview) return null
  if (data === null) return <p className="py-6 text-muted">This set has been deleted.</p>

  const { set, subject, notes, cardsByNote } = data
  const counts = overview.bySet.get(set.id)
  const ready = (counts?.due ?? 0) + (counts?.newToday ?? 0)

  return (
    <div className="py-6">
      <Link to="/" className={`${btn.ghost} -ml-4 mb-2`}>
        <BackIcon width={20} height={20} /> Home
      </Link>
      <p className="text-sm text-muted">{subject?.name}</p>
      <h1 className="mb-1 text-2xl font-bold break-words">{set.name}</h1>
      <CountsLine counts={counts} />
      <div className="mt-3 flex flex-col gap-2">
        <ProgressBar counts={counts} />
        <ProgressKey />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link
          to={`/review?set=${set.id}`}
          className={`${btn.primary} ${ready ? '' : 'pointer-events-none opacity-60'}`}
          aria-disabled={!ready}
        >
          {ready ? `Review (${ready})` : 'Nothing due'}
        </Link>
        <Link to={`/add?set=${set.id}`} className={btn.secondary}>
          Add cards
        </Link>
        {(counts?.total ?? 0) > 0 && (
          <Link to={`/review?set=${set.id}&cram=1`} className={`${btn.secondary} col-span-2`}>
            Cram all {counts?.total} cards
          </Link>
        )}
      </div>
      {(counts?.total ?? 0) > 0 && (
        <p className="mt-1.5 text-center text-xs text-muted">Cram goes through every card in a random order without changing when they're due.</p>
      )}

      <div className="mt-8 mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cards</h2>
        {notes.length > 0 && (
          <Link to={`/browse?set=${set.id}`} className={`${btn.ghost} -mr-4`}>
            Search or select
          </Link>
        )}
      </div>
      {notes.length === 0 ? (
        <p className="text-muted">No cards yet.</p>
      ) : (
        <ul className={`${panel} divide-y divide-line`}>
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} cards={cardsByNote.get(note.id) ?? []} />
          ))}
        </ul>
      )}

      <h2 className="mt-8 mb-2 text-lg font-semibold">Set options</h2>
      <div className={`${panel} flex flex-col gap-4 p-4`}>
        <label className="flex items-center justify-between gap-4">
          <span>New cards per day</span>
          <input
            type="number"
            min={0}
            max={999}
            inputMode="numeric"
            className={`${input.replace('w-full ', '')} w-24 shrink-0 text-center`}
            defaultValue={set.new_cards_per_day}
            onBlur={(e) => {
              const n = Math.max(0, Math.min(999, Math.round(Number(e.target.value))))
              if (Number.isFinite(n) && n !== set.new_cards_per_day) void updateSet(set.id, { new_cards_per_day: n })
            }}
          />
        </label>
        <div className="flex flex-col gap-1">
          <label className="flex items-center justify-between gap-4">
            <span>Exam date for this set</span>
            <input
              type="date"
              className={`${input.replace('w-full ', '')} w-44 shrink-0 py-2 text-base`}
              value={set.exam_date_override ?? ''}
              onChange={(e) => void updateSet(set.id, { exam_date_override: e.target.value || null })}
            />
          </label>
          <p className="text-sm text-muted">
            {set.exam_date_override ? (
              <>
                Used instead of {subject?.name ?? 'the subject'}'s exam dates.{' '}
                <button type="button" className="font-semibold text-accent" onClick={() => void updateSet(set.id, { exam_date_override: null })}>
                  Clear
                </button>
              </>
            ) : (
              `Leave empty to use ${subject?.name ?? 'the subject'}'s exam dates (set them from the subject's menu on Home).`
            )}
          </p>
        </div>
        <CsvTools setId={set.id} fileName={safeFileName(`${subject?.name ?? 'Cards'} - ${set.name}`)} />
        <div className="flex gap-2">
          <button type="button" className={btn.secondary} onClick={() => setDialog('rename')}>
            Rename
          </button>
          <button type="button" className={`${btn.secondary} text-danger`} onClick={() => setDialog('delete')}>
            Delete set…
          </button>
        </div>
      </div>

      <NameDialog
        open={dialog === 'rename'}
        title="Rename set"
        label="Set name"
        initial={set.name}
        submitLabel="Rename"
        onSubmit={(name) => void updateSet(set.id, { name })}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={`Delete ${set.name}?`}
        message={`This deletes the set and its ${notes.length} ${notes.length === 1 ? 'card' : 'cards'}.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteSet(set.id)
          navigate('/')
        }}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}

function NoteRow({ note, cards }: { note: Note; cards: Card[] }) {
  return (
    <li>
      <Link to={`/notes/${note.id}/edit`} className="flex min-h-14 items-start gap-3 px-4 py-3 hover:bg-raised">
        <NotePreview note={note} />
        <CardsBadge cards={cards} />
      </Link>
    </li>
  )
}

function CsvTools({ setId, fileName }: { setId: string; fileName: string }) {
  const file = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function importFile(f: File) {
    try {
      const { notes, skipped } = await importCsv(await f.text(), setId)
      const added = `Added ${notes.length} ${notes.length === 1 ? 'card' : 'cards'}`
      setMessage({
        ok: notes.length > 0,
        text: skipped ? `${added}. Skipped ${skipped} ${skipped === 1 ? 'row' : 'rows'} without both a front and a back.` : `${added}.`,
      })
    } catch {
      setMessage({ ok: false, text: "That file couldn't be read. Choose a .csv file." })
    } finally {
      if (file.current) file.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span>Export and import</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btn.secondary}
          onClick={async () => download(`${fileName}.csv`, await exportSetCsv(setId), 'text/csv')}
        >
          Export CSV
        </button>
        <button type="button" className={btn.secondary} onClick={() => file.current?.click()}>
          Import CSV
        </button>
        <button
          type="button"
          className={btn.secondary}
          onClick={async () => download(`${fileName}.json`, JSON.stringify(await exportBackup({ setId })), 'application/json')}
        >
          Back up with progress
        </button>
        <input
          ref={file}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importFile(f)
          }}
        />
      </div>
      <p className="text-sm text-muted">
        CSV has columns front, back and tags, for spreadsheets or other apps. Fronts with {'{{blanks}}'} become blanks
        cards. A backup also keeps your progress; import it from Settings.
      </p>
      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-positive' : 'text-danger'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
