import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BackIcon } from '../components/Icons'
import { btn } from '../components/ui'
import { useLibrary, useOverview } from '../db/hooks'
import { subjectOutline } from '../db/outline'
import { readyCount } from '../db/study'

// Which sets were left unticked for each topic, remembered on this device so
// the same choice comes up next time. Sets added later start ticked.
const skippedKey = (topic: string) => `review-skipped:${topic}`

function readSkipped(topic: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(skippedKey(topic)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function writeSkipped(topic: string, ids: string[]): void {
  try {
    localStorage.setItem(skippedKey(topic), JSON.stringify(ids))
  } catch {
    // Still works for this review.
  }
}

/** Before a topic's review: tick which of its sets to include. */
export default function ChooseSets() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const topicKey = params.get('topic') ?? ''
  const library = useLibrary()
  const overview = useOverview()
  const [skipped, setSkipped] = useState(() => readSkipped(topicKey))

  if (!library || !overview) return null
  const subjectId = topicKey.startsWith('subject:') ? topicKey.slice('subject:'.length) : library.topics.find((t) => t.id === topicKey)?.subject_id
  const subject = library.subjects.find((s) => s.id === subjectId)
  const group = subject && subjectOutline(subject, library.topics, library.sets).find((g) => g.key === topicKey)
  if (!subject || !group) return <p className="py-6 text-muted">This topic has been deleted.</p>

  const title = group.topic?.name ?? subject.name
  const chosen = group.sets.filter((s) => !skipped.has(s.id)).map((s) => s.id)
  const ready = readyCount(overview, chosen)
  const total = ready.due + ready.newToday

  const toggle = (id: string) => {
    const next = new Set(skipped)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSkipped(next)
    writeSkipped(topicKey, [...next])
  }
  const setAll = (on: boolean) => {
    const next = new Set(on ? [] : group.sets.map((s) => s.id))
    setSkipped(next)
    writeSkipped(topicKey, [...next])
  }

  return (
    <div className="flex flex-col gap-4 py-6 lg:py-10">
      <div>
        <Link to="/" className={`${btn.ghost} -ml-4 mb-2`}>
          <BackIcon width={20} height={20} /> Home
        </Link>
        {group.topic && <p className="text-sm text-muted">{subject.name}</p>}
        <h1 className="text-3xl tracking-tight">Review {title}</h1>
        <p className="mt-1 text-muted">Tick the sets to include.</p>
      </div>

      <div className="flex gap-2">
        <button type="button" className={btn.ghost} onClick={() => setAll(true)}>
          Tick all
        </button>
        <button type="button" className={btn.ghost} onClick={() => setAll(false)}>
          Untick all
        </button>
      </div>

      <ul className="card divide-y divide-line overflow-hidden">
        {group.sets.map((set) => {
          const r = readyCount(overview, [set.id])
          return (
            <li key={set.id}>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3 hover:bg-raised">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  checked={!skipped.has(set.id)}
                  onChange={() => toggle(set.id)}
                />
                <span className="min-w-0 flex-1 truncate font-semibold">{set.name}</span>
                <span className="shrink-0 text-sm text-muted">
                  {r.due} due · {r.newToday} new
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        className={`${btn.primary} min-h-14 text-lg`}
        disabled={total === 0}
        onClick={() => navigate(`/review?sets=${chosen.join(',')}`)}
      >
        {total ? `Start review (${total})` : chosen.length ? 'Nothing due in these sets' : 'Tick a set to start'}
      </button>
    </div>
  )
}
