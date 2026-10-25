// Idempotent seed (Part 5 §6). Every row is created only when missing, so re-running the seed
// never overwrites what Admin has edited since.
import bcrypt from 'bcryptjs'
import { db } from '../src/config/db.js'
import { env } from '../src/config/env.js'
import { slugify } from '../src/lib/slug.js'
import { setAreaCenter } from '../src/services/geo.js'

const BCRYPT_COST = 12

// ---------- Taxonomy (Part 1 §3) ----------

const GROUPS = [
  {
    nameEn: 'Eat & Drink',
    nameNe: 'खानपान',
    icon: 'utensils',
    categories: [
      ['Restaurants', 'रेस्टुरेन्ट'],
      ['Cafes', 'क्याफे'],
      ['Bars & Nightlife', 'बार तथा नाइटलाइफ'],
      ['Bakeries', 'बेकरी'],
      ['Food Delivery Apps', 'खाना डेलिभरी एप'],
      ['Groceries & Marts', 'किराना तथा मार्ट'],
    ],
  },
  {
    nameEn: 'Get Around',
    nameNe: 'यातायात',
    icon: 'car',
    categories: [
      ['Ride Apps', 'राइड एप'],
      ['Taxis', 'ट्याक्सी'],
      ['Bus Tickets', 'बस टिकट'],
      ['Domestic Flights', 'आन्तरिक उडान'],
      ['Car & Bike Rental', 'कार तथा बाइक भाडा'],
    ],
  },
  {
    nameEn: 'Stay',
    nameNe: 'बसोबास',
    icon: 'bed-double',
    categories: [
      ['Hotels', 'होटल'],
      ['Hostels', 'होस्टल'],
      ['Homestays', 'होमस्टे'],
    ],
  },
  {
    nameEn: 'Essentials',
    nameNe: 'आवश्यक सेवा',
    icon: 'smartphone',
    categories: [
      ['SIM & Mobile', 'सिम तथा मोबाइल'],
      ['Home Internet', 'घरको इन्टरनेट'],
      ['Wallets & Payments', 'वालेट तथा भुक्तानी'],
      ['Money Exchange & ATMs', 'मनी एक्सचेन्ज तथा एटीएम'],
      ['Courier', 'कुरियर'],
    ],
  },
  {
    nameEn: 'Health & Wellness',
    nameNe: 'स्वास्थ्य तथा तन्दुरुस्ती',
    icon: 'heart-pulse',
    categories: [
      ['Hospitals', 'अस्पताल'],
      ['Clinics', 'क्लिनिक'],
      ['Pharmacies', 'औषधि पसल'],
      ['Labs', 'प्रयोगशाला'],
      ['Dentists', 'दन्त चिकित्सक'],
      ['Spa & Massage', 'स्पा तथा मसाज'],
      ['Gyms', 'जिम'],
      ['Yoga', 'योग'],
    ],
  },
  {
    nameEn: 'Shopping',
    nameNe: 'किनमेल',
    icon: 'shopping-bag',
    categories: [
      ['Online Shopping', 'अनलाइन किनमेल'],
      ['Malls', 'मल'],
      ['Electronics', 'इलेक्ट्रोनिक्स'],
      ['Souvenirs & Handicrafts', 'स्मृतिचिन्ह तथा हस्तकला'],
      ['Trekking Gear', 'ट्रेकिङ सामग्री'],
      ['Thrift & Second-hand', 'थ्रिफ्ट तथा सेकेन्ड-ह्यान्ड'],
    ],
  },
  {
    nameEn: 'Things To Do',
    nameNe: 'घुमफिर तथा मनोरञ्जन',
    icon: 'landmark',
    categories: [
      ['Heritage Sites', 'सम्पदा स्थल'],
      ['Viewpoints & Hikes', 'दृश्यस्थल तथा पदयात्रा'],
      ['Tours & Activities', 'भ्रमण तथा गतिविधि'],
      ['Movies', 'चलचित्र'],
      ['Event Tickets', 'कार्यक्रम टिकट'],
      ['Classes & Workshops', 'कक्षा तथा कार्यशाला'],
    ],
  },
  {
    nameEn: 'Home Services',
    nameNe: 'घरायसी सेवा',
    icon: 'wrench',
    categories: [
      ['Home Service Apps', 'घरायसी सेवा एप'],
      ['Plumbers', 'प्लम्बर (धारा मिस्त्री)'],
      ['Electricians', 'इलेक्ट्रिसियन (बिजुली मिस्त्री)'],
      ['AC & Appliance Repair', 'एसी तथा उपकरण मर्मत'],
      ['Cleaning & Pest Control', 'सरसफाइ तथा कीट नियन्त्रण'],
      ['Movers', 'सरसामान ढुवानी'],
      ['Painters & Carpenters', 'रङरोगन तथा सिकर्मी'],
    ],
  },
  {
    nameEn: 'Services & Events',
    nameNe: 'सेवा तथा कार्यक्रम',
    icon: 'briefcase',
    categories: [
      ['Lawyers', 'वकिल'],
      ['Accountants', 'लेखापाल'],
      ['IT & Web', 'आईटी तथा वेब'],
      ['Printing', 'छपाइ'],
      ['Education & Language', 'शिक्षा तथा भाषा'],
      ['Party Venues', 'पार्टी भेन्यु'],
      ['Photographers', 'फोटोग्राफर'],
      ['Decorators & Catering', 'सजावट तथा क्याटरिङ'],
      ['Property & Rentals', 'घरजग्गा तथा भाडा'],
      ['Auto Service', 'सवारी मर्मत'],
      ['Pets & Vets', 'घरपालुवा जनावर तथा पशु चिकित्सक'],
    ],
  },
  {
    nameEn: 'Emergency',
    nameNe: 'आपतकालीन',
    icon: 'siren',
    categories: [
      ['Hotlines', 'हटलाइन'],
      ['24h Hospitals', '२४ घण्टे अस्पताल'],
      ['Tourist Police', 'पर्यटक प्रहरी'],
    ],
  },
]

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

// Centre points are approximate neighbourhood centres; Admin can refine them.
const AREAS = [
  ['Thamel', 'ठमेल', 'Kathmandu', 27.7154, 85.3123],
  ['Lazimpat', 'लाजिम्पाट', 'Kathmandu', 27.723, 85.321],
  ['Baluwatar', 'बालुवाटार', 'Kathmandu', 27.729, 85.329],
  ['Boudha', 'बौद्ध', 'Kathmandu', 27.7215, 85.362],
  ['Chabahil', 'चाबहिल', 'Kathmandu', 27.717, 85.346],
  ['Baneshwor', 'बानेश्वर', 'Kathmandu', 27.6915, 85.342],
  ['Koteshwor', 'कोटेश्वर', 'Kathmandu', 27.678, 85.349],
  ['Kalanki', 'कलंकी', 'Kathmandu', 27.6935, 85.281],
  ['Budhanilkantha', 'बूढानीलकण्ठ', 'Kathmandu', 27.778, 85.362],
  ['Kirtipur', 'कीर्तिपुर', 'Kathmandu', 27.678, 85.277],
  ['Patan', 'पाटन', 'Lalitpur', 27.673, 85.325],
  ['Jhamsikhel', 'झम्सिखेल', 'Lalitpur', 27.68, 85.308],
  ['Pulchowk', 'पुल्चोक', 'Lalitpur', 27.678, 85.317],
  ['Satdobato', 'सातदोबाटो', 'Lalitpur', 27.658, 85.324],
  ['Bhaktapur', 'भक्तपुर', 'Bhaktapur', 27.672, 85.428],
  ['Thimi', 'ठिमी', 'Bhaktapur', 27.68, 85.387],
]

// ---------- Listings (Part 1 §3 examples) ----------
// Brand, app and place stubs are DRAFT with no contact details: Admin completes and publishes
// them. Emergency numbers are public facts, so those go LIVE.

const LISTINGS = [
  // Eat & Drink
  {
    name: 'Foodmandu',
    type: 'APP',
    category: 'food-delivery-apps',
    shortDesc: 'Food delivery app for restaurants across Kathmandu Valley',
  },
  {
    name: 'Pathao Food',
    type: 'APP',
    category: 'food-delivery-apps',
    shortDesc: 'Food delivery inside the Pathao app',
  },
  { name: 'Bhoj', type: 'APP', category: 'food-delivery-apps', shortDesc: 'Food delivery app' },
  { name: 'Foodganj', type: 'APP', category: 'food-delivery-apps', shortDesc: 'Food delivery app' },
  {
    name: 'Bhat-Bhateni',
    type: 'BUSINESS',
    category: 'groceries-and-marts',
    shortDesc: 'Supermarket chain',
  },
  {
    name: 'Foodmandu OneMart',
    type: 'APP',
    category: 'groceries-and-marts',
    shortDesc: 'Online grocery delivery from Foodmandu',
  },
  {
    name: 'My Mart',
    type: 'BUSINESS',
    category: 'groceries-and-marts',
    shortDesc: 'Groceries and daily essentials',
  },
  {
    name: 'Metrotarkari',
    type: 'APP',
    category: 'groceries-and-marts',
    shortDesc: 'Online vegetable and grocery delivery',
  },
  // Get Around
  {
    name: 'Pathao',
    type: 'APP',
    category: 'ride-apps',
    shortDesc: 'Ride-hailing app for bikes and cars, plus food and parcel delivery',
  },
  {
    name: 'InDrive',
    type: 'APP',
    category: 'ride-apps',
    shortDesc: 'Ride-hailing app where riders offer their own fare',
  },
  {
    name: 'Uber',
    type: 'APP',
    category: 'ride-apps',
    shortDesc: 'Ride-hailing app for cars and bikes',
  },
  { name: 'Tootle', type: 'APP', category: 'ride-apps', shortDesc: 'Bike ride-sharing app' },
  { name: 'Taximandu', type: 'APP', category: 'ride-apps', shortDesc: 'Taxi booking app' },
  { name: 'BusSewa', type: 'APP', category: 'bus-tickets', shortDesc: 'Online bus ticket booking' },
  { name: 'GoMyGo', type: 'APP', category: 'bus-tickets', shortDesc: 'Online bus ticket booking' },
  {
    name: 'Buddha Air',
    type: 'BUSINESS',
    category: 'domestic-flights',
    shortDesc: 'Domestic airline with flights across Nepal',
  },
  {
    name: 'Yeti Airlines',
    type: 'BUSINESS',
    category: 'domestic-flights',
    shortDesc: 'Domestic airline with flights across Nepal',
  },
  {
    name: 'Nepal Airlines',
    type: 'BUSINESS',
    category: 'domestic-flights',
    shortDesc: 'National airline with domestic and international flights',
  },
  // Essentials
  {
    name: 'Ncell',
    type: 'BUSINESS',
    category: 'sim-and-mobile',
    shortDesc: 'Mobile network: SIM cards, data and calls',
  },
  {
    name: 'Nepal Telecom',
    type: 'BUSINESS',
    category: 'sim-and-mobile',
    shortDesc: 'State telecom: mobile SIM, landline and internet',
  },
  {
    name: 'WorldLink',
    type: 'BUSINESS',
    category: 'home-internet',
    shortDesc: 'Fibre home internet provider',
  },
  {
    name: 'Vianet',
    type: 'BUSINESS',
    category: 'home-internet',
    shortDesc: 'Fibre home internet provider',
  },
  {
    name: 'NTC FTTH',
    type: 'BUSINESS',
    category: 'home-internet',
    shortDesc: 'Nepal Telecom fibre-to-the-home internet',
  },
  {
    name: 'eSewa',
    type: 'APP',
    category: 'wallets-and-payments',
    shortDesc: 'Digital wallet for payments, bills and top-ups',
  },
  {
    name: 'Khalti',
    type: 'APP',
    category: 'wallets-and-payments',
    shortDesc: 'Digital wallet for payments, bills and top-ups',
  },
  {
    name: 'Namaste Pay',
    type: 'APP',
    category: 'wallets-and-payments',
    shortDesc: 'Digital wallet',
  },
  {
    name: 'Fonepay',
    type: 'APP',
    category: 'wallets-and-payments',
    shortDesc: 'QR payment network used by bank apps',
  },
  // Health & Wellness
  {
    name: 'CIWEC Hospital',
    type: 'BUSINESS',
    category: 'hospitals',
    area: 'lazimpat',
    shortDesc: 'Hospital and travel medicine centre',
  },
  {
    name: 'Grande International Hospital',
    type: 'BUSINESS',
    category: 'hospitals',
    shortDesc: 'Private multi-speciality hospital',
  },
  {
    name: 'Norvic International Hospital',
    type: 'BUSINESS',
    category: 'hospitals',
    shortDesc: 'Private multi-speciality hospital',
  },
  {
    name: 'Nepal Mediciti',
    type: 'BUSINESS',
    category: 'hospitals',
    shortDesc: 'Private multi-speciality hospital',
  },
  // Shopping
  {
    name: 'Daraz',
    type: 'APP',
    category: 'online-shopping',
    shortDesc: 'Online marketplace for electronics, fashion and home goods',
  },
  {
    name: 'Sastodeal',
    type: 'APP',
    category: 'online-shopping',
    shortDesc: 'Online shopping store',
  },
  // Things To Do
  {
    name: 'Kathmandu Durbar Square',
    type: 'PLACE',
    category: 'heritage-sites',
    shortDesc: 'Historic royal palace square, UNESCO World Heritage Site',
  },
  {
    name: 'Patan Durbar Square',
    type: 'PLACE',
    category: 'heritage-sites',
    area: 'patan',
    shortDesc: 'Palace square and temples, UNESCO World Heritage Site',
  },
  {
    name: 'Bhaktapur Durbar Square',
    type: 'PLACE',
    category: 'heritage-sites',
    area: 'bhaktapur',
    shortDesc: 'Medieval palace square, UNESCO World Heritage Site',
  },
  {
    name: 'Swayambhu',
    type: 'PLACE',
    category: 'heritage-sites',
    shortDesc: 'Hilltop stupa overlooking the valley, UNESCO World Heritage Site',
  },
  {
    name: 'Boudha',
    type: 'PLACE',
    category: 'heritage-sites',
    area: 'boudha',
    shortDesc: 'Great stupa and Tibetan Buddhist centre, UNESCO World Heritage Site',
  },
  {
    name: 'Pashupatinath',
    type: 'PLACE',
    category: 'heritage-sites',
    shortDesc: 'Hindu temple complex on the Bagmati River, UNESCO World Heritage Site',
  },
  {
    name: 'Chandragiri',
    type: 'PLACE',
    category: 'viewpoints-and-hikes',
    shortDesc: 'Hilltop viewpoint reached by cable car',
  },
  { name: 'QFX Cinemas', type: 'BUSINESS', category: 'movies', shortDesc: 'Cinema chain' },
  { name: 'Big Movies', type: 'BUSINESS', category: 'movies', shortDesc: 'Cinema chain' },
  {
    name: 'Cine de Chef',
    type: 'BUSINESS',
    category: 'movies',
    shortDesc: 'Cinema with in-seat dining',
  },
  { name: 'BSR Movies', type: 'BUSINESS', category: 'movies', shortDesc: 'Cinema' },
  {
    name: 'Khalti Events',
    type: 'APP',
    category: 'event-tickets',
    shortDesc: 'Event tickets in the Khalti app',
  },
  {
    name: 'eTicketNepal',
    type: 'APP',
    category: 'event-tickets',
    shortDesc: 'Online event ticketing',
  },
  // Home Services
  {
    name: 'Bhetayo',
    type: 'APP',
    category: 'home-service-apps',
    shortDesc: 'Home service booking app',
  },
  {
    name: 'Sajilo Sewa',
    type: 'APP',
    category: 'home-service-apps',
    shortDesc: 'Home service booking app',
  },
  {
    name: 'Sewa App',
    type: 'APP',
    category: 'home-service-apps',
    shortDesc: 'Home service booking app',
  },
  // Emergency (LIVE)
  {
    name: 'Police',
    slug: 'police-100',
    type: 'HOTLINE',
    category: 'hotlines',
    phone: '100',
    live: true,
    shortDesc: 'Nepal Police emergency number',
  },
  {
    name: 'Fire',
    slug: 'fire-101',
    type: 'HOTLINE',
    category: 'hotlines',
    phone: '101',
    live: true,
    shortDesc: 'Fire brigade emergency number',
  },
  {
    name: 'Ambulance',
    slug: 'ambulance-102',
    type: 'HOTLINE',
    category: 'hotlines',
    phone: '102',
    live: true,
    shortDesc: 'Ambulance emergency number',
  },
  {
    name: 'Tourist Police',
    slug: 'tourist-police-1144',
    type: 'HOTLINE',
    category: 'tourist-police',
    phone: '1144',
    live: true,
    shortDesc: 'Tourist Police helpline for visitors',
  },
]

// ---------- Plans, settings, home sections, synonyms ----------

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

async function createCategoryIfMissing(data) {
  return db.category.upsert({ where: { slug: data.slug }, create: data, update: {} })
}

async function seedTaxonomy() {
  let count = 0
  for (const [groupIndex, group] of GROUPS.entries()) {
    const parent = await createCategoryIfMissing({
      kind: 'DIRECTORY',
      slug: slugify(group.nameEn),
      nameEn: group.nameEn,
      nameNe: group.nameNe,
      icon: group.icon,
      sortOrder: groupIndex,
    })
    for (const [index, [nameEn, nameNe]] of group.categories.entries()) {
      await createCategoryIfMissing({
        kind: 'DIRECTORY',
        parentId: parent.id,
        slug: slugify(nameEn),
        nameEn,
        nameNe,
        sortOrder: index,
      })
      count += 1
    }
  }
  for (const [index, [nameEn, nameNe, icon]] of MARKET_CATEGORIES.entries()) {
    await createCategoryIfMissing({
      kind: 'MARKET',
      slug: `market-${slugify(nameEn)}`,
      nameEn,
      nameNe,
      icon,
      sortOrder: index,
    })
  }
  console.log(
    `  categories: ${GROUPS.length} groups, ${count} directory, ${MARKET_CATEGORIES.length} market`,
  )
}

async function seedAreas() {
  for (const [index, [nameEn, nameNe, district, lat, lng]] of AREAS.entries()) {
    await db.$transaction(async (tx) => {
      const slug = slugify(nameEn)
      const existing = await tx.area.findUnique({ where: { slug } })
      if (existing) return
      const area = await tx.area.create({
        data: { slug, nameEn, nameNe, district, sortOrder: index },
      })
      await setAreaCenter(tx, area.id, { lat, lng })
    })
  }
  console.log(`  areas: ${AREAS.length}`)
}

async function seedListings() {
  const categories = new Map(
    (await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  )
  const areas = new Map(
    (await db.area.findMany({ select: { id: true, slug: true } })).map((a) => [a.slug, a.id]),
  )

  let created = 0
  for (const listing of LISTINGS) {
    const slug = listing.slug ?? slugify(listing.name)
    const categoryId = categories.get(listing.category)
    if (!categoryId)
      throw new Error(`seed: unknown category ${listing.category} for ${listing.name}`)

    const existing = await db.business.findUnique({ where: { slug }, select: { id: true } })
    if (existing) continue

    await db.business.create({
      data: {
        slug,
        name: listing.name,
        type: listing.type,
        shortDesc: listing.shortDesc,
        phone: listing.phone ?? null,
        areaId: listing.area ? areas.get(listing.area) : null,
        status: listing.live ? 'LIVE' : 'DRAFT',
        categories: { create: { categoryId, isPrimary: true } },
      },
    })
    created += 1
  }
  console.log(`  listings: ${LISTINGS.length} (${created} created)`)
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
  await seedListings()
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
