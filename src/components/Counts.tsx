import type { SetCounts } from '../db/study'

/** "5 due · 12 new · 40 cards" */
export default function Counts({ counts }: { counts: SetCounts | undefined }) {
  if (!counts) return null
  return (
    <span className="text-sm text-slate-500 dark:text-slate-400">
      <span className={counts.due ? 'font-semibold text-indigo-600 dark:text-indigo-400' : ''}>{counts.due} due</span>
      {' · '}
      <span className={counts.new ? 'text-emerald-700 dark:text-emerald-400' : ''}>{counts.new} new</span>
      {' · '}
      {counts.total} {counts.total === 1 ? 'card' : 'cards'}
    </span>
  )
}
