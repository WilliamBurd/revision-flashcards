import { useState } from 'react'
import Modal from './Modal'
import { btn, input } from './ui'

interface Props {
  open: boolean
  title: string
  label: string
  initial?: string
  placeholder?: string
  submitLabel: string
  onSubmit: (name: string) => void
  onClose: () => void
}

/** Asks for a name, for creating or renaming a subject or set. */
export default function NameDialog(props: Props) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.title}>
      {/* Remount on each open so the field starts from `initial`. */}
      {props.open && <NameForm {...props} />}
    </Modal>
  )
}

function NameForm({ label, initial = '', placeholder, submitLabel, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onSubmit(name.trim())
        onClose()
      }}
    >
      <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="name-field">
        {label}
      </label>
      <input
        id="name-field"
        className={input}
        value={name}
        placeholder={placeholder}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        autoComplete="off"
      />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={btn.secondary} onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className={btn.primary} disabled={!name.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
