import { CardState, type Card, type Note } from '../db/types'
import { formatInterval } from '../scheduler/formatInterval'
import RichText from './RichText'

/** A note's text in a list: the front (or cloze sentence) and the back, a couple of lines each. */
export function NotePreview({ note }: { note: Note }) {
  return (
    <div className="min-w-0 flex-1">
      <RichText
        text={note.front}
        cloze={note.type === 'cloze' ? { active: 0, revealed: true } : undefined}
        className="line-clamp-2 gap-0! font-medium [&_li]:inline [&_ul]:inline [&_ul]:pl-0"
      />
      {note.back && <RichText text={note.back} className="line-clamp-1 gap-0! text-sm text-muted [&_li]:inline [&_ul]:inline [&_ul]:pl-0" />}
    </div>
  )
}

/** "New", "Due" or "In 3d" for the note's soonest card, plus how many cards it makes. */
export function CardsBadge({ cards }: { cards: Card[] }) {
  const style = 'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap'
  if (!cards.length) return null
  const count = cards.length > 1 ? `${cards.length} cards · ` : ''
  const learned = cards.filter((c) => c.state !== CardState.New)
  if (!learned.length) return <span className={`${style} bg-accent-soft text-on-accent-soft`}>{count}New</span>
  const wait = Math.min(...learned.map((c) => c.due)) - Date.now()
  return (
    <span className={`${style} bg-raised text-ink`}>
      {count}
      {wait <= 0 ? 'Due' : `In ${formatInterval(wait)}`}
    </span>
  )
}
