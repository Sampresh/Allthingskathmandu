import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, Globe, MapPin, Phone, Smartphone, Star } from 'lucide-react'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { ST as T } from '@/components/common/ST'
import { ActionBar } from '@/components/listing/ActionBar'
import { HoursTable } from '@/components/listing/HoursTable'
import { ImageGallery } from '@/components/listing/ImageGallery'
import { ListingLogo } from '@/components/listing/ListingLogo'
import { CardGrid } from '@/components/listing/ListingCard'
import { OpenStatus } from '@/components/listing/OpenStatus'
import { ReportDialog } from '@/components/listing/ReportDialog'
import { ReviewList } from '@/components/listing/ReviewList'
import { SaveButton } from '@/components/listing/SaveButton'
import { TrackView } from '@/components/listing/TrackView'
import { VideoEmbed } from '@/components/listing/VideoEmbed'
import { WriteReview } from '@/components/listing/WriteReview'
import { LazyMap } from '@/components/map/LazyMap'
import { Rating } from '@/components/ui/Rating'
import { categoryHref, formatDate, priceLevelText, telHref } from '@/lib/format'
import { listingJsonLd, pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'
import { isSlug } from '@/lib/slug'

export const revalidate = 3600
export const generateStaticParams = async () => []

async function loadListing(slug) {
  if (!isSlug(slug)) return null
  return (await publicGet(`/listings/${slug}`, { tags: [`listing:${slug}`] }))?.data ?? null
}

export async function generateMetadata({ params }) {
  const listing = await loadListing((await params).slug)
  if (!listing) return {}
  const where = listing.area ? `, ${listing.area.nameEn}` : ''
  const meta = pageMetadata({
    title: listing.seoTitle ?? `${listing.name}${where}`,
    description: listing.seoDescription || listing.shortDesc || undefined,
    path: `/listing/${listing.slug}`,
  })
  // The share image comes from opengraph-image.js in this folder.
  return { ...meta, twitter: { ...meta.twitter, card: 'summary_large_image' } }
}

function Block({ titleKey, children, className }) {
  return (
    <section className={`flex flex-col gap-3 ${className ?? ''}`}>
      <h2 className="text-xl font-semibold">
        <T k={titleKey} />
      </h2>
      {children}
    </section>
  )
}

const TYPE_LABEL = {
  APP: { en: 'App', ne: 'एप', Icon: Smartphone },
  HOTLINE: { en: 'Hotline', ne: 'हटलाइन', Icon: Phone },
  PLACE: { en: 'Place', ne: 'स्थान', Icon: MapPin },
}

const chip =
  'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-semibold'
const panel = 'rounded-panel border border-border bg-surface p-5 shadow-card'

/** Strips the scheme for display: "https://foodmandu.com" → "foodmandu.com". */
const bareUrl = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '')

export default async function ListingPage({ params }) {
  const { slug } = await params
  const listing = await loadListing(slug)
  if (!listing) notFound()

  const [reviews, similar] = await Promise.all([
    publicGet(`/listings/${slug}/reviews`, { tags: [`listing:${slug}`] }),
    publicGet(`/listings/${slug}/similar`, { tags: [`listing:${slug}`] }),
  ])

  const photos = listing.media.filter((m) => m.type === 'PHOTO')
  const videos = listing.media.filter((m) => m.type === 'VIDEO')
  const category = listing.category
  const type = TYPE_LABEL[listing.type]
  const points = listing.location
    ? [{ id: listing.id, label: listing.name, ...listing.location }]
    : []
  const showLocation =
    (listing.address || listing.area || listing.location) &&
    !['APP', 'HOTLINE'].includes(listing.type)
  const areaHref =
    listing.area && category?.isPublic
      ? `${categoryHref(category)}?area=${listing.area.slug}`
      : undefined

  return (
    <article className="flex flex-col gap-8 pb-24 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(listingJsonLd(listing)).replace(/</g, '\\u003c'),
        }}
      />
      <TrackView businessId={listing.id} />

      {category?.groupSlug && (
        <Breadcrumbs
          items={[
            { href: '/', label: <T k="nav.home" /> },
            {
              href: `/${category.groupSlug}`,
              label: <T en={category.groupNameEn} ne={category.groupNameNe} />,
            },
            {
              // Categories under 5 live listings have no page yet.
              href: category.isPublic ? categoryHref(category) : undefined,
              label: <T en={category.nameEn} ne={category.nameNe} />,
            },
            ...(listing.area
              ? [{ href: areaHref, label: <T en={listing.area.nameEn} ne={listing.area.nameNe} /> }]
              : []),
          ]}
        />
      )}

      <header className={`${panel} flex flex-col gap-5 sm:p-7`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <ListingLogo
            name={listing.name}
            logoUrl={listing.logoUrl}
            tintKey={category?.slug}
            alt={listing.logoUrl ? `${listing.name} logo` : ''}
            size={96}
            priority
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {(type || listing.isVerified || listing.featured) && (
              <div className="flex flex-wrap gap-2">
                {listing.featured && (
                  <span className={`${chip} border-featured bg-featured text-surface`}>
                    <Star aria-hidden="true" className="size-3 fill-current" />
                    <T k="listing.featured" />
                  </span>
                )}
                {listing.isVerified && (
                  <span className={`${chip} border-brand text-brand`}>
                    <BadgeCheck aria-hidden="true" className="size-3.5" />
                    <T k="listing.verified" />
                  </span>
                )}
                {type && (
                  <span className={`${chip} border-border text-text-muted`}>
                    <type.Icon aria-hidden="true" className="size-3.5" />
                    <T en={type.en} ne={type.ne} />
                  </span>
                )}
              </div>
            )}
            <h1 className="text-3xl leading-tight font-semibold text-balance">
              <T en={listing.name} ne={listing.nameNe} />
            </h1>
            {listing.shortDesc && (
              <p className="max-w-2xl text-lg text-text-muted">{listing.shortDesc}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
              {category &&
                (category.isPublic ? (
                  <Link
                    href={categoryHref(category)}
                    className="font-semibold text-brand hover:underline"
                  >
                    <T en={category.nameEn} ne={category.nameNe} />
                  </Link>
                ) : (
                  <span className="font-semibold">
                    <T en={category.nameEn} ne={category.nameNe} />
                  </span>
                ))}
              {listing.area &&
                (areaHref ? (
                  <Link href={areaHref} className="inline-flex items-center gap-1 hover:underline">
                    <MapPin aria-hidden="true" className="size-4" />
                    <T en={listing.area.nameEn} ne={listing.area.nameNe} />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden="true" className="size-4" />
                    <T en={listing.area.nameEn} ne={listing.area.nameNe} />
                  </span>
                ))}
              {listing.priceLevel && (
                <span>
                  <span className="sr-only">
                    <T k="listing.priceLevel" />:{' '}
                  </span>
                  {priceLevelText(listing.priceLevel)}
                </span>
              )}
              {listing.rating.count > 0 && (
                <Rating value={listing.rating.average} count={listing.rating.count} />
              )}
            </div>
            <OpenStatus hours={listing.hours} initial={listing.openState} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:border-t sm:border-border sm:pt-5">
          <ActionBar listing={listing} />
          <SaveButton businessId={listing.id} slug={listing.slug} />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {listing.description && (
            <Block titleKey="listing.about">
              <p className="max-w-3xl text-lg leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </Block>
          )}

          {photos.length > 0 && (
            <Block titleKey="listing.photos">
              <ImageGallery photos={photos} title={listing.name} />
            </Block>
          )}

          {videos.length > 0 && (
            <Block titleKey="listing.videos">
              <div className="grid gap-4 md:grid-cols-2">
                {videos.map((v) => (
                  <VideoEmbed key={v.id} url={v.url} title={v.altText} />
                ))}
              </div>
            </Block>
          )}

          {listing.offers.length > 0 && (
            <Block titleKey="listing.offers">
              <ul className="grid gap-3 md:grid-cols-2">
                {listing.offers.map((offer) => (
                  <li
                    key={offer.id}
                    className="rounded-panel border border-featured/60 bg-surface p-4"
                  >
                    <h3 className="font-semibold">{offer.title}</h3>
                    {offer.body && <p className="text-text-muted">{offer.body}</p>}
                    <p className="mt-1 text-sm text-text-muted">
                      <T k="listing.offerEnds" /> {formatDate(offer.endsAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {showLocation && (
            <Block titleKey="listing.location">
              {(listing.address || listing.area) && (
                <p>
                  {/* Add the area unless the address already names it ("…, Thamel"). */}
                  {listing.address &&
                  listing.area &&
                  listing.address.toLowerCase().includes(listing.area.nameEn.toLowerCase())
                    ? listing.address
                    : [listing.address, listing.area?.nameEn].filter(Boolean).join(', ')}
                </p>
              )}
              <LazyMap points={points} />
            </Block>
          )}

          <Block titleKey="listing.reviews">
            <WriteReview businessId={listing.id} slug={listing.slug} />
            <ReviewList
              slug={listing.slug}
              initialItems={reviews?.data ?? []}
              initialCursor={reviews?.meta.nextCursor ?? null}
            />
          </Block>

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
            <ReportDialog entityId={listing.id} />
            {!listing.isClaimed && listing.type !== 'HOTLINE' && (
              <p className="text-sm text-text-muted">
                <T k="listing.claimPrompt" />{' '}
                <Link
                  href="/business/dashboard"
                  prefetch={false}
                  className="font-semibold text-brand underline"
                >
                  <T k="listing.claimLink" />
                </Link>
              </p>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          {listing.hours && (
            <section aria-labelledby="hours" className={panel}>
              <h2 id="hours" className="mb-2 text-lg font-semibold">
                <T k="listing.hours" />
              </h2>
              <HoursTable hours={listing.hours} />
              <p className="mt-3 text-xs text-text-muted">
                <T k="listing.nepalTime" />
              </p>
            </section>
          )}
          {(listing.contact.phone || listing.contact.website || listing.address) && (
            <section aria-labelledby="contact" className={`${panel} flex flex-col gap-3 text-sm`}>
              <h2 id="contact" className="text-lg font-semibold">
                <T en="Contact" ne="सम्पर्क" />
              </h2>
              {listing.contact.phone && (
                <a
                  href={telHref(listing.contact.phone)}
                  className="inline-flex items-center gap-2 font-semibold hover:text-brand"
                >
                  <Phone aria-hidden="true" className="size-4 text-text-muted" />
                  {listing.contact.phone}
                </a>
              )}
              {listing.contact.website && (
                <a
                  href={listing.contact.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 break-all hover:text-brand"
                >
                  <Globe aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
                  {bareUrl(listing.contact.website)}
                </a>
              )}
              {listing.address && (
                <p className="inline-flex items-start gap-2 text-text-muted">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {listing.address}
                </p>
              )}
            </section>
          )}
        </aside>
      </div>

      {similar?.data.length > 0 && (
        <Block titleKey="listing.similar">
          <CardGrid cards={similar.data} priorityCount={0} />
        </Block>
      )}

      <ActionBar listing={listing} variant="sticky" />
    </article>
  )
}
