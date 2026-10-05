import { useLibrary } from '../db/hooks'
import { subjectOutline } from '../db/outline'
import type { CardSet, Subject } from '../db/types'
import { input } from './ui'

interface Props {
  id: string
  value: string
  onChange: (setId: string) => void
  subjects: Subject[]
  sets: CardSet[]
}

/** A dropdown of sets, grouped by subject, with each set's topic before its name. */
export default function SetSelect({ id, value, onChange, subjects, sets }: Props) {
  const topics = useLibrary()?.topics ?? []
  return (
    <select id={id} className={input} value={value} onChange={(e) => onChange(e.target.value)}>
      {subjects.map((subject) => {
        const groups = subjectOutline(subject, topics, sets).filter((g) => g.sets.length)
        if (!groups.length) return null
        return (
          <optgroup key={subject.id} label={subject.name}>
            {groups.flatMap((g) =>
              g.sets.map((set) => (
                <option key={set.id} value={set.id}>
                  {g.topic ? `${g.topic.name} · ${set.name}` : set.name}
                </option>
              )),
            )}
          </optgroup>
        )
      })}
    </select>
  )
}
