import { readDb } from '../config/db.js'
import { Prisma } from '../generated/prisma/client'
import { nepalClock, openNowSql } from '../lib/hours.js'
import { publicItemWhere } from './market.js'
import {
  cardStream,
  featuredSortSql,
  featuredSql,
  getCategoryTree,
  liveSql,
  organicSortSql,
  toCard,
} from './directory.js'

const DEFAULT_LIMIT = 8
const MAX_LIMIT = 24
const POPULAR_DAYS = 7

// Hotlines (Police, Fire, Ambulance) live on /emergency and in the footer, not in home card rows.
const notHotlineSql = Prisma.sql`b.type <> 'HOTLINE'`

const limitOf = (section) =>
  Math.min(Math.max(Number(section.config?.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)

async function cards(args) {
  const clock = nepalClock()
  return (await cardStream(args)).map((row) => toCard(row, clock))
}

// Data loader per section type (Part 4 §3, homepage builder).
const loaders = {
  GROUPS: () => getCategoryTree(),

  OPEN_NOW: (section, point) =>
    cards({
      point,
      where: Prisma.sql`${liveSql} AND ${notHotlineSql} AND ${openNowSql()}`,
      sortKey: organicSortSql(point),
      limit: limitOf(section),
    }),

  FEATURED: (section, point) =>
    cards({
      point,
      where: Prisma.sql`${liveSql} AND ${notHotlineSql} AND ${featuredSql}`,
      sortKey: featuredSortSql(null),
      limit: limitOf(section),
    }),

  POPULAR: (section, point) =>
    cards({
      point,
      from: Prisma.sql`JOIN (
        SELECT "businessId", SUM(views) AS views
        FROM listing_stats_daily
        WHERE date >= CURRENT_DATE - ${POPULAR_DAYS}::int
        GROUP BY "businessId"
      ) pop ON pop."businessId" = b.id`,
      where: Prisma.sql`${liveSql} AND ${notHotlineSql}`,
      sortKey: Prisma.sql`-pop.views`,
      limit: limitOf(section),
    }),

  CUSTOM_LIST: async (section, point) => {
    const ids = (section.config?.businessIds ?? []).filter((id) => typeof id === 'string')
    if (!ids.length) return []
    return cards({
      point,
      where: Prisma.sql`${liveSql} AND b.id = ANY(${ids}::uuid[])`,
      sortKey: Prisma.sql`array_position(${ids}::uuid[], b.id)`,
      limit: ids.length,
    })
  },

  EVENTS: async (section) => {
    const events = await readDb.event.findMany({
      where: { status: 'APPROVED', startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: limitOf(section),
      include: { area: true },
    })
    return events.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      venue: e.venue,
      coverUrl: e.coverUrl,
      area: e.area ? { slug: e.area.slug, nameEn: e.area.nameEn, nameNe: e.area.nameNe } : null,
    }))
  },

  MARKET: async (section) => {
    const items = await readDb.marketItem.findMany({
      where: publicItemWhere(),
      orderBy: { id: 'desc' },
      take: limitOf(section),
      include: { area: true, media: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    })
    return items.map((i) => ({
      id: i.id,
      slug: i.slug,
      title: i.title,
      priceNpr: i.priceNpr,
      condition: i.condition,
      createdAt: i.createdAt,
      photo: i.media[0] ? { url: i.media[0].url, altText: i.media[0].altText } : null,
      area: i.area ? { slug: i.area.slug, nameEn: i.area.nameEn, nameNe: i.area.nameNe } : null,
    }))
  },

  BANNER: () => null,
}

/** Active home sections in Admin order, each with its data. */
export async function getHome({ point } = {}) {
  const sections = await readDb.homeSection.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return Promise.all(
    sections.map(async (section) => ({
      id: section.id,
      type: section.type,
      title: section.title,
      config: section.config,
      items: await loaders[section.type](section, point),
    })),
  )
}
