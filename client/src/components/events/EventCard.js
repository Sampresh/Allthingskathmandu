import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { T } from '@/components/common/T'
import { CloudImage } from '@/components/ui/CloudImage'
import { formatClock, formatDay } from '@/lib/dates'
import { eventHref } from '@/lib/format'

/** One event: date and time (Kathmandu), title, venue and area, cover when there is one. */
export function EventCard({ event, headingLevel = 3, showDay = true }) {
  const Heading = `h${headingLevel}`
  return (
    <article className="relative flex gap-3 rounded-box border border-border bg-surface p-4">
      {event.coverUrl ? (
        <CloudImage
          src={event.coverUrl}
          alt=""
          width={96}
          height={96}
          widths={[96, 192]}
          sizes="96px"
          className="size-20 shrink-0 rounded-box object-cover sm:size-24"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-20 shrink-0 items-center justify-center rounded-box bg-surface-raised text-text-muted sm:size-24"
        >
          <CalendarDays className="size-8" />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-semibold text-brand">
          {showDay && `${formatDay(event.startsAt)} · `}
          {formatClock(event.startsAt)}
          {event.endsAt && ` – ${formatDay(event.endsAt)}`}
        </p>
        <Heading className="font-semibold">
          <Link href={eventHref(event.slug)} className="after:absolute after:inset-0">
            {event.title}
          </Link>
        </Heading>
        {(event.venue || event.area) && (
          <p className="text-sm text-text-muted">
            {event.venue}
            {event.venue && event.area && ' · '}
            {event.area && <T en={event.area.nameEn} ne={event.area.nameNe} />}
          </p>
        )}
      </div>
    </article>
  )
}
