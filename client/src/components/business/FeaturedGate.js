import Link from 'next/link'
import { withListing } from '@/hooks/useBusinessListing'

/** Shown instead of Featured-only tools when the listing has no active Featured plan. */
export function FeaturedGate({ listingId, what }) {
  return (
    <div className="flex flex-col gap-2 rounded-box border border-featured p-4">
      <p className="font-semibold">{what} come with the Featured plan.</p>
      <p className="text-sm text-text-muted">
        Featured listings also show at the top of their category and on the homepage.
      </p>
      <Link
        href={withListing('/business/plan', listingId)}
        className="font-semibold text-brand underline"
      >
        See plans
      </Link>
    </div>
  )
}
