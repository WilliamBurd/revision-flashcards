// Keeping the installed app up to date. The service worker keeps a copy of
// the app so it opens offline; without this, a tab or home-screen app left
// open could keep showing an old version long after an update went live.

import { registerSW } from 'virtual:pwa-register'

const HOUR = 60 * 60 * 1000

export function keepAppUpdated(): void {
  // With autoUpdate, the page reloads by itself once a new version is ready.
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {})
      }
      setInterval(check, HOUR)
      // Coming back to the app (switching tabs, reopening it from the home screen).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}
