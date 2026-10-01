import { useRef, useState, type KeyboardEvent } from 'react'
import type { CardSet, Subject } from '../db/types'
import SetSelect from './SetSelect'
import { btn, input } from './ui'

export interface CardValues {
  front: string
  back: string
  setId: string
}

interface Props {
  mode: 'add' | 'edit'
  initial: CardValues
  subjects: Subject[]
  sets: CardSet[]
  onSave: (values: CardValues) => Promise<void>
  onCancel?: () => void
  /** Called when the set changes, so the last-used set can be remembered. */
  onSetChange?: (setId: string) => void
}

/**
 * Front / Back / Set form, used for quick add and for editing.
 * In add mode, saving clears the form, keeps the set, and puts the cursor
 * back in Front so you can add card after card.
 */
export default function CardForm({ mode, initial, subjects, sets, onSave, onCancel, onSetChange }: Props) {
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState(0)
  const frontRef = useRef<HTMLTextAreaElement>(null)
  const canSave = values.front.trim() !== '' && values.back.trim() !== '' && values.setId !== '' && !saving

  async function save() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave(values)
      if (mode === 'add') {
        setValues((v) => ({ ...v, front: '', back: '' }))
        setAdded((n) => n + 1)
        frontRef.current?.focus()
      }
    } finally {
      setSaving(false)
    }
  }

  // Ctrl+Enter or Cmd+Enter saves from anywhere in the form.
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void save()
    }
  }

  const label = 'mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300'

  return (
    <form
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <label htmlFor="card-front" className={label}>
          Front
        </label>
        <textarea
          id="card-front"
          ref={frontRef}
          className={`${input} min-h-24 resize-y`}
          value={values.front}
          onChange={(e) => setValues({ ...values, front: e.target.value })}
          placeholder="e.g. When was the Battle of Bosworth?"
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="card-back" className={label}>
          Back
        </label>
        <textarea
          id="card-back"
          className={`${input} min-h-24 resize-y`}
          value={values.back}
          onChange={(e) => setValues({ ...values, back: e.target.value })}
          placeholder="e.g. 1485"
        />
      </div>
      <div>
        <label htmlFor="card-set" className={label}>
          Set
        </label>
        <SetSelect
          id="card-set"
          value={values.setId}
          subjects={subjects}
          sets={sets}
          onChange={(setId) => {
            setValues({ ...values, setId })
            onSetChange?.(setId)
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className={`${btn.primary} flex-1 sm:flex-none`} disabled={!canSave} title="Ctrl+Enter">
          {mode === 'add' ? 'Add card' : 'Save'}
        </button>
        {onCancel && (
          <button type="button" className={btn.secondary} onClick={onCancel}>
            Cancel
          </button>
        )}
        {/* Re-keyed on every add so the confirmation animates each time. */}
        <span key={added} role="status" className="font-medium text-emerald-600 dark:text-emerald-400">
          {added > 0 ? 'Added ✓' : ''}
        </span>
      </div>
      <p className="hidden text-sm text-slate-500 lg:block dark:text-slate-400">
        Tab moves to Back. Ctrl+Enter (Cmd+Enter on Mac) saves.
      </p>
    </form>
  )
}
