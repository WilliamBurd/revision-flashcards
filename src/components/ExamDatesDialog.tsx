import { useState } from 'react'
import { setExamDates } from '../db/subjects'
import type { ExamDate, Subject } from '../db/types'
import { CloseIcon } from './Icons'
import Modal from './Modal'
import { btn, input } from './ui'

interface Props {
  subject: Subject | null
  onClose: () => void
}

/** Add, change or remove a subject's exam dates. */
export default function ExamDatesDialog({ subject, onClose }: Props) {
  return (
    <Modal open={subject !== null} onClose={onClose} title={subject ? `${subject.name} exams` : ''}>
      {subject && <ExamForm key={subject.id} subject={subject} onClose={onClose} />}
    </Modal>
  )
}

function ExamForm({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const [exams, setExams] = useState<ExamDate[]>(() =>
    subject.exam_dates.length ? subject.exam_dates : [{ name: '', date: '' }],
  )
  const change = (i: number, next: Partial<ExamDate>) => setExams((list) => list.map((e, j) => (j === i ? { ...e, ...next } : e)))

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        await setExamDates(subject.id, exams)
        onClose()
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-muted">
        Before an exam, no card is scheduled after it, every card comes up at least once in the final week, and in the
        last two weeks cards are reviewed more often. Once an exam has passed, the next one takes over.
      </p>
      <ul className="flex flex-col gap-3">
        {exams.map((exam, i) => (
          <li key={i} className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-muted">Name</span>
              <input
                className={`${input} py-2 text-base`}
                value={exam.name}
                placeholder={`e.g. Paper ${i + 1}`}
                onChange={(e) => change(i, { name: e.target.value })}
              />
            </label>
            <label className="flex w-40 shrink-0 flex-col gap-1">
              <span className="text-xs font-semibold text-muted">Date</span>
              <input
                type="date"
                className={`${input} py-2 text-base`}
                value={exam.date}
                onChange={(e) => change(i, { date: e.target.value })}
              />
            </label>
            <button
              type="button"
              className={`${btn.icon} shrink-0`}
              aria-label={`Remove ${exam.name || 'this exam'}`}
              onClick={() => setExams((list) => list.filter((_, j) => j !== i))}
            >
              <CloseIcon width={20} height={20} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="self-start text-sm font-semibold text-accent" onClick={() => setExams((l) => [...l, { name: '', date: '' }])}>
        + Add another exam
      </button>
      <div className="flex justify-end gap-2">
        <button type="button" className={btn.secondary} onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className={btn.primary}>
          Save
        </button>
      </div>
    </form>
  )
}
