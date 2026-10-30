'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { clsx } from 'clsx'
import { T } from '@/components/common/T'
import { useLang, useT } from '@/hooks/useLang'
import { categoryHref, listingHref } from '@/lib/format'

const DEBOUNCE_MS = 200

function useSuggestions(query) {
  const [data, setData] = useState(null)
  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      // The API client loads on the first keystroke, not with the page.
      import('@/services/public.service')
        .then(({ suggest }) => suggest(q, { signal: controller.signal }))
        .then(setData)
        .catch(() => {})
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])
  return query.trim() ? data : null
}

/**
 * Search box with autocomplete (categories, listings, areas) and an optional area picker.
 * Combobox keyboard pattern: arrows move, Enter opens, Escape closes.
 */
export function SearchBar({
  areas,
  defaultQuery = '',
  defaultArea = '',
  size = 'lg',
  autoFocus = false,
}) {
  const hero = size === 'lg'
  const router = useRouter()
  const t = useT()
  const lang = useLang()
  const listboxId = useId()
  const [query, setQuery] = useState(defaultQuery)
  const [area, setArea] = useState(defaultArea)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef(null)
  const data = useSuggestions(query)

  const name = (item) => (lang === 'ne' && item.nameNe) || item.nameEn || item.name
  const options = data
    ? [
        ...data.categories.map((c) => ({
          key: `c-${c.slug}`,
          label: name(c),
          href: categoryHref(c),
          group: 'search.categories',
        })),
        ...data.listings.map((l) => ({
          key: `l-${l.slug}`,
          label: name(l),
          href: listingHref(l.slug),
          group: 'search.listings',
        })),
        ...data.areas.map((a) => ({
          key: `a-${a.slug}`,
          label: name(a),
          href: `/search?q=${encodeURIComponent(query.trim())}&area=${a.slug}`,
          group: 'search.areas',
        })),
      ]
    : []
  const showList = open && options.length > 0

  useEffect(() => {
    const close = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const submit = (event) => {
    event.preventDefault()
    if (showList && active >= 0) return router.push(options[active].href)
    const q = query.trim()
    if (!q) return
    const params = new URLSearchParams({ q })
    if (area) params.set('area', area)
    setOpen(false)
    router.push(`/search?${params}`)
  }

  const onKeyDown = (event) => {
    if (!showList) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (i + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1))
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className={clsx(
        'flex w-full flex-col gap-2 sm:flex-row',
        hero && 'rounded-panel bg-surface p-2 shadow-overlay sm:items-center sm:rounded-pill',
      )}
    >
      <div ref={boxRef} className="relative flex-1">
        <label htmlFor={`${listboxId}-input`} className="sr-only">
          <T k="search.label" />
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-text-muted"
        />
        <input
          id={`${listboxId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listboxId}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          maxLength={100}
          placeholder={t('search.placeholder')}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={clsx(
            'w-full bg-surface pr-3 pl-11 text-base',
            hero ? 'min-h-12 rounded-pill' : 'min-h-11 rounded-box border border-text-muted/40',
          )}
        />
        {showList && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-box border border-border bg-surface py-1 shadow-overlay"
          >
            {options.map((option, i) => (
              <li
                key={option.key}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => {
                  e.preventDefault()
                  router.push(option.href)
                }}
                className={clsx(
                  'flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3',
                  i === active && 'bg-surface-raised',
                )}
              >
                <span>{option.label}</span>
                <span className="text-xs text-text-muted">
                  <T k={option.group} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {areas && (
        <>
          <label htmlFor={`${listboxId}-area`} className="sr-only">
            <T k="search.area" />
          </label>
          <select
            id={`${listboxId}-area`}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={clsx(
              'bg-surface px-3 text-base sm:w-40',
              hero
                ? 'min-h-12 rounded-pill sm:rounded-none sm:border-l sm:border-border'
                : 'min-h-11 rounded-box border border-text-muted/40',
            )}
          >
            <option value="">{t('search.allAreas')}</option>
            {areas.map((a) => (
              <option key={a.slug} value={a.slug}>
                {name(a)}
              </option>
            ))}
          </select>
        </>
      )}
      <button
        type="submit"
        className={clsx(
          'inline-flex items-center justify-center rounded-pill bg-brand px-6 font-semibold text-brand-contrast transition-opacity hover:opacity-90',
          hero ? 'min-h-12' : 'min-h-11',
        )}
      >
        <T k="search.submit" />
      </button>
    </form>
  )
}
