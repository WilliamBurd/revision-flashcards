// The app's looks. The choice is remembered on this device; "auto"
// follows the device's light or dark setting.

export type ThemeChoice = 'auto' | 'colourful' | 'midnight' | 'notebook' | 'ocean' | 'arcade' | 'clean'
export type ThemeName = Exclude<ThemeChoice, 'auto'>

export const THEMES: { id: ThemeChoice; name: string; description: string }[] = [
  { id: 'auto', name: 'Match device', description: 'Colourful by day, Midnight when your phone is in dark mode' },
  { id: 'colourful', name: 'Colourful', description: 'Bright, with a colour for each subject' },
  { id: 'midnight', name: 'Midnight', description: 'Dark navy and amber, easy on the eyes at night' },
  { id: 'notebook', name: 'Notebook', description: 'Warm paper and ink, like study notes' },
  { id: 'ocean', name: 'Ocean', description: 'Calm teal and white, with soft round corners' },
  { id: 'arcade', name: 'Arcade', description: 'Black with neon lime, pink and blue' },
  { id: 'clean', name: 'Clean', description: 'Plain black and white, sharp and simple' },
]

const KEY = 'theme'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getThemeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY)
    if (THEMES.some((t) => t.id === saved)) return saved as ThemeChoice
  } catch {
    // Storage blocked: fall back to auto.
  }
  return 'auto'
}

export function resolveTheme(choice: ThemeChoice): ThemeName {
  if (choice !== 'auto') return choice
  return darkQuery().matches ? 'midnight' : 'colourful'
}

/** Apply the theme to the page, including the phone's status bar colour. */
export function applyTheme(choice: ThemeChoice = getThemeChoice()): void {
  const name = resolveTheme(choice)
  document.documentElement.dataset.theme = name
  const page = getComputedStyle(document.documentElement).getPropertyValue('--page').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', page)
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Still applies for this visit.
  }
  applyTheme(choice)
}

/** Keep "auto" in step when the device switches between light and dark. */
export function watchDeviceTheme(): void {
  darkQuery().addEventListener('change', () => {
    if (getThemeChoice() === 'auto') applyTheme('auto')
  })
}
