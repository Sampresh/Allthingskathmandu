import Link from 'next/link'
import { Search } from 'lucide-react'
import { HeaderSearch } from '@/components/search/HeaderSearch'
import { AccountMenu } from './AccountMenu'
import { LanguageToggle } from './LanguageToggle'
import { ST as T } from './ST'

const navLink =
  'inline-flex min-h-11 items-center rounded-box px-3 font-semibold hover:bg-surface-raised'

/** Desktop: logo, search, Market, Events, Saved, account, List your business. Mobile: logo, search, account. */
export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 font-display text-lg font-semibold"
        >
          <span
            aria-hidden="true"
            className="inline-block size-3 rotate-45 rounded-[2px] bg-brand"
          />
          <T k="site.name" />
        </Link>
        <div className="hidden flex-1 lg:block">
          <HeaderSearch />
        </div>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          <Link href="/market" prefetch={false} className={navLink}>
            <T k="nav.market" />
          </Link>
          <Link href="/events" prefetch={false} className={navLink}>
            <T k="nav.events" />
          </Link>
          <Link href="/account/saved" prefetch={false} className={navLink}>
            <T k="nav.saved" />
          </Link>
          <LanguageToggle />
          <AccountMenu />
          <Link
            href="/business"
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-box bg-brand px-4 font-semibold text-brand-contrast hover:opacity-90"
          >
            <T k="nav.listBusiness" />
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <Link
            href="/search"
            className="inline-flex size-11 items-center justify-center rounded-box hover:bg-surface-raised"
          >
            <Search aria-hidden="true" className="size-6" />
            <span className="sr-only">
              <T k="nav.search" />
            </span>
          </Link>
          <LanguageToggle />
          <AccountMenu compact />
        </div>
      </div>
    </header>
  )
}
