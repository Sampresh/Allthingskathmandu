'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { clsx } from 'clsx'
import { AccountT as T } from '@/components/common/AccountT'
import { FormError, FormSuccess } from '@/components/common/FormStatus'
import { Button } from '@/components/ui/Button'
import { allAccountMessages } from '@/hooks/useAccountT'
import { toNepaliDigits } from '@/lib/dates'
import { createReview, updateReview } from '@/services/member.service'

const MAX = 1000
const starLabel = (n) => ({
  en: `${n} star${n === 1 ? '' : 's'}`,
  ne: `${toNepaliDigits(n)} तारा`,
})

/**
 * New review (with `businessId`) or an edit of `review`. Every new or edited review waits for
 * moderation, so the form ends with a "will appear after a check" message.
 */
export default function ReviewForm({ businessId, review }) {
  const queryClient = useQueryClient()
  const id = useId()
  const [rating, setRating] = useState(review?.rating ?? 0)
  const [body, setBody] = useState(review?.body ?? '')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <FormSuccess>
        <T k="review.pending" />
        <Link href="/account/reviews" className="font-semibold underline">
          <T k="review.myReviews" />
        </Link>
      </FormSuccess>
    )
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    const next = {
      rating: rating ? null : 'v.rating',
      body: body.trim().length > MAX ? 'v.reviewMax' : null,
    }
    setErrors(next)
    if (next.rating || next.body) return
    setBusy(true)
    setError(null)
    try {
      const text = body.trim() || null
      if (review) await updateReview(review.id, { rating, body: text })
      else await createReview({ businessId, rating, body: text })
      queryClient.invalidateQueries({ queryKey: ['account', 'reviews'] })
      setDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError error={error} messages={allAccountMessages}>
        {error?.code === 'ALREADY_REVIEWED' && (
          <Link href="/account/reviews" className="font-semibold underline">
            <T k="review.myReviews" />
          </Link>
        )}
      </FormError>
      <fieldset
        aria-describedby={errors.rating ? `${id}-rating-error` : undefined}
        className="flex flex-col gap-2"
      >
        <legend className="mb-1 text-sm font-semibold">
          <T k="review.rating" />
        </legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name={`${id}-rating`}
                value={n}
                checked={rating === n}
                onChange={() => {
                  setRating(n)
                  setErrors((e) => ({ ...e, rating: null }))
                }}
                className="peer sr-only"
              />
              <span className="inline-flex size-11 items-center justify-center rounded-box peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                <Star
                  aria-hidden="true"
                  className={clsx(
                    'size-8',
                    n <= rating ? 'fill-featured text-featured' : 'text-text-muted',
                  )}
                />
                <span className="sr-only">
                  <T {...starLabel(n)} />
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.rating && (
          <p id={`${id}-rating-error`} className="text-sm text-danger">
            <T k={errors.rating} />
          </p>
        )}
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-body`} className="text-sm font-semibold">
          <T k="review.body" />
        </label>
        <textarea
          id={`${id}-body`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={MAX}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={`${id}-hint`}
          className={clsx(
            'rounded-box border bg-surface px-3 py-2 text-base text-text',
            errors.body ? 'border-danger' : 'border-text-muted',
          )}
        />
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {errors.body ? <T k={errors.body} /> : <T k="review.bodyHint" />} ({body.length}/{MAX})
        </p>
      </div>
      {review && (
        <p className="text-sm text-text-muted">
          <T k="review.editNote" />
        </p>
      )}
      <Button type="submit" loading={busy} className="self-start">
        <T k={review ? 'review.update' : 'review.submit'} />
      </Button>
    </form>
  )
}
