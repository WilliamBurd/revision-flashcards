import { useState } from 'react'
import { getThemeChoice, setThemeChoice, THEMES, type ThemeChoice } from '../lib/theme'
import Modal from './Modal'

// What each theme looks like, for the little previews in the picker.
const SWATCHES: Record<ThemeChoice, { page: string; surface: string; accent: string; dots: string[] }> = {
  auto: { page: 'linear-gradient(135deg, #eef0fb 50%, #0e1424 50%)', surface: '#ffffff', accent: '#5b4be0', dots: [] },
  colourful: { page: '#eef0fb', surface: '#ffffff', accent: '#5b4be0', dots: ['#c2410c', '#0e7490'] },
  midnight: { page: '#0e1424', surface: '#182036', accent: '#f5b544', dots: ['#ff8a65', '#6c8cff'] },
  notebook: { page: '#f4efe6', surface: '#fffcf6', accent: '#1f3a8a', dots: ['#9b2c2c', '#1f6f78'] },
}

export default function ThemePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [choice, setChoice] = useState(getThemeChoice)

  return (
    <Modal open={open} onClose={onClose} title="Theme">
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
