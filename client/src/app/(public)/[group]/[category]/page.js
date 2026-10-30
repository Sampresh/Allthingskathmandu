import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { ST as T } from '@/components/common/ST'
import { CategoryResults } from '@/components/search/CategoryResults'
import { pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'
import { isSlug } from '@/lib/slug'

export const revalidate = 3600
export const generateStaticParams = async () => []

async function loadCategory(groupSlug, slug) {
  if (!isSlug(groupSlug) || !isSlug(slug)) return null
  const res = await publicGet(`/categories/${slug}`, { tags: [`category:${slug}`, 'groups'] })
  const category = res?.data
  return category && !category.isGroup && category.group?.slug === groupSlug ? category : null
}

export async function generateMetadata({ params }) {
  const { group, category: slug } = await params
  const category = await loadCategory(group, slug)
  if (!category) return {}
  return pageMetadata({
    title: category.seoTitle ?? `${category.nameEn} in Kathmandu`,
    description:
      category.seoDescription ??
      `Compare ${category.liveCount} ${category.nameEn.toLowerCase()} in Kathmandu Valley. Call, WhatsApp or get directions in one tap.`,
    path: `/${group}/${slug}`,
  })
}

export default async function CategoryPage({ params }) {
  const { group, category: slug } = await params
  const category = await loadCategory(group, slug)
  if (!category) notFound()

  const [listings, areas] = await Promise.all([
    publicGet(`/categories/${slug}/listings?limit=20`, { tags: [`category:${slug}`] }),
    publicGet('/areas', { tags: ['areas'] }),
  ])

  return (
    <div className="browse-wide flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { href: '/', label: <T k="nav.home" /> },
          { href: `/${group}`, label: <T en={category.group.nameEn} ne={category.group.nameNe} /> },
          { label: <T en={category.nameEn} ne={category.nameNe} /> },
        ]}
      />
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-semibold">
          <T en={category.nameEn} ne={category.nameNe} />
        </h1>
        <p className="text-text-muted">
          {category.liveCount} <T k="listing.listings" />
        </p>
      </div>
      {category.description && <p className="max-w-2xl text-text-muted">{category.description}</p>}
      <CategoryResults
        category={category}
        areas={areas?.data ?? []}
        initialItems={listings?.data ?? []}
        initialCursor={listings?.meta.nextCursor ?? null}
      />
    </div>
  )
}
