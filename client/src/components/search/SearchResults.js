'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useInfiniteQuery } from '@tanstack/react-query'
import { LocateFixed } from 'lucide-react'
import { T } from '@/components/common/T'
import { CardGrid } from '@/components/listing/ListingCard'
import { LazyMap } from '@/components/map/LazyMap'
import { toMapPoints } from '@/components/map/points'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardListSkeleton } from '@/components/ui/Skeleton'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useT } from '@/hooks/useLang'
import { categoryHref } from '@/lib/format'
import { SearchBar } from './SearchBar'

const PAGE_SIZE = 20

// Mixed results grouped by category, in the order the ranking first shows each category.
function groupByCategory(cards) {
  const groups = new Map()
  for (const card of cards) {
    const key = card.category?.slug ?? '_other'
    if (!groups.has(key)) groups.set(key, { category: card.category, cards: [] })
    groups.get(key).cards.push(card)
  }
  return [...groups.values()]
}

export function SearchResults({ areas, initial }) {
  const t = useT()
  const params = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  const area = params.get('area') ?? ''
  const [view, setView] = useState('list')
  const near = useGeolocation()

  const query = useInfiniteQuery({
    queryKey: ['search', q, area, near.point],
    queryFn: async ({ pageParam }) => {
      const { searchListings } = await import('@/services/public.service')
      return searchListings({
        q,
        area: area || undefined,
        ...near.point,
        cursor: pageParam,
        limit: PAGE_SIZE,
      })
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    enabled: q.length > 0,
    // The server already fetched page one for this query (no location).
    ...(initial &&
      initial.q === q &&
      initial.area === area &&
      !near.point && {
        initialData: { pages: [initial.page], pageParams: [undefined] },
        staleTime: 60_000,
      }),
  })

  const first = query.data?.pages[0]?.data
  const cards = query.data?.pages.flatMap((p) => p.data.results) ?? []

  return (
    <div className="flex flex-col gap-6">
      <SearchBar key={`${q}|${area}`} areas={areas} defaultQuery={q} defaultArea={area} size="md" />

      {!q ? (
        <p className="text-text-muted">
          <T k="search.start" />
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">
              <T k="search.resultsFor" /> “{q}”
            </h1>
            <div className="flex flex-wrap gap-2">
              <Chip
                selected={near.status === 'ready'}
                onClick={near.status === 'ready' ? near.clear : near.locate}
              >
                <LocateFixed aria-hidden="true" className="size-4" />
                <T k="filters.nearMe" />
              </Chip>
              <Chip selected={view === 'list'} onClick={() => setView('list')}>
                <T k="filters.list" />
              </Chip>
              <Chip selected={view === 'map'} onClick={() => setView('map')}>
                <T k="filters.map" />
              </Chip>
            </div>
          </div>
          {near.status === 'denied' && (
            <p className="text-sm text-text-muted" role="status">
              <T k="geo.denied" />
            </p>
          )}

          {first?.didYouMean && (
            <p>
              <T k="search.didYouMean" />{' '}
              <Link
                href={`/search?q=${encodeURIComponent(first.didYouMean)}${area ? `&area=${area}` : ''}`}
                className="font-semibold text-brand underline"
              >
                {first.didYouMean}
              </Link>
              ?
            </p>
          )}

          {first?.categories?.length > 0 && (
            <nav aria-label={t('search.categories')} className="flex flex-wrap gap-2">
              {first.categories.map((c) => (
                <Link
                  key={c.slug}
                  href={categoryHref(c)}
                  className="inline-flex min-h-11 items-center rounded-pill border border-border px-4 text-sm font-semibold hover:bg-surface-raised"
                >
                  <T en={c.nameEn} ne={c.nameNe} />
                </Link>
              ))}
            </nav>
          )}

          <div aria-live="polite" aria-busy={query.isFetching}>
            {query.isPending ? (
              <CardListSkeleton />
            ) : query.isError && !cards.length ? (
              <EmptyState
                message={<T k="error.body" />}
                action={
                  <Button variant="secondary" onClick={() => query.refetch()}>
                    <T k="common.retry" />
                  </Button>
                }
              />
            ) : !cards.length ? (
              <EmptyState message={<T k="search.noResults" />} />
            ) : view === 'map' ? (
              <LazyMap points={toMapPoints(cards)} className="h-[60dvh]" />
            ) : (
              <div className="flex flex-col gap-8">
                {groupByCategory(cards).map(({ category, cards: group }) => (
                  <section key={category?.slug ?? '_other'} className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold">
                      {category ? (
                        <Link href={categoryHref(category)} className="hover:underline">
                          <T en={category.nameEn} ne={category.nameNe} />
                        </Link>
                      ) : (
                        <T k="search.other" />
                      )}
                    </h2>
                    <CardGrid cards={group} />
                  </section>
                ))}
              </div>
            )}
          </div>

          {query.hasNextPage && view === 'list' && (
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
        </>
      )}
    </div>
  )
}
