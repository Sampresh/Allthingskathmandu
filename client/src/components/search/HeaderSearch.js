import { Search } from 'lucide-react'
import { allPublicMessages } from '@/components/common/ST'
import { ST as T } from '@/components/common/ST'

/**
 * Header search: a plain form that opens /search?q=…, so it costs no JavaScript on every
 * page. The full search box with suggestions is on the home and search pages.
 */
export function HeaderSearch() {
  const placeholder = allPublicMessages['search.placeholder'].en
  return (
    <form role="search" action="/search" className="relative flex w-full">
      <label htmlFor="header-search" className="sr-only">
        <T k="search.label" />
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-muted"
      />
      <input
        id="header-search"
        type="search"
        name="q"
        required
        maxLength={100}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-pill border border-text-muted/40 bg-surface pr-3 pl-10 text-base"
      />
    </form>
  )
}
