import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, MapPin } from 'lucide-react'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { ST as T } from '@/components/common/ST'
import { ActionBar } from '@/components/listing/ActionBar'
import { HoursTable } from '@/components/listing/HoursTable'
import { ImageGallery } from '@/components/listing/ImageGallery'
import { CardGrid } from '@/components/listing/ListingCard'
import { OpenStatus } from '@/components/listing/OpenStatus'
import { ReportDialog } from '@/components/listing/ReportDialog'
import { ReviewList } from '@/components/listing/ReviewList'
import { SaveButton } from '@/components/listing/SaveButton'
import { TrackView } from '@/components/listing/TrackView'
import { VideoEmbed } from '@/components/listing/VideoEmbed'
import { WriteReview } from '@/components/listing/WriteReview'
import { LazyMap } from '@/components/map/LazyMap'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Rating } from '@/components/ui/Rating'
import { categoryHref, formatDate, priceLevelText } from '@/lib/format'
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
  return pageMetadata({
    title: listing.seoTitle ?? `${listing.name}${where}`,
    description: listing.seoDescription ?? listing.shortDesc,
    path: `/listing/${listing.slug}`,
    image: listing.logoUrl ?? undefined,
  })
}

function Block({ titleKey, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">
        <T k={titleKey} />
      </h2>
      {children}
    </section>
  )
}

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
  const points = listing.location
    ? [{ id: listing.id, label: listing.name, ...listing.location }]
    : []

  return (
    <article className="flex flex-col gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(listingJsonLd(listing)).replace(/</g, '\\u003c'),
        }}
      />
      <TrackView businessId={listing.id} />

      <div className="flex flex-col gap-4">
        {category?.groupSlug && (
          <Breadcrumbs
            items={[
              { href: '/', label: <T k="nav.home" /> },
              {
                href: categoryHref(category),
                label: <T en={category.nameEn} ne={category.nameNe} />,
              },
              { label: listing.name },
            ]}
          />
        )}
        <div className="flex items-start gap-4">
          <Avatar
            src={listing.logoUrl}
            name={listing.name}
            alt={`${listing.name} logo`}
            size={72}
            priority
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold sm:text-3xl">
              <T en={listing.name} ne={listing.nameNe} />
              {listing.isVerified && (
                <Badge tone="brand">
                  <BadgeCheck aria-hidden="true" className="size-4" />
                  <T k="listing.verified" />
                </Badge>
              )}
              {listing.featured && (
                <Badge tone="featured">
                  <T k="listing.featured" />
                </Badge>
              )}
            </h1>
            <p className="text-text-muted">{listing.shortDesc}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
              {category && (
                <Link
                  href={categoryHref(category)}
                  className="font-semibold text-brand hover:underline"
                >
                  <T en={category.nameEn} ne={category.nameNe} />
                </Link>
              )}
              {listing.area && (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-4" />
                  <T en={listing.area.nameEn} ne={listing.area.nameNe} />
                </span>
              )}
              {listing.priceLevel && (
                <span>
                  <span className="sr-only">
                    <T k="listing.priceLevel" />:{' '}
                  </span>
                  {priceLevelText(listing.priceLevel)}
                </span>
              )}
              <Rating value={listing.rating.average} count={listing.rating.count} />
              <OpenStatus hours={listing.hours} initial={listing.openNow} showClosed />
            </div>
          </div>
        </div>
        <ActionBar listing={listing} />
        <SaveButton businessId={listing.id} slug={listing.slug} />
      </div>

      {listing.description && (
        <Block titleKey="listing.about">
          <p className="max-w-3xl whitespace-pre-line">{listing.description}</p>
        </Block>
      )}

      {listing.hours && (
        <Block titleKey="listing.hours">
          <div className="max-w-md">
            <HoursTable hours={listing.hours} />
            <p className="mt-2 text-sm text-text-muted">
              <T k="listing.nepalTime" />
            </p>
          </div>
        </Block>
      )}

      {(listing.address || listing.area || listing.location) && listing.type !== 'APP' && (
        <Block titleKey="listing.location">
          {(listing.address || listing.area) && (
            <p>{[listing.address, listing.area?.nameEn].filter(Boolean).join(', ')}</p>
          )}
          <LazyMap points={points} />
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
              <li key={offer.id} className="rounded-box border border-featured p-4">
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

      <Block titleKey="listing.reviews">
        <WriteReview businessId={listing.id} slug={listing.slug} />
        <ReviewList
          slug={listing.slug}
          initialItems={reviews?.data ?? []}
          initialCursor={reviews?.meta.nextCursor ?? null}
        />
      </Block>

      <div className="flex flex-wrap items-center gap-4">
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

      {similar?.data.length > 0 && (
        <Block titleKey="listing.similar">
          <CardGrid cards={similar.data} priorityCount={0} />
        </Block>
      )}
    </article>
  )
}
