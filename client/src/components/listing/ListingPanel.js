'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Globe, MapPin, MessageCircle, Navigation, Phone, X } from 'lucide-react'
import { clsx } from 'clsx'
import { T } from '@/components/common/T'
import { CloudImage } from '@/components/ui/CloudImage'
import { Skeleton } from '@/components/ui/Skeleton'
import { mainAction } from '@/lib/cardAction'
import { directionsHref, listingHref, priceLevelText, telHref, whatsappHref } from '@/lib/format'
import { HoursTable } from './HoursTable'
import { ListingLogo, tintFor } from './ListingLogo'
import { OpenStatus } from './OpenStatus'
import { ReviewList } from './ReviewList'
import { SaveButton } from './SaveButton'
import { TrackView } from './TrackView'
import { TrackedLink } from './TrackedLink'

const TABS = [
  { key: 'overview', en: 'Overview', ne: 'सारांश' },
  { key: 'reviews', en: 'Reviews', ne: 'समीक्षा' },
  { key: 'details', en: 'Details', ne: 'विवरण' },
]

const pill =
  'inline-flex min-h-11 items-center gap-2 rounded-pill border border-border px-4 text-sm font-semibold hover:bg-surface-raised'

function Tile({ label, value }) {
  return (
    <div className="flex flex-col gap-1 rounded-box bg-surface p-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  )
}

function Reviews({ slug }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['listing-reviews', slug],
    queryFn: async () => (await import('@/services/public.service')).getListingReviews(slug),
  })
  if (isPending) return <Skeleton className="h-24 w-full" />
  if (isError)
    return (
      <p className="text-danger" role="alert">
        <T k="error.body" />
      </p>
    )
  return <ReviewList slug={slug} initialItems={data.data} initialCursor={data.meta.nextCursor} />
}

function Contacts({ listing }) {
  const { contact } = listing
  const row = 'flex min-h-11 items-center gap-3 text-sm hover:text-brand'
  return (
    <ul className="flex flex-col">
      {contact.phone && (
        <li>
          <TrackedLink
            businessId={listing.id}
            kind="call"
            href={telHref(contact.phone)}
            external={false}
            className={row}
          >
            <Phone aria-hidden="true" className="size-4 shrink-0" />
            {contact.phone}
          </TrackedLink>
        </li>
      )}
      {contact.whatsapp && (
        <li>
          <TrackedLink
            businessId={listing.id}
            kind="whatsapp"
            href={whatsappHref(contact.whatsapp)}
            className={row}
          >
            <MessageCircle aria-hidden="true" className="size-4 shrink-0" />
            <T k="listing.whatsapp" />
          </TrackedLink>
        </li>
      )}
      {contact.website && (
        <li>
          <TrackedLink
            businessId={listing.id}
            kind="website"
            href={contact.website}
            className={row}
          >
            <Globe aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{contact.website.replace(/^https?:\/\//, '')}</span>
          </TrackedLink>
        </li>
      )}
    </ul>
  )
}

/**
 * Side panel for one listing on wide results pages, next to the cards. Loaded on first open.
 * `card` paints straight away; the full listing fills in the description and contacts.
 */
export default function ListingPanel({ card, onClose }) {
  const [tab, setTab] = useState('overview')
  const closeRef = useRef(null)
  const { data: listing, isError } = useQuery({
    queryKey: ['listing', card.slug],
    queryFn: async () => (await import('@/services/public.service')).getListing(card.slug),
  })

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [card.id, onClose])

  const tintKey = card.category?.slug ?? card.name
  const tint = tintFor(tintKey)
  const photo = listing?.media.find((m) => m.type === 'PHOTO')?.url ?? card.photoUrl
  const about = listing?.description || listing?.shortDesc || card.shortDesc
  const action = mainAction(card)
  const hasDirections =
    listing &&
    listing.type !== 'APP' &&
    listing.type !== 'HOTLINE' &&
    (listing.location || listing.address)
  const place = listing?.address || (card.area && <T en={card.area.nameEn} ne={card.area.nameNe} />)

  return (
    <aside aria-labelledby="panel-title" className="browse-panel">
      <TrackView businessId={card.id} />
      <div
        className="relative flex h-52 items-center justify-center overflow-hidden rounded-panel"
        style={{ background: `var(--tint-${tint}-bg)`, color: `var(--tint-${tint}-fg)` }}
      >
        {photo ? (
          <CloudImage
            src={photo}
            alt=""
            width={480}
            height={320}
            sizes="384px"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <ListingLogo name={card.name} logoUrl={card.logoUrl} tintKey={tintKey} size={96} />
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-pill bg-surface text-text shadow-card"
        >
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">
            <T k="common.close" />
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasDirections && (
          <TrackedLink
            businessId={card.id}
            kind="map"
            href={directionsHref(listing)}
            className={pill}
          >
            <Navigation aria-hidden="true" className="size-4" />
            <T en="Directions" ne="दिशा" />
          </TrackedLink>
        )}
        <SaveButton businessId={card.id} slug={card.slug} />
      </div>

      <div
        role="tablist"
        aria-label={card.name}
        className="grid grid-cols-3 overflow-hidden rounded-pill border border-border"
      >
        {TABS.map(({ key, en, ne }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={clsx(
              'min-h-11 text-sm font-semibold',
              tab === key ? 'bg-text text-surface' : 'hover:bg-surface-raised',
            )}
          >
            <T en={en} ne={ne} />
          </button>
        ))}
      </div>

      <div role="tabpanel" className="flex flex-col gap-3">
        <h2 id="panel-title" className="text-xl font-semibold">
          <T en={card.name} ne={card.nameNe} />
        </h2>
        {isError && (
          <p className="text-danger" role="alert">
            <T k="error.body" />
          </p>
        )}
        {tab === 'overview' && (
          <>
            {card.hours && <OpenStatus hours={card.hours} initial={card.openState} />}
            {about ? (
              <p className="whitespace-pre-line text-text-muted">{about}</p>
            ) : (
              !listing && !isError && <Skeleton className="h-16 w-full" />
            )}
            <Link href={listingHref(card.slug)} prefetch={false} className={`${pill} self-start`}>
              <T en="View full page" ne="पूरा पृष्ठ हेर्नुहोस्" />
            </Link>
          </>
        )}
        {tab === 'reviews' && <Reviews slug={card.slug} />}
        {tab === 'details' &&
          (listing ? (
            <>
              <Contacts listing={listing} />
              {listing.hours && <HoursTable hours={listing.hours} />}
            </>
          ) : (
            !isError && <Skeleton className="h-24 w-full" />
          ))}
      </div>

      <div className="flex flex-col gap-3 rounded-panel bg-surface-raised p-3">
        {place && (
          <p className="flex items-start gap-2 px-1 text-sm">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{place}</span>
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Tile
            label={<T k="filters.rating" />}
            value={card.rating.count ? card.rating.average.toFixed(1) : '–'}
          />
          <Tile label={<T en="Reviews" ne="समीक्षा" />} value={card.rating.count} />
          <Tile
            label={<T k="filters.price" />}
            value={card.priceLevel ? priceLevelText(card.priceLevel) : '–'}
          />
        </div>
      </div>

      {action && (
        <TrackedLink
          businessId={card.id}
          kind={action.kind}
          href={action.href}
          external={!action.internal}
          className="inline-flex min-h-11 items-center gap-3 self-start rounded-pill bg-text py-1 pr-1 pl-5 text-sm font-semibold text-surface hover:opacity-90"
        >
          <T k={action.label} />
          <span className="inline-flex size-9 items-center justify-center rounded-pill bg-surface text-text">
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </TrackedLink>
      )}
    </aside>
  )
}
