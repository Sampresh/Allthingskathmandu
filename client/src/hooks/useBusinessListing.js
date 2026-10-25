'use client'

import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { myListings } from '@/services/business.service'

/** The owner's listings and the one picked with ?listing= (first one by default). */
export function useBusinessListing() {
  const params = useSearchParams()
  const query = useQuery({ queryKey: ['business', 'listings'], queryFn: myListings })
  const listings = query.data ?? []
  const requested = params.get('listing')
  const current = listings.find((l) => l.id === requested) ?? listings[0] ?? null
  return { listings, current, listingId: current?.id ?? null, query }
}

/** Link within the portal that keeps the selected listing. */
export const withListing = (path, listingId) => (listingId ? `${path}?listing=${listingId}` : path)
