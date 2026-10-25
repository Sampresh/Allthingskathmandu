import { publicGet } from '@/lib/serverApi'
import { SITE_URL } from '@/lib/site'

export const revalidate = 3600

// Home, every visible group and category, Events and Market. Listings, events and items are
// reached from those pages.
export default async function sitemap() {
  const groups = (await publicGet('/groups', { tags: ['groups'] }))?.data ?? []
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/events`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/market`, changeFrequency: 'daily', priority: 0.6 },
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
