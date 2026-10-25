'use client'

import { useState } from 'react'
import { T } from '@/components/common/T'
import { Button } from '@/components/ui/Button'
import { Stars } from '@/components/ui/Rating'
import { formatDate } from '@/lib/format'

/** Approved reviews: the first page comes from the server, "Load more" fetches the rest. */
export function ReviewList({ slug, initialItems, initialCursor }) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadMore = async () => {
    setLoading(true)
    setError(false)
    try {
      const { getListingReviews } = await import('@/services/public.service')
      const page = await getListingReviews(slug, cursor)
      setItems((current) => [...current, ...page.data])
      setCursor(page.meta.nextCursor)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (!items.length) {
    return (
      <p className="text-text-muted">
        <T k="listing.noReviews" />
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4">
        {items.map((review) => (
          <li
            key={review.id}
            className="flex flex-col gap-1 border-b border-border pb-4 last:border-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                {review.author.name ?? <T k="listing.formerMember" />}
              </span>
              <Stars value={review.rating} />
              <span className="text-sm text-text-muted">{formatDate(review.createdAt)}</span>
            </div>
            {review.body && <p className="whitespace-pre-line">{review.body}</p>}
          </li>
        ))}
      </ul>
      {cursor && (
        <div>
          <Button variant="secondary" onClick={loadMore} loading={loading}>
            <T k={error ? 'common.retry' : 'listing.loadMore'} />
          </Button>
        </div>
      )}
    </div>
  )
}
