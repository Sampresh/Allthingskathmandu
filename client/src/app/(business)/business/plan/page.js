'use client'

import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useBusinessListing } from '@/hooks/useBusinessListing'
import { formatDate, formatNpr } from '@/lib/format'
import { getSubscription, publicPlans } from '@/services/business.service'

const includes = (f) =>
  [
    f.featured && 'Top placement in your category',
    f.homepage && 'Homepage spot',
    f.maxPhotos > 0 && `${f.maxPhotos} photos`,
    f.maxVideos > 0 && `${f.maxVideos} videos`,
    f.featured && 'Offers',
  ].filter(Boolean)

export default function PlanPage() {
  const { listingId } = useBusinessListing()
  const { data: sub, isPending } = useQuery({
    queryKey: ['business', 'subscription', listingId],
    queryFn: () => getSubscription(listingId),
    enabled: Boolean(listingId),
  })
  const { data: plans } = useQuery({ queryKey: ['public', 'plans'], queryFn: publicPlans })
  if (isPending) return <Skeleton className="h-60 w-full" />

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">Plan & billing</h1>
      <section className="flex flex-col gap-2 rounded-box border border-border p-4">
        <h2 className="text-lg font-semibold">Current plan</h2>
        {sub.current ? (
          <p>
            <strong>{sub.current.plan.name}</strong> until {formatDate(sub.current.endsAt)}
          </p>
        ) : (
          <p>Basic (free): name, logo, description, map, contact buttons.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Plans</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {plans?.map((p) => (
            <li key={p.code} className="flex flex-col gap-2 rounded-box border border-border p-4">
              <p className="font-semibold">{p.name}</p>
              <p className="text-xl font-semibold">
                {p.priceNpr ? `${formatNpr(p.priceNpr)} / ${p.durationDays} days` : 'Free'}
              </p>
              <ul className="list-disc pl-5 text-sm">
                {includes(p.features).map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {p.code === 'BASIC' && <li>Listing with contact buttons and map</li>}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {sub.history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">History</h2>
          <ul className="flex flex-col gap-2">
            {sub.history.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-box border border-border p-3 text-sm"
              >
                <span>
                  {s.plan.name}{' '}
                  {s.startsAt && `· ${formatDate(s.startsAt)} – ${formatDate(s.endsAt)}`}
                </span>
                <Badge tone={s.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {s.status.toLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
