// POST /api/suggest-question: given a card's answer, ask Google's Gemini
// (free tier) for a question to put on the front. The Gemini key lives only
// here on Vercel, and only signed-in users can call it, so nobody else can use
// up the free allowance. This never touches cards or their schedule.

import { geminiBody, invalidRequest, parseQuestions, type SuggestRequest } from './_suggest.js'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Ask Supabase whether the token belongs to a signed-in user. */
async function signedIn(token: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return false
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` } })
  return res.ok
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return json(503, { error: 'not-set-up' })

  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token || !(await signedIn(token))) return json(401, { error: 'Sign in to get suggestions.' })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const problem = invalidRequest(body)
  if (problem) return json(400, { error: problem })

  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(geminiBody(body as SuggestRequest)),
  })
  if (res.status === 429) return json(429, { error: 'busy' })
  if (!res.ok) {
    console.error('Gemini error', res.status, await res.text())
    return json(502, { error: 'Gemini could not suggest a question just now.' })
  }
  const questions = parseQuestions(await res.json())
  if (questions.length === 0) return json(502, { error: 'Gemini could not suggest a question just now.' })
  return json(200, { questions })
}
