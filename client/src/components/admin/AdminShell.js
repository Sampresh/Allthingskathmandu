'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { clsx } from 'clsx'
import { logout } from '@/services/auth.service'
import { ToastProvider } from './Toast'

const RANK = { MODERATOR: 1, ADMIN: 2, SUPER_ADMIN: 3 }

// Sidebar per module (Part 4 §3); `min` is the lowest role that sees it (Part 3 §7).
const NAV = [
  { title: 'Overview', items: [{ href: '/admin', label: 'Dashboard', min: 'MODERATOR' }] },
  {
    title: 'Moderation',
    items: [
      { href: '/admin/claims', label: 'Claims', min: 'MODERATOR' },
      { href: '/admin/reviews', label: 'Reviews', min: 'MODERATOR' },
      { href: '/admin/reports', label: 'Reports', min: 'MODERATOR' },
    ],
  },
  {
    title: 'Directory',
    items: [
      { href: '/admin/listings', label: 'Listings', min: 'ADMIN' },
      { href: '/admin/categories', label: 'Categories', min: 'ADMIN' },
      { href: '/admin/tags', label: 'Tags', min: 'ADMIN' },
      { href: '/admin/areas', label: 'Areas', min: 'ADMIN' },
      { href: '/admin/synonyms', label: 'Search synonyms', min: 'ADMIN' },
      { href: '/admin/media', label: 'Media', min: 'ADMIN' },
    ],
  },
  {
    title: 'Site',
    items: [
      { href: '/admin/homepage', label: 'Homepage', min: 'ADMIN' },
      { href: '/admin/pages', label: 'Pages', min: 'ADMIN' },
      { href: '/admin/seo', label: 'SEO', min: 'ADMIN' },
      { href: '/admin/settings', label: 'Settings', min: 'ADMIN' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { href: '/admin/plans', label: 'Plans', min: 'ADMIN' },
      { href: '/admin/payments', label: 'Payments', min: 'ADMIN' },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/admin/users', label: 'Users', min: 'ADMIN' },
      { href: '/admin/audit', label: 'Audit log', min: 'SUPER_ADMIN' },
    ],
  },
]

export const canSee = (role, min) => (RANK[role] ?? 0) >= RANK[min]

export function AdminShell({ user, children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const isActive = (href) => (href === '/admin' ? pathname === href : pathname.startsWith(href))

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-4 p-4">
      {NAV.map((group) => {
        const items = group.items.filter((i) => canSee(user.role, i.min))
        if (!items.length) return null
        return (
          <div key={group.title}>
            <p className="mb-1 px-3 text-xs font-semibold text-text-muted uppercase">
              {group.title}
            </p>
            <ul>
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={clsx(
                      'flex min-h-11 items-center rounded-box px-3 text-sm font-semibold',
                      isActive(item.href)
                        ? 'bg-brand text-brand-contrast'
                        : 'hover:bg-surface-raised',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:block">
          <Link href="/" className="flex min-h-14 items-center px-7 font-semibold">
            All Things Kathmandu
          </Link>
          {nav}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-box hover:bg-surface-raised lg:hidden"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? (
                <X aria-hidden="true" className="size-6" />
              ) : (
                <Menu aria-hidden="true" className="size-6" />
              )}
            </button>
            <p className="text-sm text-text-muted">
              {user.name} · {user.role.replace('_', ' ').toLowerCase()}
            </p>
            <button
              type="button"
              onClick={async () => {
                await logout().catch(() => {})
                router.replace('/admin/login')
              }}
              className="inline-flex min-h-11 items-center rounded-box px-3 text-sm font-semibold hover:bg-surface-raised"
            >
              Log out
            </button>
          </header>
          {open && <div className="border-b border-border lg:hidden">{nav}</div>}
          <main id="main" className="flex-1 p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
