import { SITE_NAME, SITE_URL } from './site'

export const absoluteUrl = (path) => new URL(path, SITE_URL).toString()

/** Metadata with canonical URL and Open Graph for a public page. */
export function pageMetadata({ title, description, path, image, noindex = false }) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_NP',
      ...(image && { images: [{ url: image }] }),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
    ...(noindex && { robots: { index: false, follow: true } }),
  }
}

const DAY_SCHEMA = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

/** schema.org LocalBusiness for a listing detail page. */
export function listingJsonLd(listing) {
  const hours = listing.hours
    ? Object.entries(listing.hours).flatMap(([day, slots]) =>
        (Array.isArray(slots) ? slots : []).map(([opens, closes]) => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: DAY_SCHEMA[day],
          opens,
          closes: closes === '24:00' ? '23:59' : closes,
        })),
      )
    : undefined
  return {
    '@context': 'https://schema.org',
    '@type': listing.type === 'PLACE' ? 'TouristAttraction' : 'LocalBusiness',
    name: listing.name,
    description: listing.description ?? listing.shortDesc,
    url: absoluteUrl(`/listing/${listing.slug}`),
    ...(listing.logoUrl && { image: listing.logoUrl }),
    ...(listing.contact.phone && { telephone: listing.contact.phone }),
    address: {
      '@type': 'PostalAddress',
      ...(listing.address && { streetAddress: listing.address }),
      ...(listing.area && { addressLocality: listing.area.nameEn }),
      addressCountry: 'NP',
    },
    ...(listing.location && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: listing.location.lat,
        longitude: listing.location.lng,
      },
    }),
    ...(hours?.length && { openingHoursSpecification: hours }),
    ...(listing.rating.count > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: listing.rating.average,
        reviewCount: listing.rating.count,
      },
    }),
  }
}

/** schema.org Event for an event detail page. */
export function eventJsonLd(event) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: event.startsAt,
    ...(event.endsAt && { endDate: event.endsAt }),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: absoluteUrl(`/events/${event.slug}`),
    ...(event.description && { description: event.description }),
    ...(event.coverUrl && { image: [event.coverUrl] }),
    location: {
      '@type': 'Place',
      name: event.venue ?? event.area?.nameEn ?? 'Kathmandu',
      address: {
        '@type': 'PostalAddress',
        addressLocality: event.area?.nameEn ?? 'Kathmandu',
        addressCountry: 'NP',
      },
      ...(event.location && {
        geo: {
          '@type': 'GeoCoordinates',
          latitude: event.location.lat,
          longitude: event.location.lng,
        },
      }),
    },
    ...(event.business && {
      organizer: {
        '@type': 'Organization',
        name: event.business.name,
        url: absoluteUrl(`/listing/${event.business.slug}`),
      },
    }),
    ...(event.ticketUrl && { offers: { '@type': 'Offer', url: event.ticketUrl } }),
  }
}
