import type { SetCounts } from '../db/study'

/** "12 new · 64 cards" */
export function CountsLine({ counts }: { counts: SetCounts | undefined }) {
  if (!counts) return null
  return (
    <span className="text-sm text-muted">
      {counts.due} due · {counts.new} new · {counts.total} {counts.total === 1 ? 'card' : 'cards'}
    </span>
  )
}

/** A bar split into known / learning / new cards. */
export function ProgressBar({ counts }: { counts: SetCounts | undefined }) {
  if (!counts || counts.total === 0) return <div className="h-1.5 rounded-full bg-line" />
  const pct = (n: number) => `${(n / counts.total) * 100}%`
  return (
    <div
      className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-line"
      role="img"
      aria-label={`${counts.known} known, ${counts.learning} learning, ${counts.new} new`}
    >
      {counts.known > 0 && <div className="bg-bar-known" style={{ width: pct(counts.known) }} />}
      {counts.learning > 0 && <div className="bg-bar-learning" style={{ width: pct(counts.learning) }} />}
      {counts.new > 0 && <div className="bg-bar-new" style={{ width: pct(counts.new) }} />}
    </div>
  )
}

export function ProgressKey() {
  const dot = 'inline-block h-2 w-2 rounded-full'
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className={`${dot} bg-bar-known`} /> Known
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${dot} bg-bar-learning`} /> Learning
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${dot} bg-bar-new`} /> New
      </span>
    </span>
  )
}
