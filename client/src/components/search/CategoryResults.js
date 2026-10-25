'use client'

import { useState, useSyncExternalStore } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { T } from '@/components/common/T'
import { CardGrid } from '@/components/listing/ListingCard'
import { LazyMap } from '@/components/map/LazyMap'
import { toMapPoints } from '@/components/map/points'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardListSkeleton } from '@/components/ui/Skeleton'
import { useGeolocation } from '@/hooks/useGeolocation'
import { EMPTY_FILTERS, FilterBar } from './FilterBar'

const PAGE_SIZE = 20

function readFilters(search) {
  const p = new URLSearchParams(search)
  const list = (key) => (p.get(key) ? p.get(key).split(',').filter(Boolean) : [])
  return {
    tags: list('tags'),
    area: p.get('area') ?? '',
    open: p.get('open') === 'true',
    price: list('price')
      .map(Number)
      .filter((n) => n >= 1 && n <= 4),
    rating: p.get('rating') ?? '',
  }
}

function toParams(filters) {
  return {
    tags: filters.tags.join(',') || undefined,
    area: filters.area || undefined,
    open: filters.open ? 'true' : undefined,
    price: filters.price.join(',') || undefined,
    rating: filters.rating || undefined,
  }
}

const noSubscribe = () => () => {}

const isDefault = (filters) => JSON.stringify(filters) === JSON.stringify(EMPTY_FILTERS)

/**
 * Category listings: the first page is rendered on the server (cached); filters, Near me,
 * Load more and the map run here. Filters live in the URL so a filtered view can be shared.
 */
export function CategoryResults({ category, areas, initialItems, initialCursor }) {
  // Filters start from the URL (a shared link) once in the browser; the server render and
  // the cached first page always use no filters. After that, `chosen` holds the visitor's.
  const urlSearch = useSyncExternalStore(
    noSubscribe,
    () => window.location.search,
    () => '',
  )
  const [chosen, setFilters] = useState(null)
  const filters = chosen ?? readFilters(urlSearch)
  const [view, setView] = useState('list')
  const near = useGeolocation()

  const update = (next) => {
    setFilters(next)
    const params = new URLSearchParams(
      Object.entries(toParams(next)).filter(([, v]) => v !== undefined),
    )
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }

  const serverPage = isDefault(filters) && !near.point
  const query = useInfiniteQuery({
    queryKey: ['category-listings', category.slug, filters, near.point],
    queryFn: async ({ pageParam }) => {
      const { getCategoryListings } = await import('@/services/public.service')
      return getCategoryListings(category.slug, {
        ...toParams(filters),
        ...near.point,
        cursor: pageParam,
        limit: PAGE_SIZE,
      })
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    ...(serverPage && {
      initialData: {
        pages: [{ data: initialItems, meta: { nextCursor: initialCursor } }],
        pageParams: [undefined],
      },
      staleTime: Infinity,
    }),
  })

  const cards = query.data?.pages.flatMap((p) => p.data) ?? []

  let body
  if (query.isPending) body = <CardListSkeleton />
  else if (query.isError && !cards.length) {
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
  } else if (!cards.length) {
    body = filters.area ? (
      <EmptyState
        message={<T k="empty.area" />}
        action={
          <Button variant="secondary" onClick={() => update({ ...filters, area: '' })}>
            <T k="empty.viewAllAreas" />
          </Button>
        }
      />
    ) : (
      <EmptyState
        message={<T k="empty.filters" />}
        action={
          <Button variant="secondary" onClick={() => update(EMPTY_FILTERS)}>
            <T k="filters.clear" />
          </Button>
        }
      />
    )
  } else if (view === 'map') {
    body = <LazyMap points={toMapPoints(cards)} className="h-[60dvh]" />
  } else {
    body = <CardGrid cards={cards} headingLevel={2} />
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        tags={category.tags}
        areas={areas}
        filters={filters}
        onChange={update}
        view={view}
        onView={setView}
        near={near}
      />
      <div aria-live="polite" aria-busy={query.isFetching}>
        {body}
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
    </div>
  )
}
