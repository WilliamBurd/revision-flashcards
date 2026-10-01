// The study day starts at 4am, not midnight, so a late-night session still
// counts as "today" (the same rule Anki uses).
export const DAY_START_HOUR = 4

/** Start of the study day containing `now`, in local time. */
export function dayStart(now: number): number {
  const d = new Date(now)
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1)
  d.setHours(DAY_START_HOUR, 0, 0, 0)
  return d.getTime()
}

/** Start of the next study day: anything due before this counts as due today. */
export function nextDayStart(now: number): number {
  const d = new Date(dayStart(now))
  d.setDate(d.getDate() + 1)
  return d.getTime()
}

/** A label for the study day, e.g. "2026-10-01". */
export function dayKey(now: number): string {
  const d = new Date(dayStart(now))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
