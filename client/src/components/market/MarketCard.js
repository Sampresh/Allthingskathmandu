import Link from 'next/link'
import { MarketT as T } from '@/components/common/MarketT'
import { CloudImage } from '@/components/ui/CloudImage'
import { daysAgo, toNepaliDigits } from '@/lib/dates'
import { formatNpr, marketHref } from '@/lib/format'

/** "Today", "1 day ago", "3 days ago" in both languages. */
function Age({ createdAt }) {
  const days = daysAgo(createdAt)
  if (days === 0) return <T k="market.today" />
  return <T en={`${days} day${days === 1 ? '' : 's'} ago`} ne={`${toNepaliDigits(days)} दिन अघि`} />
}

/** Market list card (Part 4 §3): photo, price, area, age. */
export function MarketCard({ item, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-box border border-border bg-surface">
      {item.photo ? (
        <CloudImage
          src={item.photo.url}
          alt={item.photo.altText}
          width={400}
          height={300}
          widths={[200, 300, 400, 600, 800]}
          sizes="(min-width: 768px) 25vw, 50vw"
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div aria-hidden="true" className="aspect-[4/3] w-full bg-surface-raised" />
      )}
      <div className="flex flex-col gap-1 p-3">
        <Heading className="line-clamp-2 font-semibold">
          <Link href={marketHref(item.slug)} className="after:absolute after:inset-0">
            {item.title}
          </Link>
        </Heading>
        <p className="font-semibold">{formatNpr(item.priceNpr)}</p>
        <p className="text-sm text-text-muted">
          {item.area && (
            <>
              <T en={item.area.nameEn} ne={item.area.nameNe} />
              {' · '}
            </>
          )}
          <Age createdAt={item.createdAt} />
        </p>
      </div>
    </article>
  )
}
