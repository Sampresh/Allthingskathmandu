import { notFound } from 'next/navigation'
import { MessageCircle, Phone } from 'lucide-react'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { MarketT } from '@/components/common/MarketT'
import { ST as T } from '@/components/common/ST'
import { ImageGallery } from '@/components/listing/ImageGallery'
import { ReportDialog } from '@/components/listing/ReportDialog'
import { Badge } from '@/components/ui/Badge'
import { formatDate, formatNpr, telHref, whatsappHref } from '@/lib/format'
import { pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'
import { isSlug } from '@/lib/slug'

export const revalidate = 3600
export const generateStaticParams = async () => []

const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-box px-4 font-semibold'

async function loadItem(slug) {
  if (!isSlug(slug)) return null
  const res = await publicGet(`/market/${slug}`, { tags: [`market:${slug}`, 'market'] })
  return res?.data ?? null
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const item = await loadItem(slug)
  if (!item) return {}
  return pageMetadata({
    title: `${item.title} – ${formatNpr(item.priceNpr)}`,
    description:
      item.description?.slice(0, 160) ??
      `${item.title} for sale${item.area ? ` in ${item.area.nameEn}` : ''}, Kathmandu.`,
    path: `/market/${item.slug}`,
    image: item.photo?.url,
  })
}

export default async function MarketItemPage({ params }) {
  const { slug } = await params
  const item = await loadItem(slug)
  if (!item) notFound()

  return (
    <article className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { href: '/', label: <T k="nav.home" /> },
          { href: '/market', label: <T k="nav.market" /> },
          { label: item.title },
        ]}
      />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-2xl font-semibold">{formatNpr(item.priceNpr)}</p>
          {item.isNegotiable && (
            <Badge>
              <MarketT k="market.negotiable" />
            </Badge>
          )}
          <Badge tone="brand">
            <MarketT k={`market.condition.${item.condition}`} />
          </Badge>
        </div>
        <p className="text-text-muted">
          <T en={item.category.nameEn} ne={item.category.nameNe} />
          {item.area && (
            <>
              {' · '}
              <T en={item.area.nameEn} ne={item.area.nameNe} />
            </>
          )}
          {' · '}
          <T k="market.posted" /> {formatDate(item.createdAt)}
        </p>
      </div>

      {/* Contact by call or WhatsApp only (no checkout, no messages). */}
      <div className="flex flex-col gap-2">
        <p>
          <T k="market.seller" />: <strong>{item.seller.firstName}</strong>
        </p>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {item.contact.phone && (
            <a
              href={telHref(item.contact.phone)}
              className={`${buttonClass} bg-brand text-brand-contrast hover:opacity-90`}
            >
              <Phone aria-hidden="true" className="size-5" />
              <T k="listing.call" />
            </a>
          )}
          {item.contact.whatsapp && (
            <a
              href={whatsappHref(item.contact.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClass} ${item.contact.phone ? 'border border-border bg-surface text-text hover:bg-surface-raised' : 'bg-brand text-brand-contrast hover:opacity-90'}`}
            >
              <MessageCircle aria-hidden="true" className="size-5" />
              <T k="listing.whatsapp" />
            </a>
          )}
        </div>
      </div>

      {item.photos.length > 0 && <ImageGallery photos={item.photos} title={item.title} />}

      {item.description && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">
            <T k="market.about" />
          </h2>
          <p className="max-w-3xl whitespace-pre-line">{item.description}</p>
        </section>
      )}

      <div>
        <ReportDialog entityType="MARKET_ITEM" entityId={item.id} />
      </div>
    </article>
  )
}
