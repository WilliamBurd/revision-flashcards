import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChartIcon, HomeIcon, PlusIcon, SearchIcon } from './Icons'

const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/add', label: 'Add', icon: PlusIcon },
  { to: '/browse', label: 'Browse', icon: SearchIcon },
  { to: '/stats', label: 'Stats', icon: ChartIcon },
]

/** Bottom tab bar on phones, sidebar on desktop. */
export default function Layout() {
  const { pathname } = useLocation()
  const showQuickAdd = pathname !== '/add' && !pathname.endsWith('/edit')

  return (
    <div className="min-h-dvh lg:flex">
      <nav
        aria-label="Main"
        className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-56 lg:shrink-0 lg:flex-col lg:gap-1 lg:border-r lg:border-slate-200 lg:p-4 dark:lg:border-slate-800"
      >
        <p className="mb-4 px-3 text-lg font-semibold">Revision</p>
        {TABS.map(({ to, label, icon: TabIcon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 font-medium ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
              }`
            }
          >
            <TabIcon width={20} height={20} />
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-3xl px-4 pt-safe pb-28 lg:px-8 lg:pb-12">
        <Outlet />
      </main>

      {showQuickAdd && (
        <NavLink
          to="/add"
          aria-label="Quick add a card"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 lg:hidden"
        >
          <PlusIcon width={28} height={28} />
        </NavLink>
      )}

      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map(({ to, label, icon: TabIcon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <TabIcon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
