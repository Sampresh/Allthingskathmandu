'use client'

import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { MarketT as T } from '@/components/common/MarketT'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { useLang } from '@/hooks/useLang'
import { useMarketT } from '@/hooks/useMarketT'
import { formatDay, nepalDateKey } from '@/lib/dates'
import { EventCard } from './EventCard'

const PAGE_SIZE = 20

/** Upcoming events grouped by day (Kathmandu dates), with an area filter and Load more. */
export function EventList({ areas, initialItems, initialCursor }) {
  const t = useMarketT()
  const lang = useLang()
  const [area, setArea] = useState('')
  const query = useInfiniteQuery({
    queryKey: ['events', area],
    queryFn: async ({ pageParam }) => {
      const { getEvents } = await import('@/services/public.service')
      return getEvents({ area, cursor: pageParam, limit: PAGE_SIZE })
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    ...(!area && {
      initialData: {
        pages: [{ data: initialItems, meta: { nextCursor: initialCursor } }],
        pageParams: [undefined],
      },
      staleTime: Infinity,
    }),
  })
  const events = query.data?.pages.flatMap((p) => p.data) ?? []

  // Grouped by start day; events still running from an earlier day come first.
  const days = []
  for (const event of events) {
    const key = nepalDateKey(event.startsAt)
    if (days.at(-1)?.key !== key) days.push({ key, label: event.startsAt, events: [] })
    days.at(-1).events.push(event)
  }

  let body
  if (query.isPending) body = <Skeleton className="h-64 w-full" />
  else if (query.isError && !events.length) {
    body = (
      <EmptyState
        message={<T k="error.body" />}
        action={
          <Button variant="secondary" onClick={() => query.refetch()}>
            <T k="common.retry" />
          </Button>
        }
      />
    )
  } else if (!events.length) {
    body = <EmptyState message={<T k="events.empty" />} />
  } else {
    body = (
      <div className="flex flex-col gap-6">
        {days.map((day) => (
          <section key={day.key} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{formatDay(day.label)}</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {day.events.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} showDay={false} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Select
        label={<T k="events.area" />}
        value={area}
        onChange={(e) => setArea(e.target.value)}
        className="max-w-xs"
      >
        <option value="">{t('events.allAreas')}</option>
        {areas.map((a) => (
          <option key={a.slug} value={a.slug}>
            {(lang === 'ne' && a.nameNe) || a.nameEn}
          </option>
        ))}
      </Select>
      <div aria-live="polite" aria-busy={query.isFetching}>
        {body}
      </div>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={() => query.fetchNextPage()}
            loading={query.isFetchingNextPage}
          >
            <T k="listing.loadMore" />
          </Button>
        </div>
      )}
    </div>
  )
}
