import { Fragment, type ReactNode } from 'react'
import { parseBlocks, type Inline } from '../notes/format'

interface Props {
  text: string
  className?: string
  /** For a cloze card: the blank it hides (0 for all), and whether the answer is showing. */
  cloze?: { active: number; revealed: boolean }
}

/**
 * Shows card text with its bold, italics and bullets. Built from React
 * elements, never raw HTML, so nothing in a card can run as code.
 */
export default function RichText({ text, className = '', cloze }: Props) {
  const blocks = parseBlocks(text, !!cloze)
  return (
    <div className={`flex flex-col gap-2 break-words ${className}`}>
      {blocks.map((b, i) =>
        b.type === 'paragraph' ? (
          <p key={i}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line, cloze)}
              </Fragment>
            ))}
          </p>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-6">
            {b.items.map((item, j) => (
              <li key={j}>{renderInline(item, cloze)}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}

function renderInline(nodes: Inline[], cloze: Props['cloze']): ReactNode {
  return nodes.map((n, i) => {
    if (n.type === 'text') return <Fragment key={i}>{n.text}</Fragment>
    if (n.type === 'bold') return <strong key={i}>{renderInline(n.children, cloze)}</strong>
    if (n.type === 'italic') return <em key={i}>{renderInline(n.children, cloze)}</em>
    if (n.type !== 'cloze') return null
    if (!cloze || (cloze.active !== 0 && n.index !== cloze.active)) return <Fragment key={i}>{n.answer}</Fragment>
    return cloze.revealed ? (
      <mark key={i} className="rounded bg-accent-soft px-1 font-semibold text-on-accent-soft">
        {n.answer}
      </mark>
    ) : (
      <span key={i} className="rounded border-2 border-dashed border-accent px-1.5 font-semibold text-accent">
        [{n.hint || '...'}]
      </span>
    )
  })
}
