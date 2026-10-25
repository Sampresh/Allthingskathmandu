import Link from 'next/link'
import { BadgeCheck, MapPin } from 'lucide-react'
import { T } from '@/components/common/T'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Rating } from '@/components/ui/Rating'
import { formatDistance, listingHref, telHref, whatsappHref } from '@/lib/format'
import { OpenStatus } from './OpenStatus'
import { TrackedLink } from './TrackedLink'

// One main action per card (Part 4 §4): Download for apps, otherwise Call.
function mainAction(card) {
  const { contact } = card
  if (card.type === 'APP') {
    const url = contact.playStoreUrl ?? contact.appStoreUrl
    return url && { href: url, kind: 'website', label: 'listing.download', external: true }
  }
  if (contact.phone)
    return { href: telHref(contact.phone), kind: 'call', label: 'listing.call', external: false }
  if (contact.whatsapp) {
    return {
      href: whatsappHref(contact.whatsapp),
      kind: 'whatsapp',
      label: 'listing.whatsapp',
      external: true,
    }
  }
  if (contact.website)
    return { href: contact.website, kind: 'website', label: 'listing.website', external: true }
  return null
}

/** Logo, name, one line, area and distance, open now, one button, Featured label. */
export function ListingCard({ card, priority = false, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`
  const action = mainAction(card)
  const distance = formatDistance(card.distanceMeters)

  return (
    <article className="relative flex gap-3 rounded-box border border-border bg-surface p-4">
      <Avatar src={card.logoUrl} name={card.name} size={56} priority={priority} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Heading className="text-base font-semibold">
            {/* Stretched link: the whole card opens the listing; the action button stays separate. */}
            <Link href={listingHref(card.slug)} className="after:absolute after:inset-0">
              <T en={card.name} ne={card.nameNe} />
            </Link>
          </Heading>
          {card.isVerified && (
            <span className="inline-flex text-brand">
              <BadgeCheck aria-hidden="true" className="size-4" />
              <span className="sr-only">
                <T k="listing.verified" />
              </span>
            </span>
          )}
          {card.featured && (
            <Badge tone="featured">
              <T k="listing.featured" />
            </Badge>
          )}
        </div>
        <p className="line-clamp-2 text-sm text-text-muted">{card.shortDesc}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
          {(card.area || distance) && (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="size-4" />
              {card.area && <T en={card.area.nameEn} ne={card.area.nameNe} />}
              {card.area && distance && ' · '}
              {distance}
            </span>
          )}
          <Rating value={card.rating.average} count={card.rating.count} />
          <OpenStatus hours={card.hours} initial={card.openNow} />
        </div>
      </div>
      {action && (
        <TrackedLink
          businessId={card.id}
          kind={action.kind}
          href={action.href}
          external={action.external}
          className="relative z-10 inline-flex min-h-11 items-center self-center rounded-box border border-brand px-3 text-sm font-semibold text-brand hover:bg-surface-raised"
        >
          <T k={action.label} />
        </TrackedLink>
      )}
    </article>
  )
}

export function CardGrid({ cards, priorityCount = 2, headingLevel = 3 }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {cards.map((card, i) => (
        <li key={card.id}>
          <ListingCard card={card} priority={i < priorityCount} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  )
}
