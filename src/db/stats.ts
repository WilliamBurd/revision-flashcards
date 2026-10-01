// Numbers for the Stats page.

import { dayKey, dayStart, nextDayStart } from '../lib/day'
import { db } from './db'
import { liveCards } from './study'
import { CardState, type Card, type Note } from './types'

export interface ForecastDay {
  /** Start of the study day. */
  start: number
  /** Cards due that day (today also includes anything overdue). */
  count: number
}

export interface Stats {
  streak: number
  studiedToday: boolean
  reviewsToday: number
  /** Share of reviews in the last 30 days that weren't No Idea, or null with none. */
  recall30: number | null
  forecast: ForecastDay[]
  leeches: { card: Card; note: Note }[]
}

const FORECAST_DAYS = 7

function addDays(start: number, days: number): number {
  const d = new Date(start)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/** Days in a row with at least one review, counting back from today (or yesterday, if not studied yet today). */
export function streakFrom(days: Set<string>, now: number): number {
  let day = dayStart(now)
  if (!days.has(dayKey(day))) day = addDays(day, -1)
  let streak = 0
  while (days.has(dayKey(day))) {
    streak++
    day = addDays(day, -1)
  }
  return streak
}

export async function getStats(now = Date.now()): Promise<Stats> {
  const [logs, cards, notes] = await Promise.all([db.review_logs.toArray(), liveCards(now), db.notes.toArray()])
  const live = logs.filter((l) => !l.deleted)
  const days = new Set(live.map((l) => dayKey(l.reviewed_at)))
  const today = dayStart(now)

  const since = addDays(today, -30)
  const recent = live.filter((l) => !l.is_cram && l.reviewed_at >= since && l.state_before !== CardState.New)
  const forgot = recent.filter((l) => l.rating === 1).length

  const forecast: ForecastDay[] = Array.from({ length: FORECAST_DAYS }, (_, i) => ({ start: addDays(today, i), count: 0 }))
  const end = addDays(today, FORECAST_DAYS)
  for (const card of cards) {
    if (card.state === CardState.New || card.due >= end) continue
    const i = card.due < nextDayStart(now) ? 0 : forecast.findIndex((d, j) => card.due >= d.start && (j === FORECAST_DAYS - 1 || card.due < forecast[j + 1].start))
    if (i >= 0) forecast[i].count++
  }

  const noteById = new Map(notes.filter((n) => !n.deleted).map((n) => [n.id, n]))
  const leeches = cards.flatMap((card) => {
    const note = card.is_leech ? noteById.get(card.note_id) : undefined
    return note ? [{ card, note }] : []
  })

  return {
    streak: streakFrom(days, now),
    studiedToday: days.has(dayKey(now)),
    reviewsToday: live.filter((l) => l.reviewed_at >= today).length,
    recall30: recent.length ? (recent.length - forgot) / recent.length : null,
    forecast,
    leeches,
  }
}
