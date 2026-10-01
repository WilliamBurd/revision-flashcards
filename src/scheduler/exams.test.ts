import { describe, expect, it } from 'vitest'
import { newCardSchedule, makeScheduler, rateCard, DEFAULT_SCHEDULER_SETTINGS } from './fsrs'
import { daysUntil, examDatesFor, examStart, latestBeforeExam, nextExamStart, settingsForExam } from './exams'
import type { Card } from '../db/types'

const DAY = 24 * 60 * 60 * 1000
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()

function card(): Card {
  return {
    id: 'c',
    note_id: 'n',
    set_id: 's',
    variant: 'forward',
    ...newCardSchedule(0),
    is_leech: false,
    created_at: 0,
    updated_at: 0,
    deleted: false,
  }
}

describe('exam dates', () => {
  it('uses the set override before the subject dates', () => {
    expect(examDatesFor({ exam_dates: [{ name: 'P1', date: '2027-05-10' }] }, { exam_date_override: null })).toEqual(['2027-05-10'])
    expect(examDatesFor({ exam_dates: [{ name: 'P1', date: '2027-05-10' }] }, { exam_date_override: '2027-06-01' })).toEqual(['2027-06-01'])
  })

  it('moves on to the next exam once one has started', () => {
    const dates = ['2027-05-10', '2027-06-01']
    expect(nextExamStart(dates, at(2027, 5, 1))).toBe(examStart('2027-05-10'))
    expect(nextExamStart(dates, at(2027, 5, 10))).toBe(examStart('2027-06-01'))
    expect(nextExamStart(dates, at(2027, 6, 2))).toBeNull()
  })

  it('counts days to the exam', () => {
    expect(daysUntil(examStart('2027-05-10'), at(2027, 5, 1))).toBe(9)
    expect(daysUntil(examStart('2027-05-10'), at(2027, 5, 9, 23))).toBe(1)
  })

  it('raises retention to 95% only in the last 14 days', () => {
    const exam = examStart('2027-05-30')
    expect(settingsForExam(DEFAULT_SCHEDULER_SETTINGS, exam, at(2027, 5, 1)).target_retention).toBe(0.9)
    expect(settingsForExam(DEFAULT_SCHEDULER_SETTINGS, exam, at(2027, 5, 20)).target_retention).toBe(0.95)
    expect(settingsForExam(DEFAULT_SCHEDULER_SETTINGS, null, at(2027, 5, 20)).target_retention).toBe(0.9)
  })

  it('never schedules a card after the exam, so it comes up in the final week', () => {
    const exam = examStart('2027-05-10')
    const scheduler = makeScheduler({ ...DEFAULT_SCHEDULER_SETTINGS, max_interval_days: 365 })
    let c = card()
    let now = at(2027, 3, 1)
    // A well known card would normally go months; with the exam it stops the day before.
    for (let i = 0; i < 8; i++) {
      c = { ...c, ...rateCard(c, 4, now, scheduler, nextExamStart(['2027-05-10'], now)) }
      expect(c.due).toBeLessThan(exam)
      now = Math.max(now + 60_000, c.due)
      if (now >= exam - DAY) break
    }
    expect(c.due).toBeGreaterThanOrEqual(exam - 7 * DAY)
  })

  it('on the eve of the exam, still lands before it', () => {
    const exam = examStart('2027-05-10')
    const now = at(2027, 5, 9, 20)
    expect(latestBeforeExam(exam, now)).toBeLessThan(exam)
    expect(latestBeforeExam(exam, now)).toBeGreaterThan(now)
  })
})
