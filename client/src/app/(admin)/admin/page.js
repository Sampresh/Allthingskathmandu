'use client'

import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  ArrowRight,
  CircleCheck,
  FileText,
  FolderTree,
  House,
  Plus,
  Receipt,
  RefreshCw,
  Settings,
  Store,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { QUEUE_ITEMS, canSee } from '@/components/admin/adminNav'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Button } from '@/components/ui/Button'
import { GlowCard } from '@/components/ui/GlowCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatNpr } from '@/lib/format'
import { audit, overview, purgeCache } from '@/services/admin.service'
import { useAuthStore } from '@/store/authStore'

const NEPAL = 'Asia/Kathmandu'

const LISTING_STATUSES = [
  { key: 'LIVE', label: 'Live', bar: 'bg-success' },
  { key: 'PENDING', label: 'Pending review', bar: 'bg-warning' },
  { key: 'DRAFT', label: 'Draft', bar: 'bg-text-muted' },
  { key: 'SUSPENDED', label: 'Suspended', bar: 'bg-danger' },
]

const QUICK_ACTIONS = [
  { href: '/admin/listings/new', label: 'Add a listing', icon: Plus, min: 'ADMIN' },
  { href: '/admin/homepage', label: 'Arrange the homepage', icon: House, min: 'ADMIN' },
  { href: '/admin/categories', label: 'Manage categories', icon: FolderTree, min: 'ADMIN' },
  { href: '/admin/pages', label: 'Edit site pages', icon: FileText, min: 'ADMIN' },
  { href: '/admin/settings', label: 'Site settings', icon: Settings, min: 'ADMIN' },
]

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: NEPAL }).format(
      new Date(),
    ),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const today = () =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: NEPAL }).format(new Date())

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
function timeAgo(iso) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

export default function AdminHome() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = canSee(user.role, 'ADMIN')
  const isSuper = canSee(user.role, 'SUPER_ADMIN')
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: overview,
    enabled: isAdmin,
  })
  const loading = isAdmin && isPending

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        description={today()}
        actions={
          isAdmin && (
            <Button href="/admin/listings/new">
              <Plus aria-hidden="true" className="size-5" />
              Add listing
            </Button>
          )
        }
      />

      {isError && (
        <p
          className="flex flex-wrap items-center gap-3 rounded-box border border-danger p-4 text-danger"
          role="alert"
        >
          Could not load the numbers.
          <Button variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </p>
      )}

      <ReviewQueues pending={data?.pending} loading={loading} showCounts={isAdmin} />

      {isAdmin && (
        <>
          <section aria-labelledby="glance" className="flex flex-col gap-4">
            <SectionTitle id="glance">Site at a glance</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={Store}
                label="Live listings"
                value={data?.listings.LIVE ?? 0}
                href="/admin/listings?status=LIVE"
                loading={loading}
              />
              <MetricCard
                icon={FileText}
                label="Drafts to finish"
                value={data?.listings.DRAFT ?? 0}
                href="/admin/listings?status=DRAFT"
                loading={loading}
              />
              <MetricCard
                icon={Users}
                label="Registered users"
                value={data?.users ?? 0}
                href="/admin/users"
                loading={loading}
              />
              <MetricCard
                icon={Receipt}
                label="Revenue this month"
                value={data?.revenueThisMonthNpr ?? 0}
                format={(n) => formatNpr(Math.round(n))}
                href="/admin/payments"
                loading={loading}
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <ListingBreakdown listings={data?.listings} loading={loading} />
              {isSuper && <RecentActivity />}
            </div>
            <div className="flex flex-col gap-6">
              <QuickActions role={user.role} />
              <Maintenance />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SectionTitle({ id, children, action }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold">
        {children}
      </h2>
      {action}
    </div>
  )
}

function Panel({ title, id, action, children, className }) {
  return (
    <GlowCard as="section" aria-labelledby={id} className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </GlowCard>
  )
}

function ReviewQueues({ pending, loading, showCounts }) {
  const total = pending ? QUEUE_ITEMS.reduce((sum, q) => sum + (pending[q.queue] ?? 0), 0) : 0

  return (
    <section aria-labelledby="queues" className="flex flex-col gap-4">
      <SectionTitle id="queues">Needs your attention</SectionTitle>
      {pending && total === 0 && (
        <p className="flex items-center gap-3 rounded-box border border-success bg-success/10 p-4 text-sm">
          <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-success" />
          All caught up. Nothing is waiting for review.
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {QUEUE_ITEMS.map(({ href, label, icon: Icon, queue }) => {
          const count = pending?.[queue] ?? 0
          return (
            <li key={href}>
              <GlowCard
                as={Link}
                href={href}
                tone={count > 0 ? 'warning' : 'brand'}
                className={clsx('group h-full', count > 0 && 'bg-warning')}
                bodyClassName="gap-3 p-4"
              >
                <span className="flex items-center justify-between">
                  <span
                    className={clsx(
                      'grid size-9 place-content-center rounded-box',
                      count > 0 ? 'bg-warning/15 text-warning' : 'bg-brand/10 text-brand',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5"
                  />
                </span>
                <span>
                  {showCounts &&
                    (loading ? (
                      <Skeleton className="mb-1 h-8 w-10" />
                    ) : (
                      <span className="block text-2xl font-semibold">
                        <AnimatedNumber value={count} />
                      </span>
                    ))}
                  <span className="block text-sm text-text-muted">{label}</span>
                </span>
              </GlowCard>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function MetricCard({ icon: Icon, label, value, format, href, loading }) {
  return (
    <GlowCard as={Link} href={href} bodyClassName="flex-row items-center gap-4 p-5">
      <span className="grid size-11 shrink-0 place-content-center rounded-box bg-brand/10 text-brand">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-text-muted">{label}</span>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-20" />
        ) : (
          <span className="block truncate text-2xl font-semibold">
            <AnimatedNumber value={value} format={format} />
          </span>
        )}
      </span>
    </GlowCard>
  )
}

function ListingBreakdown({ listings, loading }) {
  const total = LISTING_STATUSES.reduce((sum, s) => sum + (listings?.[s.key] ?? 0), 0)

  return (
    <Panel
      id="listing-status"
      title="Listings by status"
      action={
        <Link href="/admin/listings" className="text-sm font-semibold text-brand hover:underline">
          View all
        </Link>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          {LISTING_STATUSES.map((s) => (
            <Skeleton key={s.key} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {LISTING_STATUSES.map((s) => {
            const count = listings?.[s.key] ?? 0
            const percent = total ? Math.round((count / total) * 100) : 0
            return (
              <li key={s.key}>
                <Link
                  href={`/admin/listings?status=${s.key}`}
                  className="block rounded-box hover:opacity-80"
                >
                  <span className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-text-muted">{s.label}</span>
                    <span className="font-semibold">
                      {count}
                      <span className="ml-2 font-normal text-text-muted">{percent}%</span>
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="block h-2 overflow-hidden rounded-pill bg-surface-raised"
                  >
                    <span
                      className={clsx('block h-full rounded-pill', s.bar)}
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {!loading && (
        <p className="mt-4 border-t border-border pt-3 text-sm text-text-muted">
          {total} listings in the directory
        </p>
      )}
    </Panel>
  )
}

function RecentActivity() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['admin', 'audit', 'recent'],
    queryFn: () => audit.list({ limit: 6 }),
  })
  const rows = data?.data ?? []

  return (
    <Panel
      id="activity"
      title="Recent activity"
      action={
        <Link href="/admin/audit" className="text-sm font-semibold text-brand hover:underline">
          Audit log
        </Link>
      }
    >
      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-danger" role="alert">
          Could not load recent activity.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted">No changes recorded yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="grid size-8 shrink-0 place-content-center rounded-pill bg-surface-raised text-xs font-semibold text-text-muted uppercase">
                {(entry.actor?.email ?? 'S')[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  <span className="font-semibold">{entry.action}</span>{' '}
                  <span className="text-text-muted">on {entry.entity}</span>
                </span>
                <span className="block truncate text-xs text-text-muted">
                  {entry.actor?.email ?? 'System'}
                </span>
              </span>
              <time dateTime={entry.createdAt} className="shrink-0 text-xs text-text-muted">
                {timeAgo(entry.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function QuickActions({ role }) {
  const actions = QUICK_ACTIONS.filter((a) => canSee(role, a.min))
  return (
    <Panel id="quick-actions" title="Quick actions">
      <ul className="-mx-2 flex flex-col">
        {actions.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex min-h-11 items-center gap-3 rounded-box px-2 text-sm hover:bg-surface-raised"
            >
              <Icon aria-hidden="true" className="size-4 text-text-muted group-hover:text-brand" />
              <span className="flex-1">{label}</span>
              <ArrowRight aria-hidden="true" className="size-4 text-text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Maintenance() {
  const toast = useToast()
  const purge = useMutation({
    mutationFn: () => purgeCache({ all: true }),
    onSuccess: () => toast('Cache cleared; pages will refresh shortly.'),
    onError: (err) => toast(errorMessage(err), 'error'),
  })
  return (
    <Panel id="maintenance" title="Maintenance">
      <p className="mb-4 text-sm text-text-muted">
        Public pages are cached. Clear the cache if a change is not showing on the site.
      </p>
      <Button
        variant="secondary"
        fullWidth
        onClick={() => purge.mutate()}
        loading={purge.isPending}
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        Clear site cache
      </Button>
    </Panel>
  )
}
