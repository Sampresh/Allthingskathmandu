// Idempotent seed (Part 5 §6). Every row is created only when missing, so re-running the seed
// never overwrites what Admin has edited since.
import bcrypt from 'bcryptjs'
import { db } from '../src/config/db.js'
import { env } from '../src/config/env.js'
import { slugify } from '../src/lib/slug.js'
import { syncAreas, syncTaxonomy } from '../src/services/taxonomySync.js'

const BCRYPT_COST = 12

// ---------- Taxonomy and areas: prisma/data/taxonomy.js and areas.js ----------

// Second-hand marketplace categories. Slugs are prefixed so they never collide with
// directory categories (both have "Electronics").
const MARKET_CATEGORIES = [
  ['Electronics', 'इलेक्ट्रोनिक्स', 'laptop'],
  ['Mobiles', 'मोबाइल', 'smartphone'],
  ['Furniture', 'फर्निचर', 'sofa'],
  ['Clothing', 'लुगाफाटा', 'shirt'],
  ['Vehicles', 'सवारी साधन', 'bike'],
  ['Books', 'किताब', 'book-open'],
  ['Home & Kitchen', 'घर तथा भान्सा', 'cooking-pot'],
  ['Sports', 'खेलकुद', 'dumbbell'],
  ['Other', 'अन्य', 'package'],
]

// ---------- Listings ----------
// Listings are not seeded: import them with `npm run import:listings -- prisma/data/listings.csv`.

const PLANS = [
  {
    code: 'BASIC',
    name: 'Basic',
    priceNpr: 0,
    durationDays: 30,
    features: { maxPhotos: 0, maxVideos: 0, featured: false, homepage: false },
    isActive: true,
    sortOrder: 0,
  },
  {
    // Inactive until Admin sets the price (Rs 3,000 to 5,000/mo, Part 1 §4).
    code: 'FEATURED',
    name: 'Featured',
    priceNpr: 0,
    durationDays: 30,
    features: { maxPhotos: 12, maxVideos: 3, featured: true, homepage: true },
    isActive: false,
    sortOrder: 1,
  },
]

const SETTINGS = {
  emergency_numbers: [
    { label: 'Police', number: '100' },
    { label: 'Fire', number: '101' },
    { label: 'Ambulance', number: '102' },
    { label: 'Tourist Police', number: '1144' },
  ],
  contact: { email: 'hello@allthingskathmandu.com', phone: null, address: 'Kathmandu, Nepal' },
  social_links: [],
}

const HOME_SECTIONS = [
  { type: 'GROUPS', title: null, config: null },
  { type: 'OPEN_NOW', title: 'Open now near you', config: { limit: 8 } },
  { type: 'FEATURED', title: 'Featured', config: { limit: 8 } },
  { type: 'POPULAR', title: 'Popular this week', config: { limit: 8 } },
  { type: 'EVENTS', title: 'Upcoming events', config: { limit: 6 } },
  { type: 'MARKET', title: 'Latest market items', config: { limit: 8 } },
  {
    type: 'BANNER',
    title: 'List your business',
    config: {
      body: 'Add your business to the directory for free.',
      ctaLabel: 'List your business',
      href: '/business',
    },
  },
]

const SYNONYMS = [
  { term: 'plumber', synonyms: ['dhara mistri'] },
  { term: 'electrician', synonyms: ['bijuli mistri'] },
  { term: 'momo', synonyms: ['dumpling'] },
]

// ---------- Steps ----------

const DEFAULT_PASSWORDS = [
  'password',
  'admin',
  'changeme',
  'change-me',
  '123456',
  'qwerty',
  'kathmandu',
]

function weakPasswordReason(password) {
  if (password.length < 12) return 'must be at least 12 characters'
  const lower = password.toLowerCase()
  if (DEFAULT_PASSWORDS.some((d) => lower.includes(d))) return 'contains a common or default word'
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  if (classes < 3) return 'needs at least three of: lowercase, uppercase, digit, symbol'
  return null
}

async function seedSuperAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    if (env.isProduction)
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required in production')
    console.log('  super admin: skipped (ADMIN_EMAIL / ADMIN_PASSWORD not set)')
    return
  }
  const reason = weakPasswordReason(env.ADMIN_PASSWORD)
  if (reason && env.isProduction) throw new Error(`ADMIN_PASSWORD refused: ${reason}`)
  if (reason)
    console.log(`  super admin: warning, weak password (${reason}); refused in production`)

  const email = env.ADMIN_EMAIL.toLowerCase()
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    // Never reset the password of an existing account; only make sure of the role.
    if (existing.role !== 'SUPER_ADMIN') {
      await db.user.update({ where: { id: existing.id }, data: { role: 'SUPER_ADMIN' } })
    }
    console.log(`  super admin: ${email} (exists)`)
    return
  }
  await db.user.create({
    data: {
      email,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, BCRYPT_COST),
      emailVerifiedAt: new Date(),
    },
  })
  console.log(`  super admin: ${email} (created)`)
}

async function seedTaxonomy() {
  const { groupsCreated, categoriesCreated } = await syncTaxonomy(db)
  for (const [index, [nameEn, nameNe, icon]] of MARKET_CATEGORIES.entries()) {
    await db.category.upsert({
      where: { slug: `market-${slugify(nameEn)}` },
      create: {
        kind: 'MARKET',
        slug: `market-${slugify(nameEn)}`,
        nameEn,
        nameNe,
        icon,
        sortOrder: index,
      },
      update: {},
    })
  }
  console.log(
    `  categories: ${groupsCreated} groups and ${categoriesCreated} directory categories created, ${MARKET_CATEGORIES.length} market`,
  )
}

async function seedAreas() {
  const { created, aliasesAdded } = await syncAreas(db)
  console.log(`  areas: ${created} created, ${aliasesAdded} aliases added`)
}

async function seedPlans() {
  for (const plan of PLANS) {
    await db.plan.upsert({ where: { code: plan.code }, create: plan, update: {} })
  }
  console.log(`  plans: ${PLANS.map((p) => p.code).join(', ')}`)
}

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} })
  }
  console.log(`  settings: ${Object.keys(SETTINGS).join(', ')}`)
}

async function seedHomeSections() {
  if ((await db.homeSection.count()) > 0) {
    console.log('  home sections: exist, unchanged')
    return
  }
  await db.homeSection.createMany({
    data: HOME_SECTIONS.map((section, index) => ({ ...section, sortOrder: index })),
  })
  console.log(`  home sections: ${HOME_SECTIONS.length}`)
}

async function seedSynonyms() {
  for (const synonym of SYNONYMS) {
    await db.searchSynonym.upsert({ where: { term: synonym.term }, create: synonym, update: {} })
  }
  console.log(`  synonyms: ${SYNONYMS.length}`)
}

async function main() {
  console.log(`Seeding (${env.NODE_ENV})`)
  await seedSuperAdmin()
  await seedTaxonomy()
  await seedAreas()
  await seedPlans()
  await seedSettings()
  await seedHomeSections()
  await seedSynonyms()
  console.log('Seed complete')
}

main()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
