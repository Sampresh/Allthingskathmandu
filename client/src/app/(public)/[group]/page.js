import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { GroupIcon } from '@/components/common/GroupIcon'
import { ST as T } from '@/components/common/ST'
import { EmptyState } from '@/components/ui/EmptyState'
import { pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'
import { isSlug } from '@/lib/slug'

export const revalidate = 3600
// Rendered on first request, then cached (ISR) until revalidated.
export const generateStaticParams = async () => []

async function loadGroup(slug) {
  if (!isSlug(slug)) return null
  const res = await publicGet(`/categories/${slug}`, { tags: [`category:${slug}`, 'groups'] })
  return res?.data.isGroup ? res.data : null
}

export async function generateMetadata({ params }) {
  const group = await loadGroup((await params).group)
  if (!group) return {}
  return pageMetadata({
    title: group.seoTitle ?? `${group.nameEn} in Kathmandu`,
    description:
      group.seoDescription ??
      `${group.nameEn} in Kathmandu Valley: ${group.categories.map((c) => c.nameEn).join(', ')}.`,
    path: `/${group.slug}`,
  })
}

export default async function GroupPage({ params }) {
  const group = await loadGroup((await params).group)
  if (!group) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { href: '/', label: <T k="nav.home" /> },
          { label: <T en={group.nameEn} ne={group.nameNe} /> },
        ]}
      />
      <h1 className="flex items-center gap-3 text-3xl font-semibold">
        <span className="text-brand">
          <GroupIcon name={group.icon} className="size-8" />
        </span>
        <T en={group.nameEn} ne={group.nameNe} />
      </h1>
      {group.categories.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {group.categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${group.slug}/${c.slug}`}
                className="flex min-h-16 items-center justify-between gap-3 rounded-box border border-border bg-surface p-4 font-semibold hover:bg-surface-raised"
              >
                <T en={c.nameEn} ne={c.nameNe} />
                <span className="text-sm font-normal text-text-muted">
                  {c.liveCount} <T k="listing.listings" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message={<T k="empty.group" />} />
      )}
    </div>
  )
}
