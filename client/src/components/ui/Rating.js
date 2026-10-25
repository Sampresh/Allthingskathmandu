import { Star } from 'lucide-react'
import { T } from '@/components/common/T'

/** Read-only star rating with a text equivalent for screen readers. */
export function Rating({ value, count }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star aria-hidden="true" className="size-4 fill-featured text-featured" />
      <span className="font-semibold">{value.toFixed(1)}</span>
      <span className="sr-only">
        <T k="listing.ratingOutOf5" />
      </span>
      <span className="text-text-muted">({count})</span>
    </span>
  )
}

export function Stars({ value }) {
  return (
    <span className="inline-flex" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={n <= value ? 'size-4 fill-featured text-featured' : 'size-4 text-border'}
        />
      ))}
    </span>
  )
}
