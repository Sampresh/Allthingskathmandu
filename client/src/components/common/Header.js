import Link from 'next/link'
import { Search } from 'lucide-react'
import { HeaderSearch } from '@/components/search/HeaderSearch'
import { AccountMenu } from './AccountMenu'
import { LanguageToggle } from './LanguageToggle'
import { ST as T } from './ST'

const navLink =
  'inline-flex min-h-11 items-center rounded-box px-3 font-semibold hover:bg-surface-raised'

/**
 * Desktop: logo, search, Market, Events, Saved, account, List your business. Tablet: logo, search,
 * language, account. Phone: logo, language and the
 * signed-in menu (it holds Log out); the bottom bar has Search and Account.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link
          href="/"
          className="inline-flex min-h-11 min-w-0 items-center gap-2 font-display text-base font-bold tracking-tight sm:shrink-0 sm:text-lg"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 shrink-0 fill-brand">
            <path d="M1 21 9 6l4 7 3-4 7 12z" />
          </svg>
          <span className="truncate">
            <T k="site.name" />
          </span>
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
            className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 font-semibold whitespace-nowrap text-brand-contrast hover:opacity-90"
          >
            <T k="nav.listBusiness" />
          </Link>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1 lg:hidden">
          <Link
            href="/search"
            className="hidden size-11 items-center justify-center rounded-box hover:bg-surface-raised sm:inline-flex"
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
