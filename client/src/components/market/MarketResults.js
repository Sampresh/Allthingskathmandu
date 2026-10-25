'use client'

import { useState, useSyncExternalStore } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { MarketT as T } from '@/components/common/MarketT'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { useLang } from '@/hooks/useLang'
import { useMarketT } from '@/hooks/useMarketT'
import { MarketCard } from './MarketCard'

const PAGE_SIZE = 20
const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']
const EMPTY = { category: '', condition: '', min: '', max: '', area: '', q: '' }
const KEYS = Object.keys(EMPTY)

const readFilters = (search) => {
  const p = new URLSearchParams(search)
  return Object.fromEntries(KEYS.map((k) => [k, p.get(k) ?? '']))
}
const isDefault = (f) => KEYS.every((k) => !f[k])
const noSubscribe = () => () => {}

/**
 * Market list (Part 4 §3): category, condition, price and area filters plus a title search.
 * The first page comes from the server (cached); filters live in the URL and fetch here.
 */
export function MarketResults({ categories, areas, initialItems, initialCursor }) {
  const t = useMarketT()
  const lang = useLang()
  const name = (item) => (lang === 'ne' && item.nameNe) || item.nameEn
  const urlSearch = useSyncExternalStore(
    noSubscribe,
    () => window.location.search,
    () => '',
  )
  const [chosen, setChosen] = useState(null)
  const filters = chosen ?? readFilters(urlSearch)
  // Typed values (search, prices) apply on Enter or when the field loses focus.
  const [draft, setDraft] = useState(null)
  const typed = draft ?? { q: filters.q, min: filters.min, max: filters.max }

  const update = (patch) => {
    const next = { ...filters, ...patch }
    setChosen(next)
    const params = new URLSearchParams(KEYS.filter((k) => next[k]).map((k) => [k, next[k]]))
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }
  const applyTyped = () => {
    const next = { q: typed.q.trim(), min: typed.min, max: typed.max }
    if (KEYS.some((k) => k in next && next[k] !== filters[k])) update(next)
  }

  const serverPage = isDefault(filters)
  const query = useInfiniteQuery({
    queryKey: ['market', filters],
    queryFn: async ({ pageParam }) => {
      const { getMarketItems } = await import('@/services/public.service')
      return getMarketItems({ ...filters, cursor: pageParam, limit: PAGE_SIZE })
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
  const items = query.data?.pages.flatMap((p) => p.data) ?? []

  let body
  if (query.isPending) body = <Skeleton className="h-64 w-full" />
  else if (query.isError && !items.length) {
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
  } else if (!items.length) {
    body = (
      <EmptyState
        message={<T k={serverPage ? 'market.none' : 'market.empty'} />}
        action={
          !serverPage && (
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(null)
                update(EMPTY)
              }}
            >
              <T k="filters.clear" />
            </Button>
          )
        }
      />
    )
  } else {
    body = (
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <MarketCard item={item} headingLevel={2} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          applyTyped()
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex gap-2">
          <label className="relative flex flex-1 items-center">
            <span className="sr-only">
              <T k="market.search" />
            </span>
            <Search aria-hidden="true" className="absolute left-3 size-5 text-text-muted" />
            <input
              type="search"
              value={typed.q}
              maxLength={100}
              placeholder={t('market.search')}
              onChange={(e) => setDraft({ ...typed, q: e.target.value })}
              onBlur={applyTyped}
              className="min-h-11 w-full rounded-box border border-text-muted bg-surface pr-3 pl-10"
            />
          </label>
          <Button type="submit">
            <T k="nav.search" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Select
            label={<T k="market.category" />}
            value={filters.category}
            onChange={(e) => update({ category: e.target.value })}
          >
            <option value="">{t('market.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {name(c)}
              </option>
            ))}
          </Select>
          <Select
            label={<T k="market.condition" />}
            value={filters.condition}
            onChange={(e) => update({ condition: e.target.value })}
          >
            <option value="">{t('market.anyCondition')}</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {t(`market.condition.${c}`)}
              </option>
            ))}
          </Select>
          <Select
            label={<T k="events.area" />}
            value={filters.area}
            onChange={(e) => update({ area: e.target.value })}
          >
            <option value="">{t('events.allAreas')}</option>
            {areas.map((a) => (
              <option key={a.slug} value={a.slug}>
                {name(a)}
              </option>
            ))}
          </Select>
          {['min', 'max'].map((key) => (
            <label key={key} className="flex flex-col gap-1 text-sm font-semibold">
              <T k={key === 'min' ? 'market.minPrice' : 'market.maxPrice'} />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={typed[key]}
                onChange={(e) => setDraft({ ...typed, [key]: e.target.value })}
                onBlur={applyTyped}
                className="min-h-11 rounded-box border border-text-muted bg-surface px-3 font-normal"
              />
            </label>
          ))}
        </div>
      </form>
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
