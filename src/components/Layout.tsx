import { useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { ChartIcon, HomeIcon, PaletteIcon, PlusIcon, SearchIcon, SettingsIcon } from './Icons'
import AccountDialog from './AccountDialog'
import SyncBadge from './SyncBadge'
import ThemePicker from './ThemePicker'

const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/add', label: 'Add', icon: PlusIcon },
  { to: '/browse', label: 'Browse', icon: SearchIcon },
  { to: '/stats', label: 'Stats', icon: ChartIcon },
]

interface LayoutContext {
  openThemePicker: () => void
  openAccount: () => void
}

export function useLayout() {
  return useOutletContext<LayoutContext>()
}

/** Bottom tab bar on phones, sidebar on desktop. */
export default function Layout() {
  const { pathname } = useLocation()
  const [themeOpen, setThemeOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const showQuickAdd = pathname !== '/add' && !pathname.endsWith('/edit')

  return (
    <div className="min-h-dvh lg:flex">
      <nav
        aria-label="Main"
        className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1 lg:border-r lg:border-line lg:bg-surface lg:p-4"
      >
        <p className="font-display mb-6 px-3 text-2xl">Burdis Flashcards</p>
        {TABS.map(({ to, label, icon: TabIcon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-btn px-3 font-semibold ${
                isActive ? 'bg-accent-soft text-on-accent-soft' : 'text-muted hover:bg-raised hover:text-ink'
              }`
            }
          >
            <TabIcon width={20} height={20} />
            {label}
          </NavLink>
        ))}
        <div className="mt-auto mb-2 px-1">
          <SyncBadge onClick={() => setAccountOpen(true)} />
        </div>
        <button
          type="button"
          onClick={() => setThemeOpen(true)}
          className="flex min-h-11 items-center gap-3 rounded-btn px-3 font-semibold text-muted hover:bg-raised hover:text-ink"
        >
          <PaletteIcon width={20} height={20} />
          Theme
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-3 rounded-btn px-3 font-semibold ${
              isActive ? 'bg-accent-soft text-on-accent-soft' : 'text-muted hover:bg-raised hover:text-ink'
            }`
          }
        >
          <SettingsIcon width={20} height={20} />
          Settings
        </NavLink>
      </nav>

      <main className="mx-auto w-full max-w-3xl px-4 pt-safe pb-32 lg:px-8 lg:pb-12">
        <Outlet
          context={{ openThemePicker: () => setThemeOpen(true), openAccount: () => setAccountOpen(true) } satisfies LayoutContext}
        />
      </main>

      {showQuickAdd && (
        <NavLink
          to="/add"
          aria-label="Quick add a card"
          className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex h-15 w-15 items-center justify-center rounded-btn bg-accent text-on-accent hero-shadow transition hover:bg-accent-strong active:scale-95 lg:hidden"
        >
          <PlusIcon width={28} height={28} strokeWidth={2.5} />
        </NavLink>
      )}

      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map(({ to, label, icon: TabIcon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <TabIcon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <ThemePicker open={themeOpen} onClose={() => setThemeOpen(false)} />
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  )
}
