import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { ProgressBar, ProgressKey } from '../components/Counts'
import { toPlain } from '../notes/format'
import { cardSides } from '../notes/cards'
import { useLibrary, useOverview } from '../db/hooks'
import { subjectOutline } from '../db/outline'
import { getStats, type ForecastDay } from '../db/stats'

export default function Stats() {
  const stats = useLiveQuery(() => getStats())
  const library = useLibrary()
  const overview = useOverview()
  if (!stats || !library || !overview) return null
  const { subjects, topics, sets } = library

  return (
    <div className="flex flex-col gap-6 py-6 lg:py-10">
      <h1 className="text-3xl tracking-tight">Stats</h1>

      <dl className="grid grid-cols-3 gap-2">
        <Tile label="day streak" value={String(stats.streak)} hint={stats.streak > 0 && !stats.studiedToday ? 'Review today to keep it' : undefined} />
        <Tile label="reviews today" value={String(stats.reviewsToday)} />
        <Tile label="remembered, last 30 days" value={stats.recall30 === null ? '–' : `${Math.round(stats.recall30 * 100)}%`} />
      </dl>

      <section aria-labelledby="forecast-title">
        <h2 id="forecast-title" className="mb-2 text-lg font-semibold">
          Due in the next 7 days
        </h2>
        <Forecast days={stats.forecast} />
      </section>

      <section aria-labelledby="sets-title">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="sets-title" className="text-lg font-semibold">
            Your sets
          </h2>
          <ProgressKey />
        </div>
        {sets.length === 0 ? (
          <p className="text-muted">No sets yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {subjects.map((subject) => {
              // In topic order, so a topic's sets sit together.
              const subjectSets = subjectOutline(subject, topics, sets).flatMap((g) => g.sets.map((set) => ({ set, topic: g.topic })))
              if (!subjectSets.length) return null
              return (
                <div key={subject.id} className="card overflow-hidden">
                  <h3 className="font-display border-b border-line px-4 py-2 text-base">{subject.name}</h3>
                  <ul className="divide-y divide-line">
                    {subjectSets.map(({ set, topic }) => {
                      const c = overview.bySet.get(set.id)
                      return (
                        <li key={set.id}>
                          <Link to={`/sets/${set.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-raised">
                            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <span className="font-semibold">{topic ? `${topic.name} · ${set.name}` : set.name}</span>
                              <span className="text-sm text-muted">
                                {c?.known ?? 0} known · {c?.learning ?? 0} learning · {c?.new ?? 0} new
                              </span>
                            </span>
                            <ProgressBar counts={c} />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="leech-title">
        <h2 id="leech-title" className="mb-1 text-lg font-semibold">
          Leeches
        </h2>
        <p className="mb-2 text-sm text-muted">
          Cards you've had no idea about 6 or more times. Try rewording them, splitting them up or adding a hint.
        </p>
        {stats.leeches.length === 0 ? (
          <p className="card px-4 py-3 text-muted">None, nice.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {stats.leeches.map(({ card, note }) => (
              <li key={card.id}>
                <Link to={`/notes/${note.id}/edit`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-raised">
                  <span className="min-w-0 flex-1 truncate">{toPlain(cardSides(note, card).question)}</span>
                  <span className="shrink-0 text-sm font-semibold text-accent">Edit</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card flex flex-col-reverse items-center justify-end px-2 py-3 text-center">
      {hint && <span className="mt-1 text-xs text-accent">{hint}</span>}
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-3xl font-bold">{value}</dd>
    </div>
  )
}

function Forecast({ days }: { days: ForecastDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((n, d) => n + d.count, 0)
  return (
    <div className="card px-3 pt-4 pb-3">
      <ol className="grid h-40 grid-cols-7 items-end gap-2" aria-label={`${total} cards due over the next 7 days`}>
        {days.map((d, i) => (
          <li key={d.start} className="flex h-full flex-col items-center justify-end gap-1">
            <span className="text-sm font-semibold">{d.count}</span>
            <span className="flex min-h-0 w-full flex-1 items-end justify-center">
              <span
                className={`w-full max-w-10 rounded-t-md ${i === 0 ? 'bg-accent' : 'bg-accent/55'}`}
                style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 2 }}
              />
            </span>
            <span className="text-xs text-muted">{i === 0 ? 'Today' : new Date(d.start).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
