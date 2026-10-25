'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { AccountT as T } from '@/components/common/AccountT'
import { FormError } from '@/components/common/FormStatus'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Stars } from '@/components/ui/Rating'
import { Skeleton } from '@/components/ui/Skeleton'
import { allAccountMessages } from '@/hooks/useAccountT'
import { formatDate, listingHref } from '@/lib/format'
import { deleteReview, myReviews } from '@/services/member.service'
import ReviewForm from './ReviewForm'
import { Section } from './Section'

const TONE = { PENDING: 'neutral', APPROVED: 'success', REJECTED: 'danger' }

export function ReviewsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const reviews = useInfiniteQuery({
    queryKey: ['account', 'reviews'],
    queryFn: ({ pageParam }) => myReviews(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  })
  const remove = useMutation({
    mutationFn: deleteReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'reviews'] }),
  })
  const items = reviews.data?.pages.flatMap((p) => p.data) ?? []

  return (
    <Section titleKey="account.reviews.title">
      <FormError error={reviews.error ?? remove.error} messages={allAccountMessages} />
      {reviews.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <EmptyState message={<T k="account.reviews.empty" />} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-box border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">
                  {r.listing.live ? (
                    <Link href={listingHref(r.listing.slug)} className="text-brand hover:underline">
                      {r.listing.name}
                    </Link>
                  ) : (
                    <>
                      {r.listing.name}{' '}
                      <span className="text-sm font-normal text-text-muted">
                        (<T k="account.reviews.unavailable" />)
                      </span>
                    </>
                  )}
                </h3>
                <Badge tone={TONE[r.status]}>
                  <T k={`account.reviews.${r.status}`} />
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Stars value={r.rating} />
                <span className="text-sm text-text-muted">{formatDate(r.updatedAt)}</span>
              </div>
              {r.body && <p className="whitespace-pre-line">{r.body}</p>}
              <div className="flex flex-wrap gap-2">
                {r.listing.live && (
                  <Button variant="secondary" onClick={() => setEditing(r)}>
                    <T k="account.reviews.edit" />
                  </Button>
                )}
                <ConfirmButton
                  variant="danger"
                  title={<T k="account.reviews.deleteTitle" />}
                  message={<T k="account.reviews.deleteBody" />}
                  confirmLabel={<T k="account.reviews.delete" />}
                  cancelLabel={<T k="account.cancel" />}
                  onConfirm={() => remove.mutateAsync(r.id)}
                >
                  <T k="account.reviews.delete" />
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {reviews.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => reviews.fetchNextPage()}
          loading={reviews.isFetchingNextPage}
          className="self-start"
        >
          <T k="listing.loadMore" />
        </Button>
      )}
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={<T k="review.editTitle" />}
      >
        {editing && <ReviewForm key={editing.id} review={editing} />}
      </Dialog>
    </Section>
  )
}
