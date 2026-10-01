import type { Rating } from '../db/types'
import { RATINGS } from '../scheduler/fsrs'

const COLOURS: Record<Rating, string> = {
  1: 'bg-r1',
  2: 'bg-r2',
  3: 'bg-r3',
  4: 'bg-r4',
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
          className={`flex min-h-17 flex-col items-center justify-center gap-0.5 rounded-btn px-1 text-white transition hover:brightness-110 active:scale-[0.97] ${COLOURS[rating]} disabled:opacity-60`}
        >
          <span className="text-sm leading-tight font-bold sm:text-base">{label}</span>
          <span className="text-[13px] opacity-90 sm:text-sm">{intervals?.[rating].label ?? '…'}</span>
        </button>
      ))}
    </div>
  )
}
