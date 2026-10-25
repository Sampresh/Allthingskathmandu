import { db } from '../config/db.js'
import { isRedisReady, redis } from '../config/redis.js'
import { clientUrl, queueEmail } from './email.js'
import { afterListingChange, categoryIdsOf } from './listings.js'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
// An unpaid checkout older than this is abandoned.
const ABANDONED_AFTER_MS = DAY_MS
const REMINDER_DAYS = [7, 1]

const nepalDate = (date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kathmandu',
  }).format(date)

/**
 * Ends subscriptions whose period is over and recomputes featuredUntil from what is still
 * active (downgrade to Basic on expiry), then fails abandoned unpaid checkouts.
 */
export async function expireSubscriptions(now = new Date()) {
  const ended = await db.subscription.findMany({
    where: { status: 'ACTIVE', endsAt: { lte: now } },
    select: { id: true, businessId: true },
  })
  if (ended.length) {
    await db.subscription.updateMany({
      where: { id: { in: ended.map((s) => s.id) } },
      data: { status: 'EXPIRED' },
    })
  }

  // Every listing whose Featured period has passed, plus those with a subscription just ended.
  const stale = await db.business.findMany({
    where: {
      OR: [{ featuredUntil: { lte: now } }, { id: { in: ended.map((s) => s.businessId) } }],
    },
    select: { id: true, slug: true, featuredUntil: true },
  })
  let downgraded = 0
  for (const business of stale) {
    const still = await db.subscription.findFirst({
      where: { businessId: business.id, status: 'ACTIVE', endsAt: { gt: now } },
      include: { plan: true },
      orderBy: { endsAt: 'desc' },
    })
    const featuredUntil = still?.plan.features?.featured ? still.endsAt : null
    if (business.featuredUntil?.getTime() === featuredUntil?.getTime()) continue
    await db.business.update({ where: { id: business.id }, data: { featuredUntil } })
    await afterListingChange(business, await categoryIdsOf(db, business.id))
    downgraded += 1
  }

  const abandoned = await db.payment.findMany({
    where: { status: 'INITIATED', createdAt: { lt: new Date(now.getTime() - ABANDONED_AFTER_MS) } },
    select: { id: true, subscriptionId: true },
  })
  if (abandoned.length) {
    await db.$transaction([
      db.payment.updateMany({
        where: { id: { in: abandoned.map((p) => p.id) } },
        data: { status: 'FAILED' },
      }),
      db.subscription.updateMany({
        where: { id: { in: abandoned.map((p) => p.subscriptionId) }, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      }),
    ])
  }
  return { expired: ended.length, downgraded, abandoned: abandoned.length }
}

/**
 * Emails owners 7 days and 1 day before a plan ends, unless it is already renewed. Each
 * reminder is sent once (remembered in Redis), so the job can run every hour.
 */
export async function sendRenewalReminders(now = new Date()) {
  if (!isRedisReady()) return { sent: 0, skipped: 'redis unavailable' }
  const horizon = new Date(now.getTime() + Math.max(...REMINDER_DAYS) * DAY_MS)
  const ending = await db.subscription.findMany({
    where: { status: 'ACTIVE', endsAt: { gt: now, lte: horizon } },
    include: { plan: true, business: { include: { owner: true } } },
  })

  let sent = 0
  for (const sub of ending) {
    const { business } = sub
    if (!business.owner || business.deletedAt) continue
    // Renewed: a later paid period already exists.
    const renewed = await db.subscription.count({
      where: { businessId: business.id, status: 'ACTIVE', endsAt: { gt: sub.endsAt } },
    })
    if (renewed) continue

    const daysLeft = Math.ceil((sub.endsAt.getTime() - now.getTime()) / DAY_MS)
    const due = REMINDER_DAYS.filter((d) => daysLeft <= d).at(-1)
    if (!due) continue
    const first = await redis.set(`reminder:${sub.id}:${due}`, '1', 'EX', 10 * 24 * 60 * 60, 'NX')
    if (!first) continue

    await queueEmail(business.owner.email, 'renewal-reminder', {
      name: business.owner.name,
      listingName: business.name,
      planName: sub.plan.name,
      daysLeft,
      endsAt: nepalDate(sub.endsAt),
      url: clientUrl(`/business/plan?listing=${business.id}`),
    })
    sent += 1
  }
  return { sent }
}
