// Shared button styles. Every tap target is at least 48px tall.
const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export const btn = {
  primary: `${base} bg-indigo-600 text-white hover:bg-indigo-700`,
  secondary: `${base} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`,
  danger: `${base} bg-rose-600 text-white hover:bg-rose-700`,
  ghost: `${base} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`,
  icon: 'inline-flex h-12 w-12 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
}

export const input =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-lg text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

export const panel = 'rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
