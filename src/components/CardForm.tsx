import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { CardSet, Subject } from '../db/types'
import RichTextField, { type RichTextFieldHandle } from './RichTextField'
import SetSelect from './SetSelect'
import TagInput from './TagInput'
import { btn, label } from './ui'

/** What every kind of note has, kept between cards on the Add screen. */
export interface SharedValues {
  setId: string
  tags: string[]
}

export interface CardValues extends SharedValues {
  front: string
  back: string
  reverse: boolean
}

interface Props {
  mode: 'add' | 'edit'
  initial: CardValues
  subjects: Subject[]
  sets: CardSet[]
  tagSuggestions: string[]
  onSave: (values: CardValues) => Promise<void>
  onCancel?: () => void
  /** Called when the set or tags change, so the Add screen can keep them. */
  onSharedChange?: (shared: SharedValues) => void
}

/**
 * Front / Back / Set form, used for quick add and for editing basic cards.
 * In add mode, saving clears Front and Back, keeps the set and tags, and
 * puts the cursor back in Front so you can add card after card.
 */
export default function CardForm({ mode, initial, subjects, sets, tagSuggestions, onSave, onCancel, onSharedChange }: Props) {
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState(0)
  const frontRef = useRef<RichTextFieldHandle>(null)
  const canSave = values.front.trim() !== '' && values.back.trim() !== '' && values.setId !== '' && !saving

  const latest = useRef(values)
  latest.current = values

  async function save() {
    const v = latest.current
    if (v.front.trim() === '' || v.back.trim() === '' || !v.setId || saving) return
    setSaving(true)
    try {
      await onSave(v)
      if (mode === 'add') {
        change({ front: '', back: '' })
        setAdded((n) => n + 1)
        frontRef.current?.focus()
      }
    } finally {
      setSaving(false)
    }
  }

  function change(next: Partial<CardValues>) {
    const merged = { ...latest.current, ...next }
    latest.current = merged
    setValues(merged)
    if (next.setId !== undefined || next.tags !== undefined) onSharedChange?.({ setId: merged.setId, tags: merged.tags })
  }

  // Ctrl+Enter or Cmd+Enter saves from anywhere in the form.
  function onKeyDown(e: KeyboardEvent) {
    if (e.defaultPrevented) return // the text boxes handle it themselves
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void save()
    }
  }

  return (
    <form
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="flex flex-col gap-4"
    >
      <Field id="card-front" title="Front">
        <RichTextField
          ref={frontRef}
          labelledBy="card-front-label"
          value={values.front}
          onChange={(front) => change({ front })}
          onSubmit={() => void save()}
          placeholder="e.g. When was the Battle of Bosworth?"
          autoFocus
        />
      </Field>
      <Field id="card-back" title="Back">
        <RichTextField
          labelledBy="card-back-label"
          value={values.back}
          onChange={(back) => change({ back })}
          onSubmit={() => void save()}
          placeholder="e.g. 1485"
        />
      </Field>
      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-accent"
          checked={values.reverse}
          onChange={(e) => change({ reverse: e.target.checked })}
        />
        <span>
          Also make a reversed card
          <span className="block text-sm text-muted">Shows the Back and asks for the Front</span>
        </span>
      </label>
      <SharedFields subjects={subjects} sets={sets} values={values} suggestions={tagSuggestions} onChange={change} />

      <div className="flex items-center gap-3">
        <button type="submit" className={`${btn.primary} flex-1 sm:flex-none`} disabled={!canSave} title="Ctrl+Enter">
          {mode === 'add' ? (values.reverse ? 'Add 2 cards' : 'Add card') : 'Save'}
        </button>
        {onCancel && (
          <button type="button" className={btn.secondary} onClick={onCancel}>
            Cancel
          </button>
        )}
        <Added count={added} />
      </div>
      <p className="hidden text-sm text-muted lg:block">
        Tab moves to Back. Ctrl+Enter (Cmd+Enter on Mac) saves. Ctrl+B bold, Ctrl+I italics.
      </p>
    </form>
  )
}

/** A label above a field. The label's id is `${id}-label`. */
export function Field({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p id={`${id}-label`} className={label}>
        {title}
        {hint && <span className="ml-2 font-normal">{hint}</span>}
      </p>
      {children}
    </div>
  )
}

/** Set and tags, shared by all the card forms. */
export function SharedFields(props: {
  subjects: Subject[]
  sets: CardSet[]
  values: SharedValues
  suggestions: string[]
  onChange: (shared: Partial<SharedValues>) => void
}) {
  return (
    <>
      <div>
        <label htmlFor="card-set" className={label}>
          Set
        </label>
        <SetSelect
          id="card-set"
          value={props.values.setId}
          subjects={props.subjects}
          sets={props.sets}
          onChange={(setId) => props.onChange({ setId })}
        />
      </div>
      <div>
        <label htmlFor="card-tags" className={label}>
          Tags <span className="font-normal">(optional)</span>
        </label>
        <TagInput id="card-tags" tags={props.values.tags} suggestions={props.suggestions} onChange={(tags) => props.onChange({ tags })} />
      </div>
    </>
  )
}

/** "Added ✓", re-keyed on every add so it animates each time. */
export function Added({ count, text = 'Added ✓' }: { count: number; text?: string }) {
  return (
    <span key={count} role="status" className="font-medium text-positive">
      {count > 0 ? text : ''}
    </span>
  )
}
