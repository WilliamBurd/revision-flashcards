import type { Rating } from '../db/types'

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Cards rated No Idea in cram come back this many cards later. */
export const CRAM_AGAIN_GAP = 3

/** After rating the first card in the queue: No Idea puts it back a few cards later. */
export function cramAfterRating(queue: string[], rating: Rating): string[] {
  const [first, ...rest] = queue
  if (first === undefined) return []
  if (rating !== 1) return rest
  const at = Math.min(CRAM_AGAIN_GAP, rest.length)
  return [...rest.slice(0, at), first, ...rest.slice(at)]
}
