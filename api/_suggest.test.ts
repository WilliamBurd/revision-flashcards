import { describe, expect, it } from 'vitest'
import { buildPrompt, geminiBody, invalidRequest, MAX_ANSWER_LENGTH, parseQuestions } from './_suggest'

const reply = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] })

describe('suggest a question', () => {
  it('checks the request', () => {
    expect(invalidRequest({ answer: '1485' })).toBeNull()
    expect(invalidRequest({ answer: '  ' })).toMatch(/Back/)
    expect(invalidRequest(null)).not.toBeNull()
    expect(invalidRequest({ answer: 'x'.repeat(MAX_ANSWER_LENGTH + 1) })).toMatch(/too long/)
    expect(invalidRequest({ answer: 'x', subject: 3 })).not.toBeNull()
  })

  it('puts the answer and topic in the prompt', () => {
    const prompt = buildPrompt({ answer: 'The Great Reform Act', subject: 'History', set: '1800s Britain' })
    expect(prompt).toContain('The Great Reform Act')
    expect(prompt).toContain('History / 1800s Britain')
    expect(prompt).toMatch(/one thing/)
    expect(buildPrompt({ answer: 'x' })).not.toContain('The card is in')
    expect(geminiBody({ answer: 'x' }).generationConfig.responseMimeType).toBe('application/json')
  })

  it('reads up to 3 tidy, different questions from the reply', () => {
    const q = parseQuestions(reply(JSON.stringify({ questions: ['  What   year? ', 'what year?', 'Who won?', 'Where?', 'Why?'] })))
    expect(q).toEqual(['What year?', 'Who won?', 'Where?'])
  })

  it('copes with a broken reply', () => {
    expect(parseQuestions({})).toEqual([])
    expect(parseQuestions(reply('not json'))).toEqual([])
    expect(parseQuestions(reply('{"questions": "one"}'))).toEqual([])
  })
})
