'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { MemberOnboarding } from '@/components/business/MemberOnboarding'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatTile } from '@/components/ui/StatTile'
import { useBusinessListing, withListing } from '@/hooks/useBusinessListing'
import { formatDate } from '@/lib/format'
import { getStats } from '@/services/business.service'
import { useAuthStore } from '@/store/authStore'

const STATUS_HELP = {
  LIVE: ['success', 'Live on the site'],
  PENDING: ['neutral', 'Waiting for review'],
  DRAFT: ['neutral', 'Not published yet'],
  SUSPENDED: ['danger', 'Suspended; contact us'],
}

function Activity({ listingId }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['business', 'stats', listingId],
    queryFn: () => getStats(listingId),
  })
  if (isPending) return <Skeleton className="h-28 w-full" />
  if (isError) return <p className="text-danger">Could not load activity.</p>
  const { totals, days } = data
  return (
    <section aria-labelledby="activity" className="flex flex-col gap-3">
      <h2 id="activity" className="text-lg font-semibold">
        Last 30 days
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Views" value={totals.views} />
        <StatTile label="Calls" value={totals.calls} />
        <StatTile label="WhatsApp" value={totals.whatsapp} />
        <StatTile label="Directions" value={totals.mapClicks} />
        <StatTile label="Website" value={totals.websiteClicks} />
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-brand">Day by day</summary>
        <div className="mt-2 max-h-96 overflow-auto rounded-box border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Activity per day</caption>
            <thead className="sticky top-0 bg-surface-raised text-left">
              <tr>
                {['Day', 'Views', 'Calls', 'WhatsApp', 'Directions', 'Website'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <th scope="row" className="px-3 py-1 text-left font-normal">
                    {formatDate(d.date)}
                  </th>
                  <td className="px-3 py-1">{d.views}</td>
                  <td className="px-3 py-1">{d.calls}</td>
                  <td className="px-3 py-1">{d.whatsapp}</td>
                  <td className="px-3 py-1">{d.mapClicks}</td>
                  <td className="px-3 py-1">{d.websiteClicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { current, query } = useBusinessListing()
  if (user.role !== 'BUSINESS_OWNER') return <MemberOnboarding />
  if (query.isPending) return <Skeleton className="h-60 w-full" />
  if (!current) return <MemberOnboarding />

  const [tone, help] = STATUS_HELP[current.status]
  const featured = current.featuredUntil && new Date(current.featuredUntil) > new Date()
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{current.name}</h1>
        <Badge tone={tone}>{help}</Badge>
        {featured && (
          <Badge tone="featured">Featured until {formatDate(current.featuredUntil)}</Badge>
        )}
        {current.status === 'LIVE' && (
          <Link
            href={`/listing/${current.slug}`}
            className="text-sm font-semibold text-brand underline"
          >
            View on site
          </Link>
        )}
      </div>
      <Activity listingId={current.id} />
      {!featured && (
        <p className="rounded-box border border-featured p-4">
          Get photos, videos, offers and top placement with the Featured plan.{' '}
          <Link
            href={withListing('/business/plan', current.id)}
            className="font-semibold text-brand underline"
          >
            See plans
          </Link>
        </p>
      )}
    </div>
  )
}
