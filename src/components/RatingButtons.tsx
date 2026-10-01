import type { Rating } from '../db/types'
import { RATINGS } from '../scheduler/fsrs'

const COLOURS: Record<Rating, string> = {
  1: 'bg-rose-600 hover:bg-rose-700',
  2: 'bg-amber-600 hover:bg-amber-700',
  3: 'bg-emerald-600 hover:bg-emerald-700',
  4: 'bg-sky-600 hover:bg-sky-700',
}

interface Props {
  intervals: Record<Rating, { label: string }> | null
  onRate: (rating: Rating) => void
}

/** No Idea / Barely / Kind Of / Confident, each showing when the card comes back. */
export default function RatingButtons({ intervals, onRate }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map(({ rating, label }) => (
        <button
          key={rating}
          type="button"
          onClick={() => onRate(rating)}
          disabled={!intervals}
          title={`Press ${rating}`}
          className={`flex min-h-16 flex-col items-center justify-center rounded-xl px-1 text-white ${COLOURS[rating]} disabled:opacity-60`}
        >
          <span className="text-sm leading-tight font-semibold sm:text-base">{label}</span>
          <span className="text-xs opacity-90 sm:text-sm">{intervals?.[rating].label ?? '…'}</span>
        </button>
      ))}
    </div>
  )
}
