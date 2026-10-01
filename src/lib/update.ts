// Keeping the installed app up to date. The service worker keeps a copy of
// the app so it opens offline; without this, a tab or home-screen app left
// open could keep showing an old version long after an update went live.
//
// A new version is switched to by reloading the page, so it waits until
// you're not in the middle of something: typing a card, editing, or a review.

import { registerSW } from 'virtual:pwa-register'

const HOUR = 60 * 60 * 1000
const RETRY_MS = 5000

/** True while a reload would interrupt you. */
export function isBusy(): boolean {
  const path = window.location.pathname
  if (path.startsWith('/add') || path.endsWith('/edit') || path.startsWith('/review')) return true
  if (document.querySelector('dialog[open]')) return true
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function keepAppUpdated(): void {
  let waiting: number | null = null
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // A new version is downloaded and ready. Switch when it's safe.
      if (waiting !== null) return
      const tryNow = () => {
        if (isBusy()) return
        if (waiting !== null) clearInterval(waiting)
        void updateSW(true)
      }
      waiting = window.setInterval(tryNow, RETRY_MS)
      tryNow()
    },
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
