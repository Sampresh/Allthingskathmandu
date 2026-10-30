import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { T } from '@/components/common/T'
import { listingHref } from '@/lib/format'
import { ListingLogo, tintFor } from './ListingLogo'
import { OpenStatus } from './OpenStatus'

/**
 * Home page card: a tinted panel with the logo (or a large monogram) above the name and area.
 * The whole card opens the listing. Styled in globals.css (`.fcard*`), with CSS motion only:
 * home has no room in its JS budget for an animation library.
 */
export function FeatureCard({ card, index = 0 }) {
  const tintKey = card.category?.slug ?? card.name
  const tint = tintFor(tintKey)

  return (
    <article className="fcard group" style={{ '--i': index }}>
      <div
        className="fcard-panel"
        style={{ background: `var(--tint-${tint}-bg)`, color: `var(--tint-${tint}-fg)` }}
      >
        {card.category && (
          <span className="fcard-tag">
            <T en={card.category.nameEn} ne={card.category.nameNe} />
          </span>
        )}
        {card.featured && (
          <span className="lcard-flag">
            <T k="listing.featured" />
          </span>
        )}
        <ListingLogo name={card.name} logoUrl={card.logoUrl} tintKey={tintKey} size={80} />
      </div>
      <div className="fcard-body">
        <div className="flex items-start justify-between gap-2">
          <h3 className="fcard-title">
            <Link href={listingHref(card.slug)} prefetch={false} className="lcard-link">
              <T en={card.name} ne={card.nameNe} />
            </Link>
            {card.isVerified && (
              <span className="ml-1 inline-flex align-text-bottom text-brand">
                <BadgeCheck aria-hidden="true" className="size-4" />
                <span className="sr-only">
                  <T k="listing.verified" />
                </span>
              </span>
            )}
          </h3>
          {card.area && (
            <p className="shrink-0 pt-0.5 text-xs text-text-muted">
              <T en={card.area.nameEn} ne={card.area.nameNe} />
            </p>
          )}
        </div>
        {card.hours && <OpenStatus hours={card.hours} initial={card.openState} />}
      </div>
    </article>
  )
}

export function FeatureGrid({ cards }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {cards.map((card, i) => (
        <li key={card.id}>
          <FeatureCard card={card} index={i} />
        </li>
      ))}
    </ul>
  )
}
