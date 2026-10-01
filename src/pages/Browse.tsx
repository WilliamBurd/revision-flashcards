import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import { CloseIcon, SearchIcon } from '../components/Icons'
import Modal from '../components/Modal'
import { CardsBadge, NotePreview } from '../components/NotePreview'
import SetSelect from '../components/SetSelect'
import { btn, input, label } from '../components/ui'
import { db } from '../db/db'
import { useLibrary, useTags } from '../db/hooks'
import { addTagToNotes, deleteNotes, moveNotes, removeTagFromNotes } from '../db/notes'
import type { Card, Note } from '../db/types'
import { toPlain } from '../notes/format'

const PAGE = 100
const LONG_PRESS_MS = 500

type Dialog = 'move' | 'add-tag' | 'remove-tag' | 'delete' | null

/** Every card, with search, filters, and actions on several at once. */
export default function Browse() {
  const library = useLibrary()
  const allTags = useTags()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const where = params.get('set') ? `set:${params.get('set')}` : params.get('subject') ? `subject:${params.get('subject')}` : ''
  const tag = params.get('tag') ?? ''

  const data = useLiveQuery(async () => {
    const [notes, cards] = await Promise.all([db.notes.toArray(), db.cards.toArray()])
    const cardsByNote = new Map<string, Card[]>()
    for (const c of cards) if (!c.deleted) cardsByNote.set(c.note_id, [...(cardsByNote.get(c.note_id) ?? []), c])
    const live = notes.filter((n) => !n.deleted).sort((a, b) => b.created_at - a.created_at)
    // Worked out once per change, so typing in the search box stays quick.
    return { notes: live.map((note) => ({ note, search: `${toPlain(note.front)} ${toPlain(note.back)}`.toLowerCase() })), cardsByNote }
  })

  const [shown, setShown] = useState(PAGE)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<Dialog>(null)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
    setShown(PAGE)
  }
  const setWhere = (value: string) => {
    const next = new URLSearchParams(params)
    next.delete('set')
    next.delete('subject')
    const [kind, id] = value.split(':')
    if (id) next.set(kind, id)
    setParams(next, { replace: true })
    setShown(PAGE)
  }

  const results = useMemo(() => {
    if (!data || !library) return []
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const [kind, id] = where.split(':')
    const inScope = (n: Note) =>
      !id || (kind === 'set' ? n.set_id === id : library.sets.find((s) => s.id === n.set_id)?.subject_id === id)
    const lowerTag = tag.toLowerCase()
    return data.notes
      .filter(({ note, search }) => inScope(note) && (!tag || note.tags?.some((t) => t.toLowerCase() === lowerTag)) && words.every((w) => search.includes(w)))
      .map((r) => r.note)
  }, [data, library, q, where, tag])

  if (!data || !library) return null
  const setName = new Map(library.sets.map((s) => [s.id, s.name]))
  const selectedNotes = results.filter((n) => selected.has(n.id))
  const selectedIds = selectedNotes.map((n) => n.id)
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const stopSelecting = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const total = data.notes.length

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Browse</h1>
        {total > 0 && !selecting && (
          <button type="button" className={btn.ghost} onClick={() => setSelecting(true)}>
            Select
          </button>
        )}
      </div>

      {total === 0 ? (
        <p className="text-muted">
          No cards yet. <Link to="/add" className="font-semibold text-accent">Add some</Link> and they'll all be listed here.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" width={20} height={20} />
              <input
                type="search"
                className={`${input} pl-10`}
                placeholder="Search cards"
                aria-label="Search cards"
                value={q}
                onChange={(e) => setParam('q', e.target.value)}
                enterKeyHint="search"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className={`${input} text-base`} aria-label="Subject or set" value={where} onChange={(e) => setWhere(e.target.value)}>
                <option value="">All sets</option>
                {library.subjects.map((subject) => (
                  <optgroup key={subject.id} label={subject.name}>
                    <option value={`subject:${subject.id}`}>All of {subject.name}</option>
                    {library.sets
                      .filter((s) => s.subject_id === subject.id)
                      .map((s) => (
                        <option key={s.id} value={`set:${s.id}`}>
                          {s.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <select className={`${input} text-base`} aria-label="Tag" value={tag} onChange={(e) => setParam('tag', e.target.value)}>
                <option value="">Any tag</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                {tag && !allTags.includes(tag) && <option value={tag}>{tag}</option>}
              </select>
            </div>
          </div>

          {selecting && (
            <div className="sticky top-0 z-20 -mx-4 mt-3 border-b border-line bg-page/95 px-4 py-2 backdrop-blur">
              <div className="flex items-center gap-2">
                <button type="button" className={btn.icon} aria-label="Stop selecting" onClick={stopSelecting}>
                  <CloseIcon />
                </button>
                <p className="flex-1 font-semibold" aria-live="polite">
                  {selectedIds.length} selected
                </p>
                <button
                  type="button"
                  className={btn.ghost}
                  onClick={() => setSelected(selectedIds.length === results.length ? new Set() : new Set(results.map((n) => n.id)))}
                >
                  {selectedIds.length === results.length && results.length > 0 ? 'None' : 'All'}
                </button>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {(
                  [
                    ['move', 'Move'],
                    ['add-tag', 'Tag'],
                    ['remove-tag', 'Untag'],
                    ['delete', 'Delete'],
                  ] as const
                ).map(([d, text]) => (
                  <button
                    key={d}
                    type="button"
                    className={`${btn.secondary} px-2 ${d === 'delete' ? 'text-danger' : ''}`}
                    disabled={!selectedIds.length}
                    onClick={() => setDialog(d)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 mb-2 text-sm text-muted" aria-live="polite">
            {results.length === total ? `${total} ${total === 1 ? 'note' : 'notes'}` : `${results.length} of ${total} notes`}
            {!selecting && results.length > 1 && <span className="hidden sm:inline"> · press and hold one to select several</span>}
          </p>
          {results.length === 0 ? (
            <p className="text-muted">Nothing matches. Try fewer words or another filter.</p>
          ) : (
            <ul className="card divide-y divide-line">
              {results.slice(0, shown).map((note) => (
                <Row
                  key={note.id}
                  note={note}
                  cards={data.cardsByNote.get(note.id) ?? []}
                  setName={setName.get(note.set_id) ?? ''}
                  showSet={!where.startsWith('set:')}
                  activeTag={tag}
                  selecting={selecting}
                  selected={selected.has(note.id)}
                  onToggle={() => toggle(note.id)}
                  onLongPress={() => {
                    setSelecting(true)
                    setSelected((s) => new Set(s).add(note.id))
                  }}
                  onTag={(t) => setParam('tag', t)}
                />
              ))}
            </ul>
          )}
          {results.length > shown && (
            <button type="button" className={`${btn.secondary} mt-3 w-full`} onClick={() => setShown((n) => n + PAGE)}>
              Show more ({results.length - shown} left)
            </button>
          )}
        </>
      )}

      <MoveDialog
        open={dialog === 'move'}
        count={selectedIds.length}
        library={library}
        onClose={() => setDialog(null)}
        onMove={async (setId) => {
          await moveNotes(selectedIds, setId)
          stopSelecting()
        }}
      />
      <TagDialog
        open={dialog === 'add-tag'}
        title={`Add a tag to ${selectedIds.length}`}
        options={allTags}
        allowNew
        onClose={() => setDialog(null)}
        onPick={async (t) => {
          await addTagToNotes(selectedIds, t)
          stopSelecting()
        }}
      />
      <TagDialog
        open={dialog === 'remove-tag'}
        title={`Remove a tag from ${selectedIds.length}`}
        options={[...new Set(selectedNotes.flatMap((n) => n.tags ?? []))]}
        onClose={() => setDialog(null)}
        onPick={async (t) => {
          await removeTagFromNotes(selectedIds, t)
          stopSelecting()
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={`Delete ${selectedIds.length} ${selectedIds.length === 1 ? 'note' : 'notes'}?`}
        message={`This deletes ${countCards(selectedIds, data.cardsByNote)} cards and can't be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteNotes(selectedIds)
          stopSelecting()
        }}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}

const countCards = (ids: string[], byNote: Map<string, Card[]>) => ids.reduce((n, id) => n + (byNote.get(id)?.length ?? 0), 0)

function Row(props: {
  note: Note
  cards: Card[]
  setName: string
  showSet: boolean
  activeTag: string
  selecting: boolean
  selected: boolean
  onToggle: () => void
  onLongPress: () => void
  onTag: (tag: string) => void
}) {
  const { note, selecting, selected } = props
  const timer = useRef<number | null>(null)
  const pressed = useRef(false)
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }

  const body = (
    <>
      {selecting && (
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
            selected ? 'border-accent bg-accent text-on-accent' : 'border-line'
          }`}
        >
          {selected && '✓'}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <NotePreview note={note} />
        {(props.showSet || note.type === 'cloze' || note.make_reverse || (selecting && note.tags?.length > 0)) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {props.showSet && <span className="font-semibold">{props.setName}</span>}
            {note.type === 'cloze' && <span>Blanks</span>}
            {note.make_reverse && <span>+ reversed</span>}
            {selecting && (note.tags ?? []).map((t) => <TagChip key={t} tag={t} active={props.activeTag} />)}
          </div>
        )}
      </div>
      <CardsBadge cards={props.cards} />
    </>
  )

  const rowClass = `flex min-h-14 select-none [-webkit-touch-callout:none] w-full items-start gap-3 px-4 py-3 text-left hover:bg-raised ${selected ? 'bg-accent-soft/50' : ''}`
  const press = {
    onPointerDown: () => {
      pressed.current = false
      if (selecting) return
      timer.current = window.setTimeout(() => {
        pressed.current = true
        props.onLongPress()
      }, LONG_PRESS_MS)
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      // Android opens a menu on long-press; selecting is what was meant.
      if (!selecting) e.preventDefault()
    },
  }

  return (
    <li className="relative">
      {selecting ? (
        <button type="button" className={rowClass} aria-pressed={selected} onClick={props.onToggle}>
          {body}
        </button>
      ) : (
        <Link
          to={`/notes/${note.id}/edit`}
          className={rowClass}
          {...press}
          onClick={(e) => {
            // The long-press already selected it; don't also open it.
            if (pressed.current) e.preventDefault()
          }}
        >
          {body}
        </Link>
      )}
      {!selecting && note.tags?.length > 0 && (
        // Tags sit under the row; tapping one shows every card with it.
        <div className="-mt-2 flex flex-wrap gap-1.5 px-4 pb-3">
          {note.tags.map((t) => (
            <button key={t} type="button" aria-label={`Show cards tagged ${t}`} onClick={() => props.onTag(t)}>
              <TagChip tag={t} active={props.activeTag} />
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

function TagChip({ tag, active }: { tag: string; active: string }) {
  const on = tag.toLowerCase() === active.toLowerCase()
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${on ? 'bg-accent text-on-accent' : 'bg-accent-soft text-on-accent-soft'}`}>
      {tag}
    </span>
  )
}

function MoveDialog(props: {
  open: boolean
  count: number
  library: NonNullable<ReturnType<typeof useLibrary>>
  onMove: (setId: string) => Promise<void>
  onClose: () => void
}) {
  const [setId, setSetId] = useState('')
  const value = setId || props.library.sets[0]?.id || ''
  return (
    <Modal open={props.open} onClose={props.onClose} title={`Move ${props.count} to another set`}>
      <label htmlFor="move-set" className={label}>
        Set
      </label>
      <SetSelect id="move-set" value={value} subjects={props.library.subjects} sets={props.library.sets} onChange={setSetId} />
      <p className="mt-2 text-sm text-muted">Their progress moves with them.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={btn.secondary} onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={btn.primary}
          disabled={!value}
          onClick={async () => {
            await props.onMove(value)
            props.onClose()
          }}
        >
          Move
        </button>
      </div>
    </Modal>
  )
}

function TagDialog(props: {
  open: boolean
  title: string
  options: string[]
  allowNew?: boolean
  onPick: (tag: string) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState('')
  const pick = async (t: string) => {
    if (!t.trim()) return
    await props.onPick(t.trim())
    setDraft('')
    props.onClose()
  }
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.title}>
      {props.allowNew && (
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void pick(draft)
          }}
        >
          <input className={`${input} min-w-0 flex-1`} aria-label="New tag" placeholder="e.g. exam Q" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <button type="submit" className={btn.primary} disabled={!draft.trim()}>
            Add
          </button>
        </form>
      )}
      {props.options.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {props.options.map((t) => (
            <button key={t} type="button" className={`${btn.secondary} min-h-10 rounded-full`} onClick={() => void pick(t)}>
              {t}
            </button>
          ))}
        </div>
      ) : (
        !props.allowNew && <p className="text-muted">None of these cards have tags.</p>
      )}
      <div className="mt-5 flex justify-end">
        <button type="button" className={btn.secondary} onClick={props.onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
