import type { CardSet, Subject } from '../db/types'
import { input } from './ui'

interface Props {
  id: string
  value: string
  onChange: (setId: string) => void
  subjects: Subject[]
  sets: CardSet[]
}

/** A dropdown of sets, grouped by subject. */
export default function SetSelect({ id, value, onChange, subjects, sets }: Props) {
  return (
    <select id={id} className={input} value={value} onChange={(e) => onChange(e.target.value)}>
      {subjects.map((subject) => {
        const inSubject = sets.filter((s) => s.subject_id === subject.id)
        if (!inSubject.length) return null
        return (
          <optgroup key={subject.id} label={subject.name}>
            {inSubject.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}
