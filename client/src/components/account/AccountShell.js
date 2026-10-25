'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { AccountT as T } from '@/components/common/AccountT'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAccountT } from '@/hooks/useAccountT'
import { useAuthStore } from '@/store/authStore'

const NAV = [
  ['/account/profile', 'account.nav.profile'],
  ['/account/saved', 'account.nav.saved'],
  ['/account/reviews', 'account.nav.reviews'],
]

/** Member area frame: sign-in check and section tabs (Profile, Saved, My reviews). */
export function AccountShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useAccountT()
  const { user, status } = useAuthStore()

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [status, pathname, router])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        <T k="account.title" />
      </h1>
      <nav aria-label={t('account.title')} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {NAV.map(([href, key]) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={pathname === href ? 'page' : undefined}
                className={clsx(
                  'inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold whitespace-nowrap',
                  pathname === href
                    ? 'border-brand bg-brand text-brand-contrast'
                    : 'border-border hover:bg-surface-raised',
                )}
              >
                <T k={key} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {user ? (
        children
      ) : (
        <div role="status" aria-label={t('account.title')} className="flex flex-col gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
    </div>
  )
}
