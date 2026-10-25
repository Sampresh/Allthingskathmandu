'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { canSee } from '@/components/admin/AdminShell'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Button } from '@/components/ui/Button'
import { StatTile } from '@/components/ui/StatTile'
import { formatNpr } from '@/lib/format'
import { overview, purgeCache } from '@/services/admin.service'
import { useAuthStore } from '@/store/authStore'

export default function AdminHome() {
  const user = useAuthStore((s) => s.user)
  const toast = useToast()
  const isAdmin = canSee(user.role, 'ADMIN')
  const { data, isError, refetch } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: overview,
    enabled: isAdmin,
  })
  const purge = useMutation({
    mutationFn: () => purgeCache({ all: true }),
    onSuccess: () => toast('Cache cleared; pages will refresh shortly.'),
    onError: (err) => toast(errorMessage(err), 'error'),
  })

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <section aria-labelledby="queues" className="flex flex-col gap-3">
        <h2 id="queues" className="text-lg font-semibold">
          Waiting for review
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="Claims" value={data?.pending.claims ?? '—'} href="/admin/claims" />
          <StatTile label="Reviews" value={data?.pending.reviews ?? '—'} href="/admin/reviews" />
          <StatTile label="Reports" value={data?.pending.reports ?? '—'} href="/admin/reports" />
          <StatTile label="Events" value={data?.pending.events ?? '—'} href="/admin/events" />
          <StatTile label="Market items" value={data?.pending.market ?? '—'} href="/admin/market" />
        </div>
      </section>

      {isAdmin && (
        <section aria-labelledby="site" className="flex flex-col gap-3">
          <h2 id="site" className="text-lg font-semibold">
            Site
          </h2>
          {isError ? (
            <p className="text-danger" role="alert">
              Could not load the numbers.{' '}
              <button type="button" className="underline" onClick={() => refetch()}>
                Try again
              </button>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile
                label="Live listings"
                value={data?.listings.LIVE ?? 0}
                href="/admin/listings?status=LIVE"
              />
              <StatTile
                label="Drafts"
                value={data?.listings.DRAFT ?? 0}
                href="/admin/listings?status=DRAFT"
              />
              <StatTile label="Users" value={data?.users ?? '—'} href="/admin/users" />
              <StatTile
                label="Revenue this month"
                value={data ? formatNpr(data.revenueThisMonthNpr) : '—'}
                href="/admin/payments"
              />
            </div>
          )}
          <div>
            <Button variant="secondary" onClick={() => purge.mutate()} loading={purge.isPending}>
              Clear site cache
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
