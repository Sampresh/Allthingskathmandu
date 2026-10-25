'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bookmark, CircleUserRound, Home, Search, Store } from 'lucide-react'
import { clsx } from 'clsx'
import { useT } from '@/hooks/useLang'
import { homeFor } from '@/lib/authRoutes'
import { useAuthStore } from '@/store/authStore'
import { T } from './T'

/** Mobile bottom bar: Home, Search, Market, Saved, Account. */
export function BottomBar() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const t = useT()
  const items = [
    { href: '/', label: 'nav.home', Icon: Home },
    { href: '/search', label: 'nav.search', Icon: Search },
    { href: '/market', label: 'nav.market', Icon: Store },
    { href: '/account/saved', label: 'nav.saved', Icon: Bookmark },
    { href: user ? homeFor(user) : '/login', label: 'nav.account', Icon: CircleUserRound },
  ]
  const isActive = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, Icon }) => (
          <li key={label}>
            <Link
              href={href}
              // Market, Saved and Account are private or heavy; load them only when tapped.
              prefetch={href === '/' || href === '/search' ? undefined : false}
              aria-current={isActive(href) ? 'page' : undefined}
              className={clsx(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold',
                isActive(href) ? 'text-brand' : 'text-text-muted',
              )}
            >
              <Icon aria-hidden="true" className="size-6" />
              <T k={label} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
