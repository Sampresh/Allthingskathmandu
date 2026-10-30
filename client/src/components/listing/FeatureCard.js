'use client'

import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { clsx } from 'clsx'
import { T } from '@/components/common/T'
import { CloudImage } from '@/components/ui/CloudImage'
import { Rating } from '@/components/ui/Rating'
import { mainAction } from '@/lib/cardAction'
import { formatDistance, listingHref, priceLevelText } from '@/lib/format'
import { ListingLogo, tintFor } from './ListingLogo'
import { OpenStatus } from './OpenStatus'
import { TrackedLink } from './TrackedLink'

const STAGGER_STEPS = 8
// The detail panel only fits beside the results on wide screens; elsewhere links just navigate.
const PANEL_MEDIA = '(min-width: 80rem)'

/**
 * Listing card with a tinted panel: the Featured photo, else the logo or a large monogram.
 * The whole card opens the listing. Home shows name, area and status; `results` adds price,
 * rating and the one main action. With `onOpen`, wide screens open the side panel instead.
 * Styled in globals.css (`.fcard*`), with CSS motion only: public pages have no room in their
 * JS budget for an animation library.
 */
export function FeatureCard({
  card,
  index = 0,
  results = false,
  headingLevel = 3,
  onOpen,
  selected,
}) {
  const Heading = `h${headingLevel}`
  const tintKey = card.category?.slug ?? card.name
  const tint = tintFor(tintKey)
  const action = results ? mainAction(card) : null
  const distance = results ? formatDistance(card.distanceMeters) : null

  const open = (event) => {
    if (!onOpen || event.metaKey || event.ctrlKey || event.shiftKey) return
    if (!window.matchMedia(PANEL_MEDIA).matches) return
    event.preventDefault()
    onOpen(card)
  }

  return (
    <article
      className={clsx('fcard group', selected && 'fcard-selected')}
      style={{ '--i': index % STAGGER_STEPS }}
    >
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
        {card.photoUrl ? (
          <CloudImage
            src={card.photoUrl}
            alt=""
            width={480}
            height={320}
            widths={[320, 480, 720]}
            sizes="(min-width: 640px) 320px, 100vw"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <ListingLogo name={card.name} logoUrl={card.logoUrl} tintKey={tintKey} size={80} />
        )}
      </div>
      <div className="fcard-body">
        <div className="flex items-start justify-between gap-2">
          <Heading className={results ? 'fcard-title text-base' : 'fcard-title'}>
            <Link
              id={`card-${card.id}`}
              href={listingHref(card.slug)}
              prefetch={false}
              onClick={open}
              className="lcard-link"
            >
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
          </Heading>
          {results
            ? card.priceLevel && (
                <p className="shrink-0 pt-0.5 text-sm font-semibold">
                  {priceLevelText(card.priceLevel)}
                </p>
              )
            : card.area && (
                <p className="shrink-0 pt-0.5 text-xs text-text-muted">
                  <T en={card.area.nameEn} ne={card.area.nameNe} />
                </p>
              )}
        </div>
        {card.hours && <OpenStatus hours={card.hours} initial={card.openState} />}
        {results && card.rating.count > 0 && (
          <Rating value={card.rating.average} count={card.rating.count} />
        )}
        {results && (card.area || distance || action) && (
          <div className="fcard-foot">
            <p className="min-w-0 truncate text-sm text-text-muted">
              {card.area && <T en={card.area.nameEn} ne={card.area.nameNe} />}
              {card.area && distance && ' · '}
              {distance}
            </p>
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
      </div>
    </article>
  )
}

export function FeatureGrid({ cards, results = false, className, ...cardProps }) {
  const { selectedId, ...rest } = cardProps
  const columns = results
    ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
    : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  return (
    <ul className={clsx('grid gap-4', columns, className)}>
      {cards.map((card, i) => (
        <li key={card.id}>
          <FeatureCard
            card={card}
            index={i}
            results={results}
            selected={card.id === selectedId}
            {...rest}
          />
        </li>
      ))}
    </ul>
  )
}
