'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Eye, Globe, MessageCircle, Navigation, Phone } from 'lucide-react'
import { MemberOnboarding } from '@/components/business/MemberOnboarding'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { GlowCard } from '@/components/ui/GlowCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { MiniBars, TrendChart } from '@/components/ui/TrendChart'
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

// The four ways people get in touch from a listing page, each with its own glow colour.
const TAPS = [
  { key: 'calls', label: 'Calls', icon: Phone, tone: 'success' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, tone: 'success' },
  { key: 'mapClicks', label: 'Directions', icon: Navigation, tone: 'warning' },
  { key: 'websiteClicks', label: 'Website', icon: Globe, tone: 'featured' },
]
const TONE_TEXT = { success: 'text-success', warning: 'text-warning', featured: 'text-featured' }
const TREND_DAYS = 14

function Activity({ listingId }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['business', 'stats', listingId],
    queryFn: () => getStats(listingId),
  })
  if (isPending) return <Skeleton className="h-96 w-full" />
  if (isError) return <p className="text-danger">Could not load activity.</p>
  const { totals, days } = data
  const recent = days.slice(-TREND_DAYS)
  return (
    <section aria-labelledby="activity" className="flex flex-col gap-3">
      <h2 id="activity" className="text-lg font-semibold">
        Last 30 days
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlowCard className="min-h-80 sm:col-span-2 lg:row-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-muted">
              <Eye aria-hidden="true" className="size-4" />
              Views
            </h3>
            <span className="text-xs text-text-muted">
              Best day {Math.max(...days.map((d) => d.views)).toLocaleString('en-US')}
            </span>
          </div>
          <p className="mb-4 text-3xl font-semibold">
            <AnimatedNumber value={totals.views} />
          </p>
          <TrendChart
            name="Views"
            className="text-brand"
            points={days.map((d) => ({ label: formatDate(d.date), value: d.views }))}
          />
          <p className="mt-2 flex justify-between text-xs text-text-muted">
            <span>{formatDate(days[0].date)}</span>
            <span>Today</span>
          </p>
        </GlowCard>
        {TAPS.map(({ key, label, icon: Icon, tone }) => (
          <GlowCard key={key} tone={tone} className="min-h-40">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-muted">
              <Icon aria-hidden="true" className={`size-4 ${TONE_TEXT[tone]}`} />
              {label}
            </h3>
            <p className="text-3xl font-semibold">
              <AnimatedNumber value={totals[key]} />
            </p>
            <MiniBars
              values={recent.map((d) => d[key])}
              className={`mt-auto pt-3 ${TONE_TEXT[tone]}`}
            />
          </GlowCard>
        ))}
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
