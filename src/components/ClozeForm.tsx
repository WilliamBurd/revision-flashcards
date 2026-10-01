import { Fragment, useRef, useState } from 'react'
import type { CardSet, Subject } from '../db/types'
import { buildCloze, editSentence, parseCloze, toggleWord, words, type Blank, type ClozeDraft } from '../notes/cloze'
import { Added, Field, SharedFields, type SharedValues } from './CardForm'
import RichTextField from './RichTextField'
import { btn, input } from './ui'

export interface ClozeValues extends SharedValues {
  /** Stored form, with {{blanks}}. */
  front: string
  extra: string
}

interface Props {
  mode: 'add' | 'edit'
  initial: ClozeValues
  subjects: Subject[]
  sets: CardSet[]
  tagSuggestions: string[]
  onSave: (values: ClozeValues) => Promise<void>
  onCancel?: () => void
  onSharedChange?: (shared: SharedValues) => void
}

/**
 * Cloze cards: type a sentence, then tap the words to hide. Each blank
 * becomes its own card. Typing {{braces}} works too.
 */
export default function ClozeForm({ mode, initial, subjects, sets, tagSuggestions, onSave, onCancel, onSharedChange }: Props) {
  const [draft, setDraft] = useState<ClozeDraft>(() => parseCloze(initial.front))
  const [extra, setExtra] = useState(initial.extra)
  const [shared, setShared] = useState<SharedValues>({ setId: initial.setId, tags: initial.tags })
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState(0)
  const sentenceRef = useRef<HTMLTextAreaElement>(null)
  const count = draft.blanks.length
  const canSave = count > 0 && shared.setId !== '' && !saving

  async function save() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({ ...shared, front: buildCloze(draft), extra })
      if (mode === 'add') {
        setDraft({ text: '', blanks: [] })
        setExtra('')
        setAdded((n) => n + 1)
        sentenceRef.current?.focus()
      }
    } finally {
      setSaving(false)
    }
  }

  const changeShared = (next: Partial<SharedValues>) => {
    const merged = { ...shared, ...next }
    setShared(merged)
    onSharedChange?.(merged)
  }

  const setHint = (blank: Blank, hint: string) =>
    setDraft((d) => ({ ...d, blanks: d.blanks.map((b) => (b.start === blank.start ? { ...b, hint } : b)) }))

  return (
    <form
      onKeyDown={(e) => {
        if (!e.defaultPrevented && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          void save()
        }
      }}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <label htmlFor="cloze-sentence" className="mb-1 block text-sm font-semibold text-muted">
          Sentence
        </label>
        <textarea
          id="cloze-sentence"
          ref={sentenceRef}
          className={`${input} min-h-24 resize-y`}
          value={draft.text}
          onChange={(e) => setDraft(editSentence(draft, e.target.value))}
          placeholder="e.g. The Glorious Revolution took place in 1688"
          autoFocus
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold text-muted" id="cloze-words-label">
          Tap the words to hide
          <span className="ml-2 font-normal">{count === 0 ? '' : `Makes ${count} ${count === 1 ? 'card' : 'cards'}`}</span>
        </p>
        <div aria-labelledby="cloze-words-label" className="card min-h-16 px-3 py-3 text-lg leading-10">
          {draft.text.trim() ? (
            <TapWords draft={draft} onTap={(blanks) => setDraft({ ...draft, blanks })} />
          ) : (
            <span className="text-muted">Your sentence appears here as you type.</span>
          )}
        </div>
      </div>

      {count > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold text-muted">
            Hints <span className="font-normal">(optional, shown instead of [...])</span>
          </p>
          <ul className="flex flex-col gap-2">
            {[...draft.blanks]
              .sort((a, b) => a.start - b.start)
              .map((b, i) => (
                <li key={`${b.start}-${b.end}`} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-sm font-bold text-accent">{i + 1}</span>
                  <span className="max-w-[40%] shrink-0 truncate font-semibold">{draft.text.slice(b.start, b.end)}</span>
                  <input
                    className={`${input} min-w-0 flex-1 py-2 text-base`}
                    aria-label={`Hint for blank ${i + 1}`}
                    placeholder="e.g. year"
                    value={b.hint}
                    onChange={(e) => setHint(b, e.target.value.replace(/[{}]|::/g, ''))}
                  />
                </li>
              ))}
          </ul>
        </div>
      )}

      <Field id="cloze-extra" title="Extra" hint="(optional, shown after the answer)">
        <RichTextField
          labelledBy="cloze-extra-label"
          value={extra}
          onChange={setExtra}
          onSubmit={() => void save()}
          placeholder="e.g. The Bill of Rights followed in 1689"
          minRows={2}
        />
      </Field>
      <SharedFields subjects={subjects} sets={sets} values={shared} suggestions={tagSuggestions} onChange={changeShared} />

      <div className="flex items-center gap-3">
        <button type="submit" className={`${btn.primary} flex-1 sm:flex-none`} disabled={!canSave} title="Ctrl+Enter">
          {mode === 'add' ? (count > 1 ? `Add ${count} cards` : 'Add card') : 'Save'}
        </button>
        {onCancel && (
          <button type="button" className={btn.secondary} onClick={onCancel}>
            Cancel
          </button>
        )}
        <Added count={added} />
      </div>
      <p className="hidden text-sm text-muted lg:block">
        You can also type blanks as {'{{1688}}'}, or {'{{1688::year}}'} for a hint.
      </p>
    </form>
  )
}

/** The sentence as tappable words, with blanks highlighted and numbered. */
function TapWords({ draft, onTap }: { draft: ClozeDraft; onTap: (blanks: Blank[]) => void }) {
  const { text } = draft
  const blanks = [...draft.blanks].sort((a, b) => a.start - b.start)
  const blankAt = (pos: number) => blanks.findIndex((b) => pos >= b.start && pos < b.end)
  const list = words(text)
  let last = 0
  return (
    <>
      {list.map((w) => {
        const gap = text.slice(last, w.start)
        const gapBlank = gap && blankAt(last) >= 0 && blankAt(w.start) === blankAt(last)
        last = w.end
        const n = blankAt(w.start)
        const isFirst = n >= 0 && blanks[n].start === w.start
        return (
          <Fragment key={w.start}>
            {gap && <span className={gapBlank ? 'bg-accent-soft py-1.5' : ''}>{gap}</span>}
            <button
              type="button"
              onClick={() => onTap(toggleWord(draft, w))}
              aria-pressed={n >= 0}
              className={`rounded-md px-1 py-1 ${
                n >= 0 ? 'bg-accent-soft font-semibold text-on-accent-soft' : 'underline decoration-line decoration-2 underline-offset-4 hover:bg-raised'
              }`}
            >
              {isFirst && <sup className="mr-0.5 text-xs font-bold text-accent">{n + 1}</sup>}
              {text.slice(w.start, w.end)}
            </button>
          </Fragment>
        )
      })}
      <span>{text.slice(last)}</span>
    </>
  )
}
