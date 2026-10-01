import { Fragment, useRef, useState } from 'react'
import type { CardSet, Subject } from '../db/types'
import { buildCloze, editSentence, parseCloze, toggleWord, words, type Blank, type ClozeDraft } from '../notes/cloze'
import { Added, Field, SharedFields, type SharedValues } from './CardForm'
import RichText from './RichText'
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
 * Blank (cloze) cards, in two steps: write a sentence, then tap the words to
 * hide. Each hidden word (or run of words next to each other) becomes its
 * own card asking you to fill it in. Typing {{braces}} works too.
 */
export default function ClozeForm({ mode, initial, subjects, sets, tagSuggestions, onSave, onCancel, onSharedChange }: Props) {
  const [draft, setDraft] = useState<ClozeDraft>(() => parseCloze(initial.front))
  const [step, setStep] = useState<'write' | 'pick'>(() => (parseCloze(initial.front).blanks.length ? 'pick' : 'write'))
  const [extra, setExtra] = useState(initial.extra)
  const [showExtra, setShowExtra] = useState(initial.extra !== '')
  const [hinting, setHinting] = useState<number | null>(null)
  const [shared, setShared] = useState<SharedValues>({ setId: initial.setId, tags: initial.tags })
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState(0)
  const sentenceRef = useRef<HTMLTextAreaElement>(null)
  const blanks = [...draft.blanks].sort((a, b) => a.start - b.start)
  const count = blanks.length
  const canSave = count > 0 && shared.setId !== '' && !saving

  async function save() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({ ...shared, front: buildCloze(draft), extra })
      if (mode === 'add') {
        setDraft({ text: '', blanks: [] })
        setExtra('')
        setShowExtra(false)
        setHinting(null)
        setStep('write')
        setAdded((n) => n + 1)
        // After the step switches back, so the box exists to focus.
        setTimeout(() => sentenceRef.current?.focus(), 0)
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

  const stepTitle = 'mb-1 flex items-baseline gap-2 text-sm font-semibold text-muted'
  const stepNumber = 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent'

  return (
    <form
      onKeyDown={(e) => {
        if (!e.defaultPrevented && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          if (step === 'write') setStep('pick')
          else void save()
        }
      }}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="flex flex-col gap-4"
    >
      {mode === 'add' && (
        <p className="text-muted">
          Write a fact as a sentence, then pick the words to hide. Each hidden word becomes a card that asks you to fill in the blank.
        </p>
      )}

      {step === 'write' ? (
        <div>
          <label htmlFor="cloze-sentence" className={stepTitle}>
            <span className={stepNumber}>1</span> Write the sentence
          </label>
          <textarea
            id="cloze-sentence"
            ref={sentenceRef}
            className={`${input} min-h-28 resize-y`}
            value={draft.text}
            onChange={(e) => setDraft(editSentence(draft, e.target.value))}
            placeholder="e.g. The Glorious Revolution took place in 1688"
            autoFocus
          />
          <button
            type="button"
            className={`${btn.primary} mt-3 w-full`}
            disabled={!draft.text.trim()}
            onClick={() => setStep('pick')}
          >
            Next: pick words to hide
          </button>
          <Added count={added} text="Added ✓ Write the next one" />
        </div>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between">
              <p className={stepTitle} id="cloze-words-label">
                <span className={stepNumber}>2</span> Tap the words to hide
              </p>
              <button type="button" className={`${btn.ghost} -mr-3 min-h-10 text-sm`} onClick={() => setStep('write')}>
                Change sentence
              </button>
            </div>
            <div role="group" aria-labelledby="cloze-words-label" className="card flex flex-wrap items-center gap-x-1.5 gap-y-2 p-3">
              <TapWords draft={draft} onTap={(next) => setDraft({ ...draft, blanks: next })} />
            </div>
            <p className="mt-1 text-sm text-muted">Words next to each other join into one blank. Tap a hidden word again to show it.</p>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-muted">
              {count === 0 ? 'Your cards will appear here' : `This makes ${count} ${count === 1 ? 'card' : 'cards'}`}
            </p>
            {count > 0 && (
              <ol className="flex flex-col gap-2">
                {blanks.map((b, i) => (
                  <li key={`${b.start}-${b.end}`} className="card px-3 py-2.5">
                    <p className="mb-1 text-xs font-bold tracking-wider text-muted uppercase">Card {i + 1}</p>
                    <RichText text={buildCloze(draft)} cloze={{ active: i + 1, revealed: false }} className="text-base" />
                    {hinting === i || b.hint ? (
                      <input
                        className={`${input} mt-2 py-2 text-base`}
                        aria-label={`Hint for card ${i + 1}`}
                        placeholder="Hint shown in the blank, e.g. year"
                        value={b.hint}
                        onChange={(e) => setHint(b, e.target.value.replace(/[{}]|::/g, ''))}
                        autoFocus={hinting === i}
                      />
                    ) : (
                      <button type="button" className="mt-1 min-h-9 text-sm font-semibold text-accent" onClick={() => setHinting(i)}>
                        + Add a hint
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {showExtra ? (
            <Field id="cloze-extra" title="Note" hint="(shown with the answer)">
              <RichTextField
                labelledBy="cloze-extra-label"
                value={extra}
                onChange={setExtra}
                onSubmit={() => void save()}
                placeholder="e.g. The Bill of Rights followed in 1689"
                minRows={2}
                autoFocus={extra === ''}
              />
            </Field>
          ) : (
            <button type="button" className="-mt-1 self-start text-sm font-semibold text-accent" onClick={() => setShowExtra(true)}>
              + Add a note to show with the answer
            </button>
          )}
          <SharedFields subjects={subjects} sets={sets} values={shared} suggestions={tagSuggestions} onChange={changeShared} />

          <div className="flex items-center gap-3">
            <button type="submit" className={`${btn.primary} flex-1 sm:flex-none`} disabled={!canSave} title="Ctrl+Enter">
              {mode === 'edit' ? 'Save' : count === 0 ? 'Tap a word to hide first' : count > 1 ? `Add ${count} cards` : 'Add card'}
            </button>
            {onCancel && (
              <button type="button" className={btn.secondary} onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </>
      )}
      {step === 'write' && onCancel && (
        <button type="button" className={`${btn.secondary} self-start`} onClick={onCancel}>
          Cancel
        </button>
      )}
      <p className="hidden text-sm text-muted lg:block">On a computer you can also type blanks as {'{{1688}}'} in the sentence.</p>
    </form>
  )
}

/** The sentence as a row of word buttons; hidden words are filled in and numbered. */
function TapWords({ draft, onTap }: { draft: ClozeDraft; onTap: (blanks: Blank[]) => void }) {
  const { text } = draft
  const blanks = [...draft.blanks].sort((a, b) => a.start - b.start)
  const blankAt = (pos: number) => blanks.findIndex((b) => pos >= b.start && pos < b.end)
  const list = words(text)
  let last = 0
  return (
    <>
      {list.map((w) => {
        // Punctuation between words is shown, but isn't tappable.
        const between = text.slice(last, w.start).trim()
        last = w.end
        const n = blankAt(w.start)
        const isFirst = n >= 0 && blanks[n].start === w.start
        return (
          <Fragment key={w.start}>
            {between && <span className="text-lg text-muted">{between}</span>}
            <button
              type="button"
              onClick={() => onTap(toggleWord(draft, w))}
              aria-pressed={n >= 0}
              className={`inline-flex min-h-11 items-center gap-1 rounded-btn border-2 px-2.5 text-lg ${
                n >= 0
                  ? 'border-accent bg-accent font-semibold text-on-accent'
                  : 'border-line bg-surface text-ink hover:border-accent'
              }`}
            >
              {isFirst && (
                <span className="rounded-full bg-on-accent px-1.5 text-xs font-bold text-accent" aria-label={`blank ${n + 1}`}>
                  {n + 1}
                </span>
              )}
              {text.slice(w.start, w.end)}
            </button>
          </Fragment>
        )
      })}
      {text.slice(last).trim() && <span className="text-lg text-muted">{text.slice(last).trim()}</span>}
    </>
  )
}
