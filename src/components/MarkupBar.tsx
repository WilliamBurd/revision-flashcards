// B / I / • buttons for a plain text box (the Blanks sentence and Paste many).
// They add the same marks the card editor stores: **bold**, _italics_ and
// lines starting "- " for bullets (see notes/format.ts).

import { type KeyboardEvent, type ReactNode, type RefObject } from 'react'

interface Edit {
  text: string
  start: number
  end: number
}

/** Wrap the selection in a mark, or take the mark off if it's already there. */
export function toggleMark(text: string, start: number, end: number, mark: string): Edit {
  // Leave spaces at the edges outside the mark: "** word**" wouldn't be bold.
  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  const n = mark.length
  if (text.slice(start - n, start) === mark && text.slice(end, end + n) === mark) {
    return { text: text.slice(0, start - n) + text.slice(start, end) + text.slice(end + n), start: start - n, end: end - n }
  }
  const inner = text.slice(start, end)
  if (inner.length > 2 * n && inner.startsWith(mark) && inner.endsWith(mark)) {
    return { text: text.slice(0, start) + inner.slice(n, -n) + text.slice(end), start, end: end - 2 * n }
  }
  return { text: text.slice(0, start) + mark + inner + mark + text.slice(end), start: start + n, end: end + n }
}

/** Make the selected lines bullets, or plain lines again if they all are. */
export function toggleBullets(text: string, start: number, end: number): Edit {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const nextBreak = text.indexOf('\n', end > start ? end - 1 : end)
  const lineEnd = nextBreak === -1 ? text.length : nextBreak
  const lines = text.slice(lineStart, lineEnd).split('\n')
  const allBullets = lines.every((l) => /^\s*-\s/.test(l) || l.trim() === '')
  const changed = lines.map((l) => (l.trim() === '' ? l : allBullets ? l.replace(/^(\s*)-\s/, '$1') : `- ${l}`)).join('\n')
  const out = text.slice(0, lineStart) + changed + text.slice(lineEnd)
  return { text: out, start: lineStart, end: lineStart + changed.length }
}

interface Props {
  target: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (text: string) => void
  /** Paste many already treats "- " at the start of a line as a bullet to skip, so it has no • button. */
  bullets?: boolean
}

export default function MarkupBar({ target, value, onChange, bullets = true }: Props) {
  const apply = (edit: (t: string, s: number, e: number) => Edit) => {
    const box = target.current
    if (!box) return
    const result = edit(value, box.selectionStart, box.selectionEnd)
    onChange(result.text)
    // After React has put the new text in the box.
    requestAnimationFrame(() => {
      box.focus()
      box.setSelectionRange(result.start, result.end)
    })
  }
  return (
    <div role="toolbar" aria-label="Formatting" className="mb-1 flex items-center gap-1">
      <BarButton label="Bold" shortcut="Ctrl+B" run={() => apply((t, s, e) => toggleMark(t, s, e, '**'))}>
        <span className="font-extrabold">B</span>
      </BarButton>
      <BarButton label="Italics" shortcut="Ctrl+I" run={() => apply((t, s, e) => toggleMark(t, s, e, '_'))}>
        <span className="font-serif text-lg italic">I</span>
      </BarButton>
      {bullets && (
        <BarButton label="Bullet list" run={() => apply(toggleBullets)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="5" cy="7" r="1.2" fill="currentColor" />
            <circle cx="5" cy="12" r="1.2" fill="currentColor" />
            <circle cx="5" cy="17" r="1.2" fill="currentColor" />
            <path d="M9.5 7H20M9.5 12H20M9.5 17H20" />
          </svg>
        </BarButton>
      )}
    </div>
  )
}

/** Ctrl+B and Ctrl+I inside the text box. */
export function markupShortcuts(value: string, onChange: (text: string) => void) {
  return (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    const key = e.key.toLowerCase()
    if (key !== 'b' && key !== 'i') return
    e.preventDefault()
    const box = e.currentTarget
    const result = toggleMark(value, box.selectionStart, box.selectionEnd, key === 'b' ? '**' : '_')
    onChange(result.text)
    requestAnimationFrame(() => box.setSelectionRange(result.start, result.end))
  }
}

function BarButton(props: { label: string; shortcut?: string; run: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.shortcut ? `${props.label} (${props.shortcut})` : props.label}
      tabIndex={-1}
      // Keep the selection in the text box: a normal tap would take focus away.
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
      onClick={props.run}
      className="inline-flex h-11 min-w-11 items-center justify-center rounded-btn border border-line bg-surface px-2 text-base text-muted hover:bg-raised hover:text-ink"
    >
      {props.children}
    </button>
  )
}
