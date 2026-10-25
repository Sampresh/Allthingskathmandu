import { publicGet } from '@/lib/serverApi'
import { SITE_URL } from '@/lib/site'

export const revalidate = 3600

// Home, every visible group and category. Listings are reached from category pages.
export default async function sitemap() {
  const groups = (await publicGet('/groups', { tags: ['groups'] }))?.data ?? []
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    ...groups.flatMap((group) => [
      { url: `${SITE_URL}/${group.slug}`, changeFrequency: 'weekly', priority: 0.8 },
      ...group.categories.map((c) => ({
        url: `${SITE_URL}/${group.slug}/${c.slug}`,
        changeFrequency: 'daily',
        priority: 0.7,
      })),
    ]),
  ]
}
