// Accent colour and text size, chosen on each device like the theme
// (lib/theme.ts). The accent replaces the theme's own accent in every theme;
// text size scales the whole app, like zooming.

export const ACCENTS: { name: string; color: string }[] = [
  { name: 'Blue', color: '#2f5bea' },
  { name: 'Sky', color: '#4fc3f7' },
  { name: 'Teal', color: '#14a399' },
  { name: 'Green', color: '#2fb36a' },
  { name: 'Gold', color: '#f5b544' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Red', color: '#e5484d' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Purple', color: '#8b5cf6' },
]

export const TEXT_SIZES = [
  { id: 'small', name: 'Small', scale: '87.5%' },
  { id: 'normal', name: 'Normal', scale: '100%' },
  { id: 'large', name: 'Large', scale: '112.5%' },
  { id: 'xl', name: 'Extra large', scale: '125%' },
] as const
export type TextSize = (typeof TEXT_SIZES)[number]['id']

const ACCENT_KEY = 'accent'
const SIZE_KEY = 'text-size'
const HEX = /^#[0-9a-f]{6}$/i

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Still applies for this visit.
  }
}

/** The chosen accent as #rrggbb, or null to use the theme's own. */
export function getAccent(): string | null {
  const saved = read(ACCENT_KEY)
  return saved && HEX.test(saved) ? saved.toLowerCase() : null
}

/** Black or white, whichever reads better on the colour. */
export function textOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // Contrast against black beats contrast against white above about 0.18.
  return luminance > 0.18 ? '#0b0b0f' : '#ffffff'
}

/** The CSS variables that make up an accent, mixed with the theme's own page and text colours. */
export function accentVars(hex: string): Record<string, string> {
  return {
    '--accent': hex,
    '--accent-strong': `color-mix(in srgb, ${hex} 82%, var(--ink))`,
    '--on-accent': textOn(hex),
    '--accent-soft': `color-mix(in srgb, ${hex} 18%, var(--page))`,
    '--on-accent-soft': `color-mix(in srgb, ${hex} 70%, var(--ink))`,
  }
}

export function applyAccent(hex: string | null = getAccent()): void {
  const style = document.documentElement.style
  const vars = accentVars(hex ?? '#000000')
  for (const name of Object.keys(vars)) {
    if (hex) style.setProperty(name, vars[name])
    else style.removeProperty(name)
  }
}

export function setAccent(hex: string | null): void {
  write(ACCENT_KEY, hex && HEX.test(hex) ? hex.toLowerCase() : null)
  applyAccent(getAccent())
}

export function getTextSize(): TextSize {
  const saved = read(SIZE_KEY)
  return TEXT_SIZES.some((s) => s.id === saved) ? (saved as TextSize) : 'normal'
}

export function applyTextSize(size: TextSize = getTextSize()): void {
  const scale = TEXT_SIZES.find((s) => s.id === size)!.scale
  if (size === 'normal') document.documentElement.style.removeProperty('font-size')
  else document.documentElement.style.fontSize = scale
}

export function setTextSize(size: TextSize): void {
  write(SIZE_KEY, size === 'normal' ? null : size)
  applyTextSize(size)
}
