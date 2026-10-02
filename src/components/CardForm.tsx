import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { suggestQuestions } from '../lib/suggest'
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
  hideSet?: boolean
}

/**
 * Front / Back / Set form, used for quick add and for editing basic cards.
 * In add mode, saving clears Front and Back, keeps the set and tags, and
 * puts the cursor back in Front so you can add card after card.
 */
export default function CardForm({ mode, initial, subjects, sets, tagSuggestions, onSave, onCancel, onSharedChange, hideSet }: Props) {
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
      <SuggestQuestion
        answer={values.back}
        context={() => {
          const set = sets.find((x) => x.id === values.setId)
          return { set: set?.name, subject: subjects.find((x) => x.id === set?.subject_id)?.name }
        }}
        onPick={(front) => {
          change({ front })
          frontRef.current?.focus()
        }}
      />
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
      <SharedFields subjects={subjects} sets={sets} values={values} suggestions={tagSuggestions} onChange={change} hideSet={hideSet} />

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

/**
 * Type the answer on the Back, tap this, and pick a suggested question to put
 * on the Front. One fact per card keeps each review easy to answer.
 */
function SuggestQuestion(props: {
  answer: string
  context: () => { subject?: string; set?: string }
  onPick: (question: string) => void
}) {
  const [state, setState] = useState<{ loading: boolean; questions: string[]; error: string | null }>({
    loading: false,
    questions: [],
    error: null,
  })
  const hasAnswer = props.answer.trim() !== ''

  async function suggest() {
    setState({ loading: true, questions: [], error: null })
    const result = await suggestQuestions(props.answer, props.context())
    setState('questions' in result ? { loading: false, questions: result.questions, error: null } : { loading: false, questions: [], error: result.error })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={`${btn.secondary} self-start`}
        disabled={!hasAnswer || state.loading}
        onClick={() => void suggest()}
        title={hasAnswer ? undefined : 'Type the answer on the Back first'}
      >
        {state.loading ? 'Thinking…' : state.questions.length ? 'Suggest again' : '✨ Suggest a question'}
      </button>
      {state.questions.length > 0 && (
        <div
          ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
          className="flex flex-col gap-2"
          role="group"
          aria-label="Suggested questions"
        >
          <p className="text-sm text-muted">Tap one to put it on the Front:</p>
          {state.questions.map((q) => (
            <button
              key={q}
              type="button"
              className="rounded-btn border border-line bg-raised px-3 py-2 text-left hover:border-accent"
              onClick={() => {
                props.onPick(q)
                setState({ loading: false, questions: [], error: null })
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      )}
    </div>
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
  /** The Add screen picks the set first, at the top, so it isn't asked again here. */
  hideSet?: boolean
}) {
  return (
    <>
      <div hidden={props.hideSet}>
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
