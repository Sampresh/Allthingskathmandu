import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, MapPin, Navigation, Ticket } from 'lucide-react'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { ST as T } from '@/components/common/ST'
import { ReportDialog } from '@/components/listing/ReportDialog'
import { LazyMap } from '@/components/map/LazyMap'
import { CloudImage } from '@/components/ui/CloudImage'
import { formatClock, formatDay } from '@/lib/dates'
import { directionsHref, listingHref } from '@/lib/format'
import { eventJsonLd, pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'
import { isSlug } from '@/lib/slug'

export const revalidate = 3600
export const generateStaticParams = async () => []

const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-box px-4 font-semibold'

async function loadEvent(slug) {
  if (!isSlug(slug)) return null
  const res = await publicGet(`/events/${slug}`, { tags: [`event:${slug}`, 'events'] })
  return res?.data ?? null
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const event = await loadEvent(slug)
  if (!event) return {}
  return pageMetadata({
    title: `${event.title}, ${formatDay(event.startsAt)}`,
    description:
      event.description?.slice(0, 160) ??
      `${event.title}${event.venue ? ` at ${event.venue}` : ''}, Kathmandu.`,
    path: `/events/${event.slug}`,
    image: event.coverUrl,
  })
}

export default async function EventPage({ params }) {
  const { slug } = await params
  const event = await loadEvent(slug)
  if (!event) notFound()
  const points = event.location ? [{ id: event.id, label: event.title, ...event.location }] : []

  return (
    <article className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(eventJsonLd(event)).replace(/</g, '\\u003c'),
        }}
      />
      <Breadcrumbs
        items={[
          { href: '/', label: <T k="nav.home" /> },
          { href: '/events', label: <T k="nav.events" /> },
          { label: event.title },
        ]}
      />
      {event.coverUrl && (
        <CloudImage
          src={event.coverUrl}
          alt=""
          width={1200}
          height={500}
          widths={[480, 768, 1024, 1200]}
          sizes="(min-width: 1152px) 1152px, 100vw"
          priority
          className="aspect-[12/5] w-full rounded-box object-cover"
        />
      )}
      <h1 className="text-2xl font-semibold sm:text-3xl">{event.title}</h1>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-2">
          <CalendarDays aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-text-muted" />
          <div>
            <dt className="text-sm text-text-muted">
              <T k="events.when" />
            </dt>
            <dd className="font-semibold">
              {formatDay(event.startsAt)}, {formatClock(event.startsAt)}
              {event.endsAt && ` – ${formatDay(event.endsAt)}, ${formatClock(event.endsAt)}`}
            </dd>
          </div>
        </div>
        {(event.venue || event.area) && (
          <div className="flex gap-2">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-text-muted" />
            <div>
              <dt className="text-sm text-text-muted">
                <T k="events.where" />
              </dt>
              <dd className="font-semibold">
                {event.venue}
                {event.venue && event.area && ', '}
                {event.area && <T en={event.area.nameEn} ne={event.area.nameNe} />}
              </dd>
            </div>
          </div>
        )}
        {event.business && (
          <div>
            <dt className="text-sm text-text-muted">
              <T k="events.organiser" />
            </dt>
            <dd>
              <Link
                href={listingHref(event.business.slug)}
                className="font-semibold text-brand hover:underline"
              >
                {event.business.name}
              </Link>
            </dd>
          </div>
        )}
      </dl>
      {(event.ticketUrl || event.location || event.venue) && (
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {event.ticketUrl && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClass} bg-brand text-brand-contrast hover:opacity-90`}
            >
              <Ticket aria-hidden="true" className="size-5" />
              <T k="events.tickets" />
            </a>
          )}
          {(event.location || event.venue) && (
            <a
              href={directionsHref({
                location: event.location,
                name: event.venue,
                area: event.area,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClass} border border-border bg-surface text-text hover:bg-surface-raised`}
            >
              <Navigation aria-hidden="true" className="size-5" />
              <T k="listing.directions" />
            </a>
          )}
        </div>
      )}
      {event.description && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">
            <T k="events.about" />
          </h2>
          <p className="max-w-3xl whitespace-pre-line">{event.description}</p>
        </section>
      )}
      {points.length > 0 && <LazyMap points={points} />}
      <div>
        <ReportDialog entityType="EVENT" entityId={event.id} />
      </div>
    </article>
  )
}
