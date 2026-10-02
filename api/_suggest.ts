// Shared by the suggest-question function and its tests. Files starting with
// "_" in api/ are not turned into their own endpoints by Vercel.

export interface SuggestRequest {
  /** The card's Back, in the app's text format (**bold**, _italics_, "- " bullets). */
  answer: string
  subject?: string
  set?: string
}

export const MAX_ANSWER_LENGTH = 2000

/** Check what the app sent. Returns an error message, or null when it's fine. */
export function invalidRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'Send JSON with an answer.'
  const { answer, subject, set } = body as Record<string, unknown>
  if (typeof answer !== 'string' || answer.trim() === '') return 'Type the answer on the Back first.'
  if (answer.length > MAX_ANSWER_LENGTH) return 'That answer is too long to suggest a question for.'
  if (subject !== undefined && typeof subject !== 'string') return 'Bad subject.'
  if (set !== undefined && typeof set !== 'string') return 'Bad set.'
  return null
}

export function buildPrompt({ answer, subject, set }: SuggestRequest): string {
  const topic = [subject, set].filter((s) => s && s.trim()).join(' / ')
  return [
    'You write the front of revision flashcards for a UK A-Level student.',
    'Follow the minimum information principle used by SuperMemo: each question should ask for one thing,',
    'be short and unambiguous, and have exactly the given answer as its answer. Do not put the answer,',
    'or words that give it away, in the question. Use British English.',
    topic ? `The card is in: ${topic}.` : '',
    'Write 3 different questions for this answer, best first.',
    '',
    'Answer (the back of the card):',
    '"""',
    answer.slice(0, MAX_ANSWER_LENGTH),
    '"""',
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n')
}

/** The JSON body for Gemini's generateContent. */
export function geminiBody(request: SuggestRequest) {
  return {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(request) }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { questions: { type: 'ARRAY', items: { type: 'STRING' } } },
        required: ['questions'],
      },
    },
  }
}

/** Pull up to 3 questions out of Gemini's reply. */
export function parseQuestions(reply: unknown): string[] {
  const text = (reply as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('')
  if (!text) return []
  let questions: unknown
  try {
    questions = (JSON.parse(text) as { questions?: unknown }).questions
  } catch {
    return []
  }
  if (!Array.isArray(questions)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of questions) {
    if (typeof q !== 'string') continue
    const clean = q.replace(/\s+/g, ' ').trim()
    if (!clean || seen.has(clean.toLowerCase())) continue
    seen.add(clean.toLowerCase())
    out.push(clean)
    if (out.length === 3) break
  }
  return out
}
