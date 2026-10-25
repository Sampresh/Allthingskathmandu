import { CloudImage } from '@/components/ui/CloudImage'
import Link from 'next/link'
import { ST as T } from '@/components/common/ST'
import { formatNpr } from '@/lib/format'

export function MarketCard({ item }) {
  return (
    <article className="relative flex flex-col overflow-hidden rounded-box border border-border bg-surface">
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
        <h3 className="line-clamp-2 font-semibold">
          <Link href={`/market/${item.slug}`} className="after:absolute after:inset-0">
            {item.title}
          </Link>
        </h3>
        <p className="font-semibold">{formatNpr(item.priceNpr)}</p>
        {item.area && (
          <p className="text-sm text-text-muted">
            <T en={item.area.nameEn} ne={item.area.nameNe} />
          </p>
        )}
      </div>
    </article>
  )
}
