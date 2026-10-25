import { listingHref } from '@/lib/format'

/** Map pins for cards that have a location. */
export const toMapPoints = (cards) =>
  cards
    .filter((c) => c.location)
    .map((c) => ({ id: c.id, label: c.name, href: listingHref(c.slug), ...c.location }))
