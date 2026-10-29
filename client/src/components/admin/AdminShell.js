'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  MountainSnow,
  X,
} from 'lucide-react'
import { Sidebar } from '@/components/ui/Sidebar'
import { logout } from '@/services/auth.service'
import { overview } from '@/services/admin.service'
import { QUEUE_ITEMS, canSee, findNavItem, isActiveHref, navFor } from './adminNav'
import { ToastProvider } from './Toast'

const COLLAPSED_KEY = 'atk-admin-sidebar-collapsed'

const BRAND = {
  title: 'All Things Kathmandu',
  subtitle: 'Admin console',
  href: '/admin',
  icon: MountainSnow,
  navLabel: 'Admin',
}

const roleLabel = (role) => role.replace('_', ' ').toLowerCase()

const initials = (name) =>
  (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Closes a popover on outside click or Escape. */
function useDismiss(open, setOpen) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])
  return ref
}

export function AdminShell({ user, children }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Rendered only after the client auth store has a user, so localStorage is safe here.
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const isAdmin = canSee(user.role, 'ADMIN')

  // Pending counts for the sidebar badges; shares its cache with the dashboard.
  const { data: stats } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: overview,
    enabled: isAdmin,
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const toggleCollapsed = () =>
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, value ? '0' : '1')
      } catch {}
      return !value
    })

  const groups = navFor(user.role).map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      badge: item.queue ? stats?.pending[item.queue] : undefined,
    })),
  }))
  const isActive = (href) => isActiveHref(pathname, href)

  return (
    <ToastProvider>
      <div
        className="flex min-h-dvh"
        // Width of the desktop sidebar, for full-width bars fixed beside it (listing save bar).
        style={{ '--admin-sidebar': collapsed ? '4rem' : '16rem' }}
      >
        <aside
          className={clsx(
            'sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-surface transition-[width] duration-200 lg:block',
            collapsed ? 'w-16' : 'w-64',
          )}
        >
          <Sidebar
            brand={BRAND}
            groups={groups}
            isActive={isActive}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-[rgb(0_0_0/0.5)]"
              onClick={() => setDrawerOpen(false)}
            />
            <div
              id="admin-drawer"
              className="relative h-full w-72 max-w-[85vw] border-r border-border bg-surface shadow-overlay"
            >
              <Sidebar
                brand={BRAND}
                groups={groups}
                isActive={isActive}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            user={user}
            pathname={pathname}
            stats={stats}
            drawerOpen={drawerOpen}
            onMenu={() => setDrawerOpen((v) => !v)}
          />
          <main id="main" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}

function TopBar({ user, pathname, stats, drawerOpen, onMenu }) {
  const current = findNavItem(pathname)

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-surface px-4 lg:px-8">
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-box hover:bg-surface-raised lg:hidden"
        aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={drawerOpen}
        aria-controls="admin-drawer"
        onClick={onMenu}
      >
        {drawerOpen ? (
          <X aria-hidden="true" className="size-6" />
        ) : (
          <Menu aria-hidden="true" className="size-6" />
        )}
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        {current && (
          <ol className="flex items-center gap-1.5 text-sm">
            <li className="hidden text-text-muted sm:block">{current.group.title}</li>
            <li aria-hidden="true" className="hidden text-text-muted sm:block">
              <ChevronRight className="size-4" />
            </li>
            <li className="truncate font-semibold">
              <Link href={current.item.href} aria-current="page">
                {current.item.label}
              </Link>
            </li>
          </ol>
        )}
      </nav>

      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/"
          target="_blank"
          className="hidden min-h-11 items-center gap-2 rounded-box px-3 text-sm font-semibold text-text-muted hover:bg-surface-raised hover:text-text md:inline-flex"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          View site
          <span className="sr-only">(opens in a new tab)</span>
        </Link>
        {stats && <QueueBell pending={stats.pending} />}
        <UserMenu user={user} />
      </div>
    </header>
  )
}

function QueueBell({ pending }) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, setOpen)
  const total = QUEUE_ITEMS.reduce((sum, item) => sum + (pending[item.queue] ?? 0), 0)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={total ? `Review queue, ${total} waiting` : 'Review queue, nothing waiting'}
        className="relative inline-flex size-11 items-center justify-center rounded-box text-text-muted hover:bg-surface-raised hover:text-text"
      >
        <Bell aria-hidden="true" className="size-5" />
        {total > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 inline-flex min-w-5 items-center justify-center rounded-pill bg-danger px-1 text-xs font-semibold text-brand-contrast ring-2 ring-surface"
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-box border border-border bg-surface p-2 shadow-overlay">
          <p className="px-3 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
            Waiting for review
          </p>
          <ul>
            {QUEUE_ITEMS.map(({ href, label, icon: Icon, queue }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-box px-3 text-sm hover:bg-surface-raised"
                >
                  <Icon aria-hidden="true" className="size-4 text-text-muted" />
                  <span className="flex-1">{label}</span>
                  <span
                    className={clsx(
                      'font-semibold',
                      pending[queue] ? 'text-text' : 'text-text-muted',
                    )}
                  >
                    {pending[queue] ?? 0}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function UserMenu({ user }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, setOpen)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-box px-1.5 hover:bg-surface-raised sm:px-2"
      >
        <span
          aria-hidden="true"
          className="grid size-8 place-content-center rounded-pill bg-brand/15 text-xs font-semibold text-brand"
        >
          {initials(user.name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-36 truncate text-sm font-semibold">{user.name}</span>
          <span className="block text-xs text-text-muted capitalize">{roleLabel(user.role)}</span>
        </span>
        <ChevronDown aria-hidden="true" className="hidden size-4 text-text-muted sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-box border border-border bg-surface p-2 shadow-overlay">
          <div className="border-b border-border px-3 pt-1 pb-3">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
            <p className="mt-2 inline-flex rounded-pill border border-border px-2 py-0.5 text-xs font-semibold text-text-muted capitalize">
              {roleLabel(user.role)}
            </p>
          </div>
          <Link
            href="/"
            target="_blank"
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-11 items-center gap-3 rounded-box px-3 text-sm hover:bg-surface-raised md:hidden"
          >
            <ExternalLink aria-hidden="true" className="size-4 text-text-muted" />
            View site
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout().catch(() => {})
              router.replace('/admin/login')
            }}
            className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-box px-3 text-sm text-danger hover:bg-surface-raised"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
