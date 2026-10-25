'use client'

import Link from 'next/link'
import { useInfiniteQuery } from '@tanstack/react-query'
import { AccountT as T } from '@/components/common/AccountT'
import { FormError } from '@/components/common/FormStatus'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { allAccountMessages } from '@/hooks/useAccountT'
import { formatClock, formatDay } from '@/lib/dates'
import { eventHref } from '@/lib/format'

const TONE = { PENDING: 'neutral', APPROVED: 'success', REJECTED: 'danger' }

/** Events someone submitted, with their moderation status. `load(cursor)` fetches a page. */
export function SubmittedEvents({ queryKey, load }) {
  const events = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => load(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  })
  const rows = events.data?.pages.flatMap((p) => p.data) ?? []

  if (events.isPending) return <Skeleton className="h-32 w-full" />
  return (
    <div className="flex flex-col gap-3">
      <FormError error={events.error} messages={allAccountMessages} />
      {rows.length === 0 ? (
        <EmptyState message={<T k="events.mine.empty" />} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-box border border-border p-3"
            >
              <div className="flex flex-col">
                <span className="font-semibold">
                  {e.status === 'APPROVED' ? (
                    <Link href={eventHref(e.slug)} className="text-brand hover:underline">
                      {e.title}
                    </Link>
                  ) : (
                    e.title
                  )}
                </span>
                <span className="text-sm text-text-muted">
                  {formatDay(e.startsAt)}, {formatClock(e.startsAt)}
                </span>
              </div>
              <Badge tone={TONE[e.status]}>
                <T k={`status.${e.status}`} />
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {events.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => events.fetchNextPage()}
          loading={events.isFetchingNextPage}
          className="self-start"
        >
          <T k="listing.loadMore" />
        </Button>
      )}
    </div>
  )
}
