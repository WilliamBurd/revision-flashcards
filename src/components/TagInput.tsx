import { useState } from 'react'
import { CloseIcon } from './Icons'

interface Props {
  id: string
  tags: string[]
  onChange: (tags: string[]) => void
  /** Tags already used elsewhere, offered as you type. */
  suggestions: string[]
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Tags as chips. Type one and press Enter or comma; tap × to remove. */
export default function TagInput({ id, tags, onChange, suggestions }: Props) {
  const [draft, setDraft] = useState('')
  const add = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, ' ')
    if (tag && !tags.some((t) => same(t, tag))) onChange([...tags, tag])
    setDraft('')
  }
  const typed = draft.trim().toLowerCase()
  const offer = suggestions
    .filter((s) => !tags.some((t) => same(t, s)) && (!typed || s.toLowerCase().includes(typed)))
    .slice(0, 6)

  return (
    <div>
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-btn border border-line bg-surface px-2 py-1.5 focus-within:border-accent">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pr-1 pl-3 text-sm font-semibold text-on-accent-soft">
            {tag}
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface/60"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(tags.filter((t) => t !== tag))}
            >
              <CloseIcon width={14} height={14} />
            </button>
          </span>
        ))}
        <input
          id={id}
          className="min-w-32 flex-1 bg-transparent px-1 py-1.5 text-base text-ink outline-none placeholder:text-muted/70"
          value={draft}
          placeholder={tags.length ? 'Add another' : 'e.g. key date'}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value
            // A comma finishes a tag (handy on phone keyboards).
            if (v.includes(',')) v.split(',').slice(0, -1).forEach(add)
            setDraft(v.includes(',') ? v.slice(v.lastIndexOf(',') + 1) : v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault()
              add(draft)
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1))
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
        />
      </div>
      {offer.length > 0 && (typed || tags.length === 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggested tags">
          {offer.map((s) => (
            <button
              key={s}
              type="button"
              className="min-h-9 rounded-full border border-line px-3 text-sm text-muted hover:bg-raised hover:text-ink"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
