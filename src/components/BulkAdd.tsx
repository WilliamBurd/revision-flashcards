import { useMemo, useRef, useState } from 'react'
import type { CardSet, Subject } from '../db/types'
import { bulkCardCount, parseBulk, type Separator } from '../notes/bulk'
import { Added, SharedFields, type SharedValues } from './CardForm'
import MarkupBar, { markupShortcuts } from './MarkupBar'
import RichText from './RichText'
import { btn, input, label } from './ui'

interface Props {
  initial: SharedValues
  subjects: Subject[]
  sets: CardSet[]
  tagSuggestions: string[]
  onSave: (lines: ReturnType<typeof parseBulk>, shared: SharedValues, reverse: boolean) => Promise<void>
  onSharedChange?: (shared: SharedValues) => void
  hideSet?: boolean
}

const SEPARATORS: { value: Separator; label: string }[] = [
  { value: 'auto', label: 'Dash or tab' },
  { value: 'dash', label: 'Dash ( - )' },
  { value: 'tab', label: 'Tab' },
  { value: 'custom', label: 'Something else' },
]

/** Paste many lines, one card per line, with a preview before saving. */
export default function BulkAdd({ initial, subjects, sets, tagSuggestions, onSave, onSharedChange, hideSet }: Props) {
  const [text, setText] = useState('')
  const [sep, setSep] = useState<Separator>('auto')
  const [custom, setCustom] = useState('')
  const [reverse, setReverse] = useState(false)
  const [shared, setShared] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState<number[]>([0, 0])
  const box = useRef<HTMLTextAreaElement>(null)

  const lines = useMemo(() => parseBulk(text, sep, custom), [text, sep, custom])
  const good = lines.filter((l) => l.kind !== 'error')
  const bad = lines.length - good.length
  const cards = bulkCardCount(lines, reverse)

  const changeShared = (next: Partial<SharedValues>) => {
    const merged = { ...shared, ...next }
    setShared(merged)
    onSharedChange?.(merged)
  }

  async function save() {
    if (!good.length || !shared.setId || saving) return
    setSaving(true)
    try {
      await onSave(good, shared, reverse)
      setAdded(([n]) => [n + 1, cards])
      setText('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div>
        <label htmlFor="bulk-text" className={label}>
          One card per line
        </label>
        <MarkupBar target={box} value={text} onChange={setText} bullets={false} />
        <textarea
          id="bulk-text"
          ref={box}
          onKeyDown={markupShortcuts(text, setText)}
          className={`${input} min-h-48 resize-y font-mono text-base`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Battle of Bosworth - 1485\nBattle of Stoke - 1487\nThe Star Chamber was set up in {{1487}}'}
          spellCheck={false}
          autoFocus
        />
        <p className="mt-1 text-sm text-muted">
          Write <strong>Front - Back</strong> on each line. A line like <code>took place in {'{{1688}}'}</code> makes a blanks card.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="bulk-sep" className={label}>
            Separator
          </label>
          <select id="bulk-sep" className={input} value={sep} onChange={(e) => setSep(e.target.value as Separator)}>
            {SEPARATORS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {sep === 'custom' && (
          <div>
            <label htmlFor="bulk-custom" className={label}>
              Your separator
            </label>
            <input id="bulk-custom" className={`${input} w-28`} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. =" />
          </div>
        )}
      </div>

      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input type="checkbox" className="h-5 w-5 accent-accent" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
        <span>
          Also make reversed cards
          <span className="block text-sm text-muted">For Front - Back lines, not blanks cards</span>
        </span>
      </label>
      <SharedFields subjects={subjects} sets={sets} values={shared} suggestions={tagSuggestions} onChange={changeShared} hideSet={hideSet} />


      {lines.length > 0 && (
        <section aria-label="Preview">
          <h2 className="mb-2 text-sm font-semibold text-muted">
            Preview: {cards} {cards === 1 ? 'card' : 'cards'}
            {bad > 0 && <span className="text-danger">, {bad} {bad === 1 ? 'line' : 'lines'} to fix</span>}
          </h2>
          <ol className="card divide-y divide-line">
            {lines.map((l) => (
              <li key={l.line} className="flex gap-3 px-3 py-2.5">
                <span className="w-7 shrink-0 pt-0.5 text-right text-sm text-muted">{l.line}</span>
                {l.kind === 'basic' && (
                  <div className="grid min-w-0 flex-1 gap-x-4 sm:grid-cols-2">
                    <RichText text={l.front} className="font-semibold" />
                    <RichText text={l.back} className="text-muted" />
                  </div>
                )}
                {l.kind === 'cloze' && (
                  <div className="min-w-0 flex-1">
                    <RichText text={l.front} cloze={{ active: 0, revealed: true }} />
                    <span className="text-sm text-accent">
                      Blanks, {l.blanks} {l.blanks === 1 ? 'card' : 'cards'}
                    </span>
                  </div>
                )}
                {l.kind === 'error' && (
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-danger">{l.text}</p>
                    <p className="text-sm font-semibold text-danger">{l.error}, so this line will be left out</p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Pinned to the bottom (above the tab bar on a phone), so it's always in reach. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center gap-3 border-t border-line bg-page/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:-mx-8 lg:px-8">
        <button type="submit" className={`${btn.primary} flex-1 sm:flex-none`} disabled={!good.length || !shared.setId || saving}>
          {cards ? `Add ${cards} ${cards === 1 ? 'card' : 'cards'}` : 'Add cards'}
          {bad > 0 && good.length > 0 ? ` (skipping ${bad})` : ''}
        </button>
        <Added count={added[0]} text={`Added ${added[1]} ✓`} />
      </div>
    </form>
  )
}
