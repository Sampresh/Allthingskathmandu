'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { ToastProvider } from '@/components/admin/Toast'
import { useBusinessListing, withListing } from '@/hooks/useBusinessListing'

const NAV = [
  ['/business/dashboard', 'Dashboard'],
  ['/business/listing', 'Listing details'],
  ['/business/media', 'Photos & videos'],
  ['/business/offers', 'Offers'],
  ['/business/events', 'Events'],
  ['/business/plan', 'Plan & billing'],
  ['/business/invoices', 'Invoices'],
]

/** Portal frame: listing switcher and sections (Part 4 §3, Business portal). */
export function BusinessShell({ isOwner, children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { listings, listingId } = useBusinessListing()

  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-sm font-semibold text-text-muted">
              All Things Kathmandu
            </Link>
            <p className="text-xl font-semibold">Business portal</p>
          </div>
          {isOwner && listings.length > 1 && (
            <label className="flex flex-col text-sm font-semibold">
              Listing
              <select
                value={listingId ?? ''}
                onChange={(e) => router.replace(withListing(pathname, e.target.value))}
                className="min-h-11 rounded-box border border-text-muted bg-surface px-3 font-normal"
              >
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>
        {isOwner && (
          <nav aria-label="Business portal" className="-mx-4 overflow-x-auto px-4">
            <ul className="flex gap-2">
              {NAV.map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={withListing(href, listingId)}
                    aria-current={pathname === href ? 'page' : undefined}
                    className={clsx(
                      'inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold whitespace-nowrap',
                      pathname === href
                        ? 'border-brand bg-brand text-brand-contrast'
                        : 'border-border hover:bg-surface-raised',
                    )}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}
