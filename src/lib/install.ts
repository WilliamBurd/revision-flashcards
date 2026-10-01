// Installing the app on the home screen. Chrome fires "beforeinstallprompt"
// when the site can be installed; we keep that event so a button in Settings
// can open Chrome's own install box, for when the menu item is hard to find.

import { useSyncExternalStore } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let pending: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

const standalone = () => window.matchMedia('(display-mode: standalone)').matches

export type InstallState = 'installed' | 'ready' | 'unavailable'

/** Start listening as early as possible: the event can fire before React draws. */
export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pending = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    pending = null
    installed = true
    notify()
  })
}

function state(): InstallState {
  if (installed || standalone()) return 'installed'
  return pending ? 'ready' : 'unavailable'
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    state,
  )
}

/** Open Chrome's install box and say what happened. */
export async function installApp(): Promise<'accepted' | 'dismissed' | 'gone'> {
  const event = pending
  if (!event) return 'gone'
  // Chrome only lets each event be used once.
  pending = null
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    return outcome
  } finally {
    notify()
  }
}
