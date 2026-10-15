import { Link } from 'react-router-dom'
import { BackIcon, ChevronIcon } from '../components/Icons'
import { btn } from '../components/ui'
import { useLibrary } from '../db/hooks'
import { subjectOutline } from '../db/outline'
import { reorder } from '../db/subjects'

type Table = 'subjects' | 'topics' | 'sets'

/** Move an item one place up or down among its siblings and save the new order. */
function move(table: Table, ids: string[], index: number, by: -1 | 1) {
  const to = index + by
  if (to < 0 || to >= ids.length) return
  const next = [...ids]
  ;[next[index], next[to]] = [next[to], next[index]]
  void reorder(table, next)
}

/** Up and down buttons for one item in a list. */
function Arrows({ table, ids, index, name }: { table: Table; ids: string[]; index: number; name: string }) {
  const arrow = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-muted hover:bg-raised hover:text-ink disabled:opacity-25'
  return (
    <span className="flex shrink-0">
      <button type="button" className={arrow} aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => move(table, ids, index, -1)}>
        <ChevronIcon className="-rotate-90" />
      </button>
      <button
        type="button"
        className={arrow}
        aria-label={`Move ${name} down`}
        disabled={index === ids.length - 1}
        onClick={() => move(table, ids, index, 1)}
      >
        <ChevronIcon className="rotate-90" />
      </button>
    </span>
  )
}

export default function Reorder() {
  const library = useLibrary()
  if (!library) return null
  const { subjects, topics, sets } = library
  const subjectIds = subjects.map((s) => s.id)

  return (
    <div className="flex flex-col gap-4 py-6 lg:py-10">
      <div>
        <Link to="/" className={`${btn.ghost} -ml-4 mb-2`}>
          <BackIcon width={20} height={20} /> Home
        </Link>
        <h1 className="text-3xl tracking-tight">Change order</h1>
        <p className="mt-1 text-muted">Use the arrows to move subjects, topics and sets. Home shows them in this order.</p>
      </div>

      {subjects.length === 0 && <p className="text-muted">No subjects yet.</p>}

      {subjects.map((subject, i) => {
        const groups = subjectOutline(subject, topics, sets)
        const topicIds = groups.flatMap((g) => (g.topic ? [g.topic.id] : []))
        return (
          <section key={subject.id} className="card overflow-hidden">
            <div className="flex items-center gap-2 bg-raised py-1 pr-1 pl-4">
              <h2 className="font-display min-w-0 flex-1 truncate text-lg">{subject.name}</h2>
              <Arrows table="subjects" ids={subjectIds} index={i} name={subject.name} />
            </div>
            {groups.map((group) => {
              const setIds = group.sets.map((s) => s.id)
              if (!group.topic && !setIds.length) return null
              return (
                <div key={group.key} className="border-t border-line">
                  {group.topic ? (
                    <div className="flex items-center gap-2 py-1 pr-1 pl-4">
                      <h3 className="min-w-0 flex-1 truncate font-bold">{group.topic.name}</h3>
                      <Arrows table="topics" ids={topicIds} index={topicIds.indexOf(group.topic.id)} name={group.topic.name} />
                    </div>
                  ) : (
                    topicIds.length > 0 && <div className="px-4 py-2 text-sm font-semibold text-muted">Other sets</div>
                  )}
                  <ul>
                    {group.sets.map((set, j) => (
                      <li key={set.id} className="flex items-center gap-2 py-0.5 pr-1 pl-8">
                        <span className="min-w-0 flex-1 truncate">{set.name}</span>
                        <Arrows table="sets" ids={setIds} index={j} name={set.name} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
