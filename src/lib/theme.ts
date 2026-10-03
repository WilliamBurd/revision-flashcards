// The app's looks. The choice is remembered on this device; "auto"
// follows the device's light or dark setting.

export type ThemeChoice = 'auto' | 'white' | 'light-grey' | 'medium-grey' | 'dark-grey' | 'black' | 'navy' | 'midnight'
export type ThemeName = Exclude<ThemeChoice, 'auto'>

export const THEMES: { id: ThemeChoice; name: string; description: string }[] = [
  { id: 'auto', name: 'Match device', description: 'White by day, Midnight when your phone is in dark mode' },
  { id: 'white', name: 'White', description: 'Clean white with blue' },
  { id: 'light-grey', name: 'Light grey', description: 'Soft pale grey with teal' },
  { id: 'medium-grey', name: 'Medium grey', description: 'Mid grey with gold, not too dark or bright' },
  { id: 'dark-grey', name: 'Dark grey', description: 'Charcoal with soft blue' },
  { id: 'black', name: 'Black', description: 'True black and white, kind to OLED screens' },
  { id: 'navy', name: 'Navy', description: 'Deep navy with sky blue' },
  { id: 'midnight', name: 'Midnight', description: 'Dark navy and amber, easy on the eyes at night' },
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
  return darkQuery().matches ? 'midnight' : 'white'
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
