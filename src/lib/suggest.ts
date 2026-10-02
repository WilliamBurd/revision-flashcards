// Ask the app's server for questions to put on the front of a card, given the
// answer (api/suggest-question.ts, which uses Gemini's free tier).

import { supabase } from '../sync/supabase'

export type SuggestResult = { questions: string[] } | { error: string }

export async function suggestQuestions(answer: string, context: { subject?: string; set?: string }): Promise<SuggestResult> {
  if (!navigator.onLine) return { error: "You're offline. Suggestions need the internet." }
  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  if (!token) return { error: 'Sign in to get suggestions.' }
  let res: Response
  try {
    res = await fetch('/api/suggest-question', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ answer, ...context }),
    })
  } catch {
    return { error: "Couldn't reach the server. Try again in a moment." }
  }
  const body = (await res.json().catch(() => ({}))) as { questions?: string[]; error?: string }
  if (res.ok && body.questions?.length) return { questions: body.questions }
  if (body.error === 'not-set-up') return { error: "Suggestions aren't switched on yet: the Gemini key needs adding in Vercel (see the README)." }
  if (body.error === 'busy') return { error: "Gemini's free allowance is busy. Wait a minute and try again." }
  return { error: body.error || "Couldn't get a suggestion. Try again in a moment." }
}
