import { ACCENTS } from '../lib/look'

interface Props {
  /** #rrggbb, or null for the automatic colour. */
  value: string | null
  onChange: (hex: string | null) => void
  /** Explains what "Auto" means here. */
  autoTitle: string
}

/** Auto, the preset colours, and a rainbow button that opens a picker for any colour. */
export default function ColourSwatches({ value, onChange, autoTitle }: Props) {
  const custom = value !== null && !ACCENTS.some((a) => a.color === value)
  const ring = (selected: boolean) =>
    `relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 ${
      selected ? 'border-ink outline-2 outline-offset-2 outline-ink' : 'border-line'
    }`

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={value === null}
        aria-label={autoTitle}
        title={autoTitle}
        className={`${ring(value === null)} bg-surface text-xs font-semibold text-muted`}
        onClick={() => onChange(null)}
      >
        Auto
      </button>
      {ACCENTS.map((a) => (
        <button
          key={a.color}
          type="button"
          aria-pressed={value === a.color}
          aria-label={a.name}
          title={a.name}
          className={ring(value === a.color)}
          style={{ background: a.color }}
          onClick={() => onChange(a.color)}
        />
      ))}
      <label
        className={ring(custom)}
        title="Any colour"
        style={{
          background: custom
            ? value
            : 'conic-gradient(#e5484d, #f5b544, #2fb36a, #4fc3f7, #2f5bea, #8b5cf6, #ec4899, #e5484d)',
        }}
      >
        <span className="sr-only">Any colour</span>
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={value ?? '#2f5bea'}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  )
}
