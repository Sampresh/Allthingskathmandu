import Link from 'next/link'
import { BadgeCheck, MapPin } from 'lucide-react'
import { T } from '@/components/common/T'
import { Rating } from '@/components/ui/Rating'
import { mainAction } from '@/lib/cardAction'
import { formatDistance, listingHref } from '@/lib/format'
import { ListingLogo } from './ListingLogo'
import { OpenStatus } from './OpenStatus'
import { TrackedLink } from './TrackedLink'

/**
 * Listing card: logo (or category-tinted monogram), name, verified badge, one line, area and
 * distance, open status with the next change, and one main action. Featured cards say so.
 */
export function ListingCard({ card, priority = false, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`
  const action = mainAction(card)
  const distance = formatDistance(card.distanceMeters)
  const hasRating = card.rating.count > 0

  return (
    <article
      className={card.featured ? 'group lcard border-featured/50' : 'group lcard border-border'}
    >
      {card.featured && (
        <span className="lcard-flag">
          <T k="listing.featured" />
        </span>
      )}
      <div className="flex gap-3">
        <ListingLogo
          name={card.name}
          logoUrl={card.logoUrl}
          tintKey={card.category?.slug}
          size={56}
          priority={priority}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Heading className="lcard-title">
            {/* Stretched link: the whole card opens the listing; the action stays separate. */}
            <Link href={listingHref(card.slug)} className="lcard-link">
              <T en={card.name} ne={card.nameNe} />
            </Link>
            {card.isVerified && (
              <span className="mt-0.5 inline-flex shrink-0 text-brand">
                <BadgeCheck aria-hidden="true" className="size-4" />
                <span className="sr-only">
                  <T k="listing.verified" />
                </span>
              </span>
            )}
          </Heading>
          {card.shortDesc && (
            <p className="line-clamp-2 text-sm text-text-muted">{card.shortDesc}</p>
          )}
          {(card.area || distance || hasRating) && (
            <p className="lcard-meta">
              {(card.area || distance) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  {card.area && <T en={card.area.nameEn} ne={card.area.nameNe} />}
                  {card.area && distance && ' · '}
                  {distance}
                </span>
              )}
              {hasRating && <Rating value={card.rating.average} count={card.rating.count} />}
            </p>
          )}
        </div>
      </div>
      {(card.hours || action) && (
        <div className="lcard-foot">
          <OpenStatus hours={card.hours} initial={card.openState} />
          {action && (
            <TrackedLink
              businessId={card.id}
              kind={action.kind}
              href={action.href}
              external={!action.internal}
              className={action.number ? 'lcard-act lcard-act-sos' : 'lcard-act'}
            >
              {action.number ? (
                <>
                  <T k="listing.call" /> {action.number}
                </>
              ) : (
                <T k={action.label} />
              )}
            </TrackedLink>
          )}
        </div>
      )}
    </article>
  )
}

export function CardGrid({ cards, priorityCount = 2, headingLevel = 3 }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <li key={card.id}>
          <ListingCard card={card} priority={i < priorityCount} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  )
}
