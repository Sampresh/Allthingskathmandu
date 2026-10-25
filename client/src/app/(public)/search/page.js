import { Suspense } from 'react'
import { SearchResults } from '@/components/search/SearchResults'
import { CardListSkeleton } from '@/components/ui/Skeleton'
import { publicGet } from '@/lib/serverApi'

export const metadata = {
  title: 'Search',
  description: 'Search businesses, services, places and apps in Kathmandu Valley.',
  robots: { index: false, follow: true },
}

const SEARCH_REVALIDATE_SECONDS = 120 // same window as the API's search cache

/** First page of results is rendered on the server; later pages and filters load in the browser. */
export default async function SearchPage({ searchParams }) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : ''
  const area = typeof params.area === 'string' ? params.area : ''

  const qs = new URLSearchParams({ q, limit: '20', ...(area && { area }) })
  const [areas, first] = await Promise.all([
    publicGet('/areas', { tags: ['areas'] }),
    q
      ? publicGet(`/search?${qs}`, {
          tags: ['search'],
          revalidate: SEARCH_REVALIDATE_SECONDS,
        }).catch(() => null)
      : null,
  ])

  return (
    <Suspense fallback={<CardListSkeleton />}>
      <SearchResults
        areas={areas?.data ?? []}
        initial={first ? { q, area, page: { data: first.data, meta: first.meta } } : null}
      />
    </Suspense>
  )
}
