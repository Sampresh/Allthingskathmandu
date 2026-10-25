import { Plus } from 'lucide-react'
import { ST as T } from '@/components/common/ST'
import { MarketResults } from '@/components/market/MarketResults'
import { Button } from '@/components/ui/Button'
import { pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'

export const revalidate = 3600

export const metadata = pageMetadata({
  title: 'Second-hand market in Kathmandu',
  description:
    'Used and thrift items for sale in Kathmandu Valley: furniture, phones, bikes and more. Call or WhatsApp the seller.',
  path: '/market',
})

export default async function MarketPage() {
  const [items, categories, areas] = await Promise.all([
    publicGet('/market?limit=20', { tags: ['market'] }),
    publicGet('/market/categories', { tags: ['groups'] }),
    publicGet('/areas', { tags: ['areas'] }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-3xl font-semibold">
            <T k="market.title" />
          </h1>
          <p className="text-text-muted">
            <T k="market.intro" />
          </p>
        </div>
        <Button href="/account/market" prefetch={false}>
          <Plus aria-hidden="true" className="size-5" />
          <T k="market.sell" />
        </Button>
      </div>
      <MarketResults
        categories={categories?.data ?? []}
        areas={areas?.data ?? []}
        initialItems={items?.data ?? []}
        initialCursor={items?.meta.nextCursor ?? null}
      />
    </div>
  )
}
