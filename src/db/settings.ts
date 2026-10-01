import { DEFAULT_SCHEDULER_SETTINGS } from '../scheduler/fsrs'
import { db } from './db'
import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  updated_at: 0,
  ...DEFAULT_SCHEDULER_SETTINGS,
  new_cards_per_day_total: 20,
  extra_new_cards: { day: '', count: 0 },
  theme: 'auto',
}

export const DEFAULT_NEW_CARDS_PER_SET = 20

export async function getSettings(): Promise<Settings> {
  const saved = await db.settings.get('settings')
  return { ...DEFAULT_SETTINGS, ...saved }
}

export async function updateSettings(changes: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...changes, updated_at: Date.now() })
}

// The last set used in quick add is remembered on this device only.
const LAST_SET_KEY = 'last-set-id'

export function getLastSetId(): string | null {
  try {
    return localStorage.getItem(LAST_SET_KEY)
  } catch {
    return null
  }
}

export function setLastSetId(id: string): void {
  try {
    localStorage.setItem(LAST_SET_KEY, id)
  } catch {
    // Private browsing can block storage; quick add still works without it.
  }
}
