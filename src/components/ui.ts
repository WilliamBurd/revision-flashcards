// Shared styles. Colours come from the theme (see index.css), and every tap
// target is at least 48px tall.
const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-btn px-4 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export const btn = {
  primary: `${base} bg-accent text-on-accent hover:bg-accent-strong`,
  secondary: `${base} border border-line bg-surface text-ink hover:bg-raised`,
  danger: `${base} bg-danger text-white hover:opacity-90`,
  ghost: `${base} text-muted hover:bg-raised hover:text-ink`,
  icon: 'inline-flex h-12 w-12 items-center justify-center rounded-btn text-muted hover:bg-raised hover:text-ink',
}

export const input =
  'w-full rounded-btn border border-line bg-surface px-3 py-3 text-lg text-ink placeholder:text-muted/70'

export const panel = 'card'

export const label = 'mb-1 block text-sm font-semibold text-muted'
