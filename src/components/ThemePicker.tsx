import { useState } from 'react'
import { ACCENTS, getAccent, getTextSize, setAccent, setTextSize, TEXT_SIZES, type TextSize } from '../lib/look'
import { getThemeChoice, setThemeChoice, THEMES, type ThemeChoice } from '../lib/theme'
import Modal from './Modal'

// What each theme looks like, for the little previews in the picker.
const SWATCHES: Record<ThemeChoice, { page: string; surface: string; accent: string; dots: string[] }> = {
  auto: { page: 'linear-gradient(135deg, #ffffff 50%, #0e1424 50%)', surface: '#ffffff', accent: '#2f5bea', dots: [] },
  white: { page: '#ffffff', surface: '#f4f5f7', accent: '#2f5bea', dots: ['#c2410c', '#0e7490'] },
  'light-grey': { page: '#eceef1', surface: '#fbfbfc', accent: '#0f766e', dots: ['#c2410c', '#0e7490'] },
  'medium-grey': { page: '#4d525a', surface: '#5c6169', accent: '#ffd166', dots: ['#ff8a65', '#6c8cff'] },
  'dark-grey': { page: '#1e1f22', surface: '#2a2b2f', accent: '#8ab4ff', dots: ['#ff8a65', '#6c8cff'] },
  black: { page: '#000000', surface: '#111111', accent: '#ffffff', dots: ['#ff8a65', '#6c8cff'] },
  navy: { page: '#0b1f44', surface: '#12295a', accent: '#4fc3f7', dots: ['#ff8a65', '#6c8cff'] },
  midnight: { page: '#0e1424', surface: '#182036', accent: '#f5b544', dots: ['#ff8a65', '#6c8cff'] },
}

export default function ThemePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [choice, setChoice] = useState(getThemeChoice)

  return (
    <Modal open={open} onClose={onClose} title="Look">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Choose a theme</legend>
        {THEMES.map((theme) => {
          const sw = SWATCHES[theme.id]
          const selected = choice === theme.id
          return (
            <label
              key={theme.id}
              className={`flex cursor-pointer items-center gap-3 rounded-btn border-2 p-3 ${
                selected ? 'border-accent bg-accent-soft' : 'border-line hover:bg-raised'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={theme.id}
                checked={selected}
                onChange={() => {
                  setChoice(theme.id)
                  setThemeChoice(theme.id)
                }}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 flex-col justify-end gap-1 rounded-lg border border-black/10 p-1.5"
                style={{ background: sw.page }}
              >
                <span className="h-2 rounded-sm" style={{ background: sw.accent }} />
                <span className="flex h-3 items-center gap-1 rounded-sm px-1" style={{ background: sw.surface }}>
                  {sw.dots.map((d) => (
                    <span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: d }} />
                  ))}
                </span>
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-ink">{theme.name}</span>
                <span className="text-sm text-muted">{theme.description}</span>
              </span>
            </label>
          )
        })}
      </fieldset>
      <AccentPicker />
      <TextSizePicker />
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-12 items-center rounded-btn bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}

function AccentPicker() {
  const [accent, setChoice] = useState(getAccent)
  const custom = accent !== null && !ACCENTS.some((a) => a.color === accent)
  const pick = (hex: string | null) => {
    setChoice(hex)
    setAccent(hex)
  }
  const ring = (selected: boolean) =>
    `relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 ${
      selected ? 'border-ink outline-2 outline-offset-2 outline-ink' : 'border-line'
    }`

  return (
    <fieldset className="mt-5">
      <legend className="mb-2 font-semibold">Accent colour</legend>
      <p className="mb-3 text-sm text-muted">Buttons, links and highlights. Works with any theme.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={accent === null}
          aria-label="Theme's own colour"
          title="Theme's own colour"
          className={`${ring(accent === null)} bg-surface text-xs font-semibold text-muted`}
          onClick={() => pick(null)}
        >
          Auto
        </button>
        {ACCENTS.map((a) => (
          <button
            key={a.color}
            type="button"
            aria-pressed={accent === a.color}
            aria-label={a.name}
            title={a.name}
            className={ring(accent === a.color)}
            style={{ background: a.color }}
            onClick={() => pick(a.color)}
          />
        ))}
        <label
          className={ring(custom)}
          title="Any colour"
          style={{
            background: custom
              ? accent
              : 'conic-gradient(#e5484d, #f5b544, #2fb36a, #4fc3f7, #2f5bea, #8b5cf6, #ec4899, #e5484d)',
          }}
        >
          <span className="sr-only">Any colour</span>
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={accent ?? '#2f5bea'}
            onChange={(e) => pick(e.target.value)}
          />
        </label>
      </div>
    </fieldset>
  )
}

function TextSizePicker() {
  const [size, setSize] = useState<TextSize>(getTextSize)
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 font-semibold">Text size</legend>
      <div className="grid grid-cols-4 gap-2">
        {TEXT_SIZES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={size === s.id}
            className={`flex min-h-12 flex-col items-center justify-center rounded-btn border-2 px-1 ${
              size === s.id ? 'border-accent bg-accent-soft text-on-accent-soft' : 'border-line hover:bg-raised'
            }`}
            onClick={() => {
              setSize(s.id)
              setTextSize(s.id)
            }}
          >
            <span aria-hidden="true" className="font-semibold leading-none" style={{ fontSize: `${0.85 + i * 0.2}rem` }}>
              Aa
            </span>
            <span className="mt-1 text-xs">{s.name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
