# All Things Kathmandu: Build Specification

Single source of truth for building allthingskathmandu.com. Version 1.0, 25 Oct 2026.

## Contents

- Part 0: Instructions for the AI agent
- Part 1: Product
- Part 2: Project rules
- Part 3: Architecture
- Part 4: Design (UI/UX)
- Part 5: Database
- Part 6: API
- Part 7: Environment variables
- Part 8: Deployment
- Part 9: Build phases
- Appendix: Accounts and packages

---

# Part 0: Instructions for the AI agent

1. Read Parts 1 to 8 fully before writing any code.
2. Build in the order of Part 9, one phase at a time. A phase is done only when the build passes, its tests pass and it is committed. Report what was built and anything left open, then continue with the next phase.
3. In the first phase, save this file in the repo as `docs/SPEC.md` and create `CLAUDE.md` at the repo root from Part 2, so later sessions have the same rules.
4. Do not change the stack in Part 2, rename structure from Part 3 §13, or add features that are not in this spec. Do not leave TODO stubs.
5. If something in this spec is ambiguous, contradicts itself, or does not work with the current version of a library, stop and ask with a short list of options instead of guessing.
6. Versions here are current as of Oct 2026 (Next.js 16, Node 24 LTS, Prisma 7, Express 5, Tailwind 4). Check the official docs for Next.js, Prisma, Khalti and eSewa before implementing the parts that depend on them.
7. Never commit secrets. Use the variable names in Part 7.

---

# Part 1: Product

## 1. What it is

All Things Kathmandu is a directory of local businesses, services, places, events and second-hand items for Kathmandu Valley (Kathmandu, Lalitpur, Bhaktapur, Kirtipur). The model is a vetted local directory with events and paid partner tiers, similar to allthingstyler.com.

- Audience: visitors to Kathmandu first, locals second.
- It is a directory, not a travel guide. A user picks a need and compares every option side by side. Example: Get Around → Ride Apps shows Pathao, InDrive, Uber, Tootle and Taximandu, each with Download buttons.
- The site defines the categories. Admin controls every category, listing, page and homepage block. Nothing on the public site is hardcoded.
- Three logged-in areas: Member, Business portal, Admin panel.

## 2. Listing format

| Field | Basic | Featured |
| --- | --- | --- |
| Name, logo | ✓ | ✓ |
| Short description (1 to 2 lines, max 120 chars) | ✓ | ✓ |
| Map location (pin), category, area | ✓ | ✓ |
| Contact buttons: Call, WhatsApp, Website (apps: Play Store, App Store) | ✓ | ✓ |
| Photo gallery | | ✓ |
| Videos (YouTube / Reels embed) | | ✓ |
| Offers | | ✓ |
| Top placement in category (max 2 per page, labelled) and homepage spot | | ✓ |

## 3. Taxonomy (seed)

Three levels: Group (homepage icon) → Category (own page) → Tag (filter chips). Seed these 10 groups and their categories; Admin can change them later.

| Group | Categories | Example listings to seed |
| --- | --- | --- |
| Eat & Drink | Restaurants, Cafes, Bars & Nightlife, Bakeries, Food Delivery Apps, Groceries & Marts | Foodmandu, Pathao Food, Bhoj, Foodganj; Bhat-Bhateni, Foodmandu OneMart, My Mart, Metrotarkari |
| Get Around | Ride Apps, Taxis, Bus Tickets, Domestic Flights, Car & Bike Rental | Pathao, InDrive, Uber (confirm it operates in Kathmandu first), Tootle, Taximandu; BusSewa, GoMyGo; Buddha Air, Yeti Airlines, Nepal Airlines |
| Stay | Hotels, Hostels, Homestays | Local businesses |
| Essentials | SIM & Mobile, Home Internet, Wallets & Payments, Money Exchange & ATMs, Courier | Ncell, Nepal Telecom; WorldLink, Vianet, NTC FTTH; eSewa, Khalti, Namaste Pay, Fonepay |
| Health & Wellness | Hospitals, Clinics, Pharmacies, Labs, Dentists, Spa & Massage, Gyms, Yoga | CIWEC, Grande International, Norvic, Nepal Mediciti |
| Shopping | Online Shopping, Malls, Electronics, Souvenirs & Handicrafts, Trekking Gear, Thrift & Second-hand | Daraz, Sastodeal |
| Things To Do | Heritage Sites, Viewpoints & Hikes, Tours & Activities, Movies, Event Tickets, Classes & Workshops | Kathmandu, Patan and Bhaktapur Durbar Squares, Swayambhu, Boudha, Pashupatinath, Chandragiri; QFX Cinemas, Big Movies, Cine de Chef, BSR Movies; Khalti Events, eTicketNepal |
| Home Services | Home Service Apps, Plumbers, Electricians, AC & Appliance Repair, Cleaning & Pest Control, Movers, Painters & Carpenters | Bhetayo, Sajilo Sewa, Sewa App |
| Services & Events | Lawyers, Accountants, IT & Web, Printing, Education & Language, Party Venues, Photographers, Decorators & Catering, Property & Rentals, Auto Service, Pets & Vets | Local businesses |
| Emergency | Hotlines, 24h Hospitals, Tourist Police | Police 100, Fire 101, Ambulance 102, Tourist Police 1144 |

Market categories (kind MARKET, used by the second-hand marketplace): Electronics, Mobiles, Furniture, Clothing, Vehicles, Books, Home & Kitchen, Sports, Other.

Areas: Thamel, Lazimpat, Baluwatar, Boudha, Chabahil, Baneshwor, Koteshwor, Kalanki, Budhanilkantha, Kirtipur, Patan, Jhamsikhel, Pulchowk, Satdobato, Bhaktapur, Thimi.

## 4. Plans

| Plan | Price | Includes |
| --- | --- | --- |
| Basic | Free at launch (Admin may set Rs 500 to 1,000/mo later) | Everything in the Basic column above |
| Featured | Rs 3,000 to 5,000/mo, set in Admin before activation | Basic + photos, videos, offers, top placement, homepage spot |

Prices live in the `plans` table and are edited in Admin. Payments in NPR through Khalti and eSewa.

## 5. Launch content and phases

- Phase 1: directory, search, accounts, Business portal, Admin, plans and payments, reviews, reports.
- Phase 2: events calendar and the second-hand marketplace.
- Content order: app and brand listings first (quick to add), then local businesses area by area starting with Thamel, Patan and Boudha. Admin can bulk import listings from CSV.
- Owners claim existing listings (phone or document proof, Admin approves).

---

# Part 2: Project rules

Save this part as `CLAUDE.md` at the repo root.

Full spec: `docs/SPEC.md`. Read Part 3 (Architecture) before changing structure, caching or infrastructure; Part 5 (Database) before touching `prisma/`; Part 6 (API) before adding or changing a route; Part 4 (Design) before building UI.

## Stack (do not swap without asking)

| Layer | Tool | Host |
| --- | --- | --- |
| Client | Next.js 16 App Router, React 19, JavaScript, Tailwind 4, TanStack Query 5, Zustand, axios, react-hook-form, zod | Vercel |
| API | Node 24 LTS, Express 5 (ESM), Zod, JWT, bcryptjs, helmet, cors, cookie-parser, express-rate-limit + rate-limit-redis, winston | Render web service |
| Worker | BullMQ (same codebase as API) | Render background worker |
| Database | PostgreSQL with PostGIS and pg_trgm, Prisma 7 with `@prisma/adapter-pg` | Neon (`main` and `dev` branches) |
| Cache and queue | Valkey via ioredis | Render Key Value |
| Files | Cloudinary, signed direct uploads from the browser | Cloudinary |
| Email | Nodemailer + SMTP | Email provider |
| Payments | Khalti, eSewa | Khalti / eSewa |
| Maps | Google Maps JavaScript API | Google Cloud |
| Errors | Sentry | Sentry |
| Local dev | Docker Compose (postgis/postgis, valkey) | Local |

## Commands

| Where | Command | Does |
| --- | --- | --- |
| root | `docker compose up -d` | Postgres + PostGIS on 5432, Valkey on 6379 |
| server | `npm run dev` | API on http://localhost:5001 |
| server | `npm run worker:dev` | Queue worker |
| server | `npm run db:migrate` | `prisma migrate dev --create-only`, review the SQL, then apply (local or Neon `dev` branch only) |
| server | `npm run db:seed` | Seed super admin, groups, categories, areas, plans |
| server | `npm run db:generate` | `prisma generate` |
| server | `npm test` | Vitest + Supertest |
| client | `npm run dev` | Web on http://localhost:3000 |
| client | `npm run build` | Production build; must pass before every PR |

## Layer rules

- Server: route → middleware → validator → controller → service/Prisma. Routes hold no logic. Controllers hold no reusable logic.
- Reads that can tolerate slight lag use `readDb` (replica when configured). Writes and read-after-write use `db`.
- Anything slow goes on a BullMQ queue, never inline in a request: email, image processing, cache purge, page revalidation, stats flush, search sync.
- Public read endpoints go through `cache.middleware` (Redis, TTL + delete on write).
- Lists use cursor pagination (`?cursor=&limit=`, max 50). No OFFSET on listings.
- Geo queries use `$queryRaw` tagged templates only. Never `$queryRawUnsafe`.

## Client rules

- Components call functions in `src/services/*`, never axios directly.
- `services/api.js`: one axios instance, `withCredentials: true`, access token in memory only, refresh once on 401 with a request queue.
- Server data lives in TanStack Query. Only auth state lives in Zustand.
- Public pages are server components with `generateMetadata`, cached with ISR and tags. Missing content calls `notFound()`.
- Next.js 16 specifics: route protection lives in `src/proxy.js` (not `middleware.js`); `params`, `searchParams`, `cookies()` and `headers()` are async; `revalidateTag(tag, 'max')` takes two arguments.
- `next.config.mjs` `images.remotePatterns`: `res.cloudinary.com` only.
- Tailwind 4: design tokens defined with `@theme` in `src/styles/globals.css`, no `tailwind.config.js`.

## Security defaults (always)

- JWT HS256 pinned; access token 15m in memory; refresh token 7d in httpOnly, Secure, SameSite=Lax cookie, rotated on every refresh, stored hashed in `sessions`.
- `config/env.js` exits on missing secrets, warns under 32 chars, refuses identical access and refresh secrets in production. No `|| 'fallback-secret'` anywhere.
- bcrypt cost 12, email verification before login, no account enumeration on forgot-password, progressive login lockout.
- Admin and Moderator accounts require TOTP 2FA.
- `verifyToken` re-reads the user from the DB. Admin routes: `router.use(verifyToken, requireRole('ADMIN','MODERATOR'))`. Every `/business/listings/:id` route uses `requireOwnership`.
- Paid features are checked against a live `subscriptions` row, never the JWT.
- Guest forms (register, contact, reports) verify a Cloudflare Turnstile token on the server.
- Zod on every input. CMS rich text sanitized with `sanitize-html` on save and rendered from the sanitized copy.
- Uploads: signed Cloudinary upload params issued by the API per request, MIME allowlist, size and count caps from the plan.
- Payments: price read from `plans` on the server; a plan activates only after server-side verification (Khalti lookup API, eSewa status check); `payments.gatewayRef` unique for idempotency.
- Errors: generic message for 500s in production; stack traces stay on the server and go to Sentry.
- `robots.js` blocks `/admin`, `/business`, `/account` and token URLs.

## Do not

- Commit `.env` or paste secrets into code or docs.
- Run `prisma migrate dev` against production. Production uses `prisma migrate deploy` from the Render Shell.
- Write a database row per page view. Counters go to Redis and the worker flushes them.
- Proxy file uploads through the API.
- Add features that are not in the docs, or leave TODO stubs for modules the project does not need.

---

# Part 3: Architecture

## 1. What the system does

All Things Kathmandu lists businesses, services, places, events and second-hand items across Kathmandu, Lalitpur and Bhaktapur. Visitors pick a need, compare options as cards and act (call, WhatsApp, map, download, book). Admin controls every category, listing, page and homepage block. Businesses manage their own listings and pay for Featured plans.

Targets the design is built around:
- Public pages load fast on a mid-range phone over 4G (LCP under 2.5 s).
- A traffic spike (a viral post, a festival) lands on caches, not the database.
- One failed instance, a Redis outage or a slow deploy does not take the site down.
- Adding a category, area or homepage section needs no code change.

## 2. System diagram

```mermaid
flowchart TD
    U[Visitors, members, business owners, admins]
    U -->|pages| V[Vercel: Next.js 16<br/>Edge CDN + ISR]
    U -->|signed uploads| C[Cloudinary<br/>images + video, CDN]
    V -->|API calls| CF[Cloudflare proxy<br/>WAF, DDoS, bot rules]
    CF --> A[Render: API service<br/>Express 5, 2+ instances]
    A -->|cache, rate limits, jobs| R[(Render Key Value<br/>Valkey)]
    A -->|writes| P[(Neon primary<br/>PostGIS, pg_trgm)]
    A -->|reads| RR[(Neon read replica)]
    A <-->|initiate + verify| PAY[Khalti / eSewa]
    R -->|jobs| W[Render: worker<br/>BullMQ]
    W --> P
    W -->|revalidate tags| V
    W --> M[SMTP email]
    W --> C
```

## 3. Components

| Component | Role | Notes |
| --- | --- | --- |
| Vercel (Next.js 16) | Public site, Member, Business and Admin areas | Public pages are server-rendered once and cached at the edge (ISR with tags) |
| Cloudflare | DNS for the domain, proxy for `api.` | WAF, DDoS, bot filtering; apex record stays DNS-only for Vercel |
| Render API | All reads and writes, auth, validation | Stateless, horizontally scaled, zero-downtime deploys via `/health` |
| Render worker | Everything slow | Emails, image jobs, cache purge, revalidation, stats flush, renewals, expiry |
| Render Key Value | Shared cache, rate-limit counters, BullMQ queues | `noeviction`; every cache key has a TTL |
| Neon | Source of truth | Primary for writes, read replica from stage 2, pooled connections |
| Cloudinary | Logos, photos, videos | Browser uploads directly with a signature from the API |
| Khalti, eSewa | Plan payments in NPR | Verified server-side before activation |
| Sentry, uptime monitor | Errors and availability | Alerts by email |

## 4. Request flows

**Public page (home, category, listing).** Vercel serves the cached HTML. On a cache miss, the server component calls the API (`INTERNAL_API_ORIGIN`), which answers from Redis or the replica. Pages are tagged (`listing:<id>`, `category:<id>`, `home`).

**Search.** Client calls `/public/search?q=&area=&near=`. API expands synonyms (Admin-managed), runs Postgres full-text + trigram ranking, filters by area or distance (PostGIS), returns 20 results with a cursor. Popular queries are cached in Redis for 2 minutes.

**Near me.** Browser sends lat/lng (with permission). API runs `ST_DWithin` on the GiST index and sorts by distance.

**Business edits listing.** API checks ownership, validates, writes in a transaction, writes `audit_logs`, then queues `purge-cache` and `revalidate` jobs. The owner's dashboard reads through TanStack Query and shows the change at once; the public page refreshes on the next request (stale-while-revalidate).

**Media upload.** Client asks `/business/media/sign` → API checks plan limits and returns signed params → browser uploads to Cloudinary → client posts the result to `/business/media` → API saves the row.

**Plan payment (Khalti).** Owner picks a plan → API reads the price from `plans` and calls Khalti initiate → owner pays on Khalti → return page sends `pidx` to `/payments/khalti/verify` → API calls the Khalti lookup API, checks status and amount, then activates the subscription in one transaction. `gatewayRef` is unique, so a repeated callback does nothing.

**Plan payment (eSewa).** API builds and signs the form fields (HMAC SHA-256) → browser posts to eSewa → success page sends the returned data to `/payments/esewa/verify` → API checks the signature and calls the eSewa status check before activating.

**Marketplace post.** Member submits an item with photos → status `PENDING` → moderator approves → live for 30 days → worker expires it and emails the seller.

## 5. Caching

| Layer | Holds | Lifetime | Cleared by |
| --- | --- | --- | --- |
| Vercel ISR | Public pages | Fallback revalidate 1 h | Worker calls `/api/revalidate` with tags after any change |
| Redis | Category tree, home sections, listing detail, first page of each category, popular searches | 2 to 60 min | Key delete by tag set on write |
| Cloudinary CDN | Images and video | Long | New `public_id` on replace |
| Browser | JS, CSS, fonts | Immutable | Hashed filenames |

If Redis is down, the API skips the cache and reads from the database. If the API is down, cached public pages keep serving.

## 6. Modules

| Module | Phase | Covers |
| --- | --- | --- |
| Directory | 1 | Groups, categories, tags, areas, listings, hours, map, contact buttons |
| Search | 1 | Full-text + trigram, synonyms (English and Nepali), area and distance filters |
| Accounts | 1 | Register, login, email verification, Google sign-in (optional), sessions |
| Business portal | 1 | Claim, edit listing, media, offers, stats, plan and invoices |
| Admin and CMS | 1 | Everything in Part 6 §7: listings, moderation queues, taxonomy, homepage builder, pages, plans, settings, audit log |
| Plans and payments | 1 | Basic and Featured, Khalti and eSewa, renewal reminders, downgrade on expiry |
| Reviews | 1 | One per member per listing, moderated |
| Reports | 1 | "Report wrong info" queue |
| Events | 2 | Calendar, business and member submissions, moderation |
| Marketplace | 2 | Second-hand and thrift items posted by members, moderated, 30-day expiry, contact by phone/WhatsApp (no checkout) |
| Analytics | 1 | Views, calls, WhatsApp, map clicks per listing per day |

Thrift shops and second-hand stores are also a normal directory category, so they appear in both places.

## 7. Roles and permissions

| Action | Guest | Member | Business owner | Moderator | Admin | Super admin |
| --- | --- | --- | --- | --- | --- | --- |
| Browse, search | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Save, review, report | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Post marketplace items | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Claim a listing | | ✓ | ✓ | | | |
| Edit own listing, media, plan | | | ✓ | | | |
| Moderate reviews, reports, market items, events | | | | ✓ | ✓ | ✓ |
| Create and edit any listing | | | | | ✓ | ✓ |
| Categories, areas, homepage, pages, plans, settings | | | | | ✓ | ✓ |
| Manage users and roles, view audit log | | | | | | ✓ |

A member becomes a business owner when a claim is approved or Admin assigns a listing. Permissions are enforced in the API; the client only hides what a role cannot use.

## 8. Directory model

- **Taxonomy:** Group (8 to 10, homepage icons) → Category (own page) → Tag (filter chips). Stored as one `categories` tree plus `tags`, edited in Admin.
- **Listing card:** logo, name, one-line description, area and distance, one main button. Photos and videos only on the detail page and only for Featured.
- **Ranking:** distance (when known) + text relevance + profile completeness. At most 2 Featured cards per results page, always labelled.
- **Visibility:** a category shows publicly only with 5 or more live listings (`liveCount`, kept by the worker).
- **Reserved slugs:** group slugs cannot be `search`, `events`, `market`, `listing`, `account`, `business`, `admin`, `api`, `about`, `contact`, `terms`, `privacy`, `refund`, `login`, `register`.

## 9. Reliability

- API runs 2+ instances behind Render's load balancer with autoscaling on CPU and memory.
- `/health` checks DB and Redis; Render only switches traffic to a new deploy after it passes.
- Timeouts on every outbound call: DB 5 s, Redis 500 ms, payment gateways 10 s, email via queue.
- Graceful shutdown: stop accepting requests, finish in-flight work, close Prisma and Redis.
- BullMQ jobs retry with backoff; failed jobs stay visible for inspection.
- Neon point-in-time restore plus a weekly `pg_dump` stored outside Neon.
- Sentry on client, API and worker; uptime monitor on `/health` and the homepage.
- k6 load test before launch against a target you set (for example p95 under 300 ms at expected peak).

## 10. Security

Defaults are listed in Part 2. Additions at the infrastructure level:
- Cloudflare proxy and WAF on `api.`, SSL mode Full (strict).
- Render Key Value has no external access (empty IP allowlist).
- Neon `main` and `dev` branches with separate credentials; production credentials only in Render.
- Google Maps key restricted by HTTP referrer; Cloudinary uploads only with API-issued signatures.
- Separate admin login page with TOTP; admin sessions listed and revocable.

## 11. Scaling path

| Stage | Signal | Change |
| --- | --- | --- |
| 1. Launch | First listings | Vercel Pro, Render API x2, worker, Key Value, Neon autoscaling, Cloudinary |
| 2. Growth | DB CPU or read latency rising | Neon read replica (`DATABASE_REPLICA_URL`), raise autoscale limits |
| 3. Scale | Search slow or needs tuning | Meilisearch or Typesense synced by the worker; partition `listing_stats_daily` by month |

Each stage is a config change, not a rewrite.

## 12. Decisions that differ from the standard scaffold

| Area | Scaffold default | This project | Reason |
| --- | --- | --- | --- |
| Next.js | 14 | 16 | 14 reached end of life Oct 2025 and 15 on 21 Oct 2026; 16 is the only supported line |
| Node | 20 | 24 LTS | Node 20 reached end of life 30 Apr 2026 |
| Prisma | `url` + `directUrl` in schema, `@prisma/client` | Prisma 7: `prisma.config.ts` uses `DIRECT_URL` for the CLI; runtime uses `@prisma/adapter-pg` with pooled `DATABASE_URL`; `prisma-client` generator with an `output` path | Prisma 7 moved datasource config out of the schema and requires a driver adapter |
| Running the server | `node index.js` | `tsx index.js` | Prisma 7's generator emits TypeScript; app code stays JavaScript |
| Express | Express | Express 5 | Current major |
| Tailwind | `tailwind.config.js` | Tailwind 4, `@theme` in CSS | Current major |
| Route guards | `ProtectedRoute`, `AdminRoute` | `proxy.js` redirects + API role checks | Next 16 replaced `middleware.js` with `proxy.js` |
| Payments | Stripe + PayPal webhooks | Khalti + eSewa with server-side verification | Businesses pay in NPR |
| Uploads | multer, local disk fallback | Signed direct Cloudinary uploads | Files never pass through the API |
| Jobs | `jobs/cron.js` in the API | BullMQ worker on Render Key Value | Jobs survive restarts and do not slow requests |
| Redis | Local dev only | Production cache, rate limits, queues | Needed once the API runs on 2+ instances |
| Roles | user, admin | member, business owner, moderator, admin, super admin | Three portals |
| Database | Plain Postgres | PostGIS + pg_trgm | Distance sort and typo-tolerant search |
| Blog | `blog/[slug]` | Not at launch; CMS pages only | Not requested |
| Docker Compose | client, server, postgres, redis | Postgres (PostGIS) and Valkey only; apps run with npm | Faster hot reload |

## 13. Code structure

### Server

```text
server/
├── index.js                 # API entry: validate env, connect DB + Redis, listen on PORT
├── worker.js                # worker entry: BullMQ processors + repeatable jobs
├── prisma.config.ts         # schema path, migrations path, seed command, DIRECT_URL
├── package.json             # "type": "module"
├── .node-version            # 24
├── prisma/
│   ├── schema.prisma
│   ├── migrations/          # first migration enables postgis and pg_trgm
│   └── seed.js
├── scripts/                 # one-off ops scripts (backfills, imports)
└── src/
    ├── app.js               # helmet → trust proxy → HTTPS redirect → CORS(CLIENT_URL) → json → cookies → rate limit → /health → /api/v1 → 404 → errorHandler
    ├── generated/prisma/    # Prisma client output (gitignored, built on deploy)
    ├── config/              # env, db (db + readDb), redis, cloudinary, mailer, cookies, sentry
    ├── routes/              # public, auth, me, business, admin, payments, market (*.routes.js)
    ├── middleware/          # auth, requireRole, ownership, rateLimit, cache, validate, errorHandler
    ├── validators/          # zod schemas
    ├── controllers/         # one per domain
    ├── services/            # cache, search, geo, revalidate, media, email, stats, token, totp, payments/khalti, payments/esewa
    ├── jobs/                # queues.js, processors/, schedules.js
    ├── lib/                 # slug, cursor, hours, sanitize
    └── utils/               # ApiError, ApiResponse, logger
```

### Client

```text
client/
├── next.config.mjs          # images: res.cloudinary.com only
├── package.json             # next pinned to an exact version
├── .node-version            # 24
└── src/
    ├── proxy.js             # redirect logged-out users from /account, /business, /admin
    ├── app/
    │   ├── (public)/        # page.js (home), search/, [group]/, [group]/[category]/, listing/[slug]/, events/, market/, market/[id]/, about/, contact/, terms/, privacy/, refund/
    │   ├── (auth)/          # login/, register/, verify-email/, forgot-password/, reset-password/
    │   ├── (member)/account/        # profile/, saved/, reviews/, market/
    │   ├── (business)/business/     # dashboard/, listing/, media/, offers/, plan/, invoices/
    │   ├── (admin)/admin/           # listings/, claims/, categories/, areas/, tags/, users/, reviews/, reports/, events/, market/, homepage/, pages/, synonyms/, plans/, payments/, media/, seo/, settings/, audit/
    │   ├── api/revalidate/route.js  # tag revalidation, secret protected
    │   └── layout.js, sitemap.js, robots.js, not-found.js, error.js
    ├── components/          # ui/, common/, listing/, search/, map/, market/, business/, admin/
    ├── services/            # api.js + one file per domain
    ├── store/authStore.js
    ├── hooks/
    ├── lib/                 # seo, serverApi, format
    └── styles/globals.css   # Tailwind 4 @theme tokens
```

---

# Part 4: Design (UI/UX)

## 1. Principles

- A directory, not a guide. Each listing is one line plus action buttons; no long articles.
- Any service is reachable in 2 taps from the homepage, or one search.
- Mobile first. Most visitors are on phones, often on weak data.
- English by default, Nepali toggle. Names and categories have `nameNe` fields.
- Show the next action, not decoration: Call, WhatsApp, Directions, Website, Download.

## 2. Navigation

| Place | Contents |
| --- | --- |
| Header (desktop) | Logo, search bar, Market, Events, Saved, Login or account menu, "List your business" |
| Header (mobile) | Logo, search icon, account icon |
| Bottom bar (mobile) | Home, Search, Market, Saved, Account |
| Footer | Emergency numbers (from Settings), About, Contact, Terms, Privacy, Refund, List your business, social links |

## 3. Pages

| Page | Sections, top to bottom |
| --- | --- |
| Home | Search bar with area picker · Group icons (8 to 10) · Open now near you · Featured · Popular this week · Upcoming events · Latest market items · "List your business" banner. Order and visibility set in Admin (homepage builder) |
| Group | Group name · category tiles with listing counts |
| Category | Title + count · filter chips (tags) · Area, Open now, Price, Rating · "More filters" sheet · list/map toggle · cards (20 per load, cursor) |
| Search results | Query, filters, mixed results grouped by category, map toggle, "did you mean" from trigram match |
| Listing detail | Logo, name, verified badge, category, area · action bar (Call, WhatsApp, Directions, Website) · description · hours with Open/Closed now · map · photos and video (Featured) · offers · reviews · Report wrong info · similar nearby |
| Market list | Filters (category, condition, price, area) · item cards with photo, price, area, age |
| Market item | Photos, price, condition, description, area, seller first name, Call/WhatsApp, Report |
| Member account | Profile, Saved, My reviews, My market items |
| Business portal | Dashboard (views, calls, WhatsApp, map clicks, last 30 days) · Edit listing · Hours · Media · Offers · Plan and billing · Invoices |
| Admin | Sidebar per module; tables with search, filters, bulk actions; drag to reorder categories and homepage sections; preview before publish |

## 4. Listing card and detail

| Field | Card | Detail (Basic) | Detail (Featured) |
| --- | --- | --- | --- |
| Logo, name | ✓ | ✓ | ✓ |
| One-line description (max 120 chars) | ✓ | ✓ | ✓ |
| Area + distance | ✓ | ✓ | ✓ |
| Open now | ✓ | ✓ | ✓ |
| Main button (Call or Download) | ✓ | | |
| Action bar (Call, WhatsApp, Directions, Website) | | ✓ | ✓ |
| Map pin | | ✓ | ✓ |
| Full description (max 600 chars) | | ✓ | ✓ |
| Photo gallery | | | ✓ (plan limit) |
| Videos (YouTube / Reels embed) | | | ✓ (plan limit) |
| Offers | | | ✓ |
| "Featured" label + top placement | ✓ | | ✓ |

App-type listings (Pathao, Foodmandu) show Play Store and App Store buttons instead of Call.

## 5. Components (`components/ui` and up)

Button, IconButton, Input, Select, Chip, Badge, Card, Sheet (mobile filters), Dialog, Tabs, Toast, Skeleton, EmptyState, Pagination (load more), Rating, Avatar, ImageGallery, VideoEmbed, MapView, HoursTable, ActionBar, ListingCard, MarketCard, SearchBar, AreaPicker, FilterBar, StatTile, DataTable (admin), RichTextEditor (admin), Uploader (signed Cloudinary).

## 6. Design tokens

Defined once in `src/styles/globals.css` with Tailwind 4 `@theme`, with light and dark values.

| Token group | Values to set |
| --- | --- |
| Color roles | `brand`, `brand-contrast`, `surface`, `surface-raised`, `text`, `text-muted`, `border`, `success` (open now), `warning`, `danger`, `featured` |
| Type scale | 12, 14, 16 (body), 18, 20, 24, 30 px; two weights (400, 600) |
| Spacing | 4 px base: 4, 8, 12, 16, 24, 32, 48 |
| Radius | 8 (cards, inputs), 999 (chips) |
| Elevation | Border first; one soft shadow for sheets and dialogs |
| Breakpoints | 640, 768, 1024, 1280 |

Brand colours and fonts are open. Pick them in Figma first, then copy the values into `@theme`.

## 7. States

Every list and page has: loading (skeleton matching the final layout), empty (one line + one action, e.g. "No listings in this area yet. View all areas"), error (retry button), and offline (cached page notice).

## 8. Accessibility (WCAG 2.1 AA)

- Text contrast 4.5:1, large text 3:1, in both themes.
- Tap targets at least 44 x 44 px; action bar buttons full width on mobile.
- Every image has alt text; the uploader requires it.
- Visible focus rings; all admin tables usable by keyboard.
- Map content also available as text (address, distance).

## 9. Performance budget

| Metric | Target |
| --- | --- |
| LCP (4G, mid-range phone) | < 2.5 s |
| INP | < 200 ms |
| CLS | < 0.1 |
| JS on public pages (gzip) | < 170 KB |
| Card images | Cloudinary `f_auto,q_auto`, sized per breakpoint, lazy below the fold |

The map loads only after the user opens the map view or scrolls to it.

## 10. Copy rules

- Buttons are verbs: Call, WhatsApp, Directions, Website, Download, Save, Report.
- Prices in NPR (`Rs 1,500`).
- Times in 12-hour format with Nepal time.
- No marketing filler in listing descriptions; Admin trims to the limits above.

---

# Part 5: Database

PostgreSQL on Neon, accessed with Prisma 7. Extensions: `postgis` (distance), `pg_trgm` (typo-tolerant search). Region: AWS Singapore. Branches: `main` (production), `dev`.

## 1. Conventions

- IDs: UUID v7 (`@default(uuid(7))`), sortable and safe to expose.
- Tables snake_case via `@@map`; columns camelCase (quote them in raw SQL: `"areaId"`).
- `createdAt`, `updatedAt` on every table; `deletedAt` (soft delete) on user-facing content.
- Money as integer NPR (`priceNpr`). No floats for money.
- PostGIS and `tsvector` columns are `Unsupported(...)` in Prisma: write them with `$executeRaw` in the same transaction as the create/update, read them with `$queryRaw` tagged templates.

## 2. Tables

| Table | Purpose |
| --- | --- |
| users | All accounts and roles |
| sessions | Refresh tokens (hashed), device, expiry, revocation |
| verification_tokens | Email verification and password reset (hashed, single use) |
| categories | Groups and categories in one tree; `kind` = DIRECTORY or MARKET |
| tags | Sub-types shown as filter chips |
| areas | Thamel, Patan, Boudha… with a centre point |
| businesses | Listings (businesses, apps, places, hotlines) |
| business_categories | Listing ↔ category, one primary |
| business_tags | Listing ↔ tag |
| media | Photos and videos per listing |
| offers | Time-limited offers per listing |
| reviews | One per member per listing, moderated |
| saved_listings | Member bookmarks |
| claims | Ownership claims, moderated |
| reports | "Report wrong info" for any entity |
| events | Events calendar (phase 2) |
| market_items, market_item_media | Second-hand marketplace (phase 2) |
| plans, subscriptions, payments | Paid tiers and payment records |
| cms_pages, home_sections, settings | Everything Admin edits |
| search_synonyms | English/Nepali search terms |
| listing_stats_daily | Views and clicks per listing per day |
| audit_logs | Every admin and owner change |

## 3. Prisma schema

`server/prisma/schema.prisma`

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "esm"
}

datasource db {
  provider = "postgresql"
}

// ---------- Enums ----------

enum Role {
  MEMBER
  BUSINESS_OWNER
  MODERATOR
  ADMIN
  SUPER_ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
}

enum TokenType {
  EMAIL_VERIFY
  PASSWORD_RESET
}

enum CategoryKind {
  DIRECTORY
  MARKET
}

enum ListingType {
  BUSINESS
  APP
  PLACE
  HOTLINE
}

enum ListingStatus {
  DRAFT
  PENDING
  LIVE
  SUSPENDED
}

enum MediaType {
  PHOTO
  VIDEO
}

enum ModerationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ReportEntity {
  BUSINESS
  REVIEW
  MARKET_ITEM
  EVENT
}

enum ReportStatus {
  OPEN
  RESOLVED
  DISMISSED
}

enum MarketStatus {
  PENDING
  LIVE
  SOLD
  EXPIRED
  REJECTED
}

enum ItemCondition {
  NEW
  LIKE_NEW
  GOOD
  FAIR
}

enum SubscriptionStatus {
  PENDING
  ACTIVE
  EXPIRED
  CANCELLED
}

enum PaymentGateway {
  KHALTI
  ESEWA
}

enum PaymentStatus {
  INITIATED
  COMPLETED
  FAILED
  REFUNDED
}

enum HomeSectionType {
  GROUPS
  OPEN_NOW
  FEATURED
  POPULAR
  EVENTS
  MARKET
  BANNER
  CUSTOM_LIST
}

// ---------- Accounts ----------

model User {
  id              String     @id @default(uuid(7)) @db.Uuid
  email           String     @unique
  phone           String?    @unique
  passwordHash    String?
  googleId        String?    @unique
  name            String
  avatarUrl       String?
  role            Role       @default(MEMBER)
  status          UserStatus @default(ACTIVE)
  emailVerifiedAt DateTime?
  totpSecret      String?    // encrypted at rest
  totpEnabled     Boolean    @default(false)
  failedLogins    Int        @default(0)
  lockedUntil     DateTime?
  lastLoginAt     DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?

  sessions      Session[]
  tokens        VerificationToken[]
  businesses    Business[]          @relation("BusinessOwner")
  reviews       Review[]
  saved         SavedListing[]
  claims        Claim[]
  marketItems   MarketItem[]
  auditLogs     AuditLog[]

  @@map("users")
}

model Session {
  id        String    @id @default(uuid(7)) @db.Uuid
  userId    String    @db.Uuid
  tokenHash String    @unique
  userAgent String?
  ip        String?
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("sessions")
}

model VerificationToken {
  id        String    @id @default(uuid(7)) @db.Uuid
  userId    String    @db.Uuid
  type      TokenType
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type])
  @@map("verification_tokens")
}

// ---------- Taxonomy ----------

model Category {
  id             String       @id @default(uuid(7)) @db.Uuid
  kind           CategoryKind @default(DIRECTORY)
  parentId       String?      @db.Uuid
  slug           String       @unique
  nameEn         String
  nameNe         String?
  icon           String?
  description    String?
  sortOrder      Int          @default(0)
  isVisible      Boolean      @default(true)
  liveCount      Int          @default(0) // maintained by the worker
  seoTitle       String?
  seoDescription String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  parent      Category?          @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[]         @relation("CategoryTree")
  tags        Tag[]
  businesses  BusinessCategory[]
  marketItems MarketItem[]

  @@index([parentId, sortOrder])
  @@index([kind, isVisible])
  @@map("categories")
}

model Tag {
  id         String   @id @default(uuid(7)) @db.Uuid
  categoryId String?  @db.Uuid
  slug       String   @unique
  nameEn     String
  nameNe     String?
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  category   Category?     @relation(fields: [categoryId], references: [id])
  businesses BusinessTag[]

  @@index([categoryId])
  @@map("tags")
}

model Area {
  id        String                                @id @default(uuid(7)) @db.Uuid
  slug      String                                @unique
  nameEn    String
  nameNe    String?
  district  String                                // Kathmandu | Lalitpur | Bhaktapur
  center    Unsupported("geography(Point, 4326)")?
  sortOrder Int                                   @default(0)
  isVisible Boolean                               @default(true)
  createdAt DateTime                              @default(now())
  updatedAt DateTime                              @updatedAt

  businesses  Business[]
  events      Event[]
  marketItems MarketItem[]

  @@map("areas")
}

// ---------- Listings ----------

model Business {
  id             String                                @id @default(uuid(7)) @db.Uuid
  ownerId        String?                               @db.Uuid
  type           ListingType                           @default(BUSINESS)
  slug           String                                @unique
  name           String
  nameNe         String?
  shortDesc      String                                @db.VarChar(120)
  description    String?                               @db.VarChar(600)
  logoUrl        String?
  logoPublicId   String?
  phone          String?
  whatsapp       String?
  email          String?
  website        String?
  playStoreUrl   String?
  appStoreUrl    String?
  address        String?
  areaId         String?                               @db.Uuid
  location       Unsupported("geography(Point, 4326)")?
  hours          Json?                                 // { mon: [["09:00","18:00"]], ... }
  priceLevel     Int?                                  // 1 to 4
  status         ListingStatus                         @default(DRAFT)
  isVerified     Boolean                               @default(false)
  featuredUntil  DateTime?                             // set from the active subscription by the worker
  profileScore   Int                                   @default(0)
  ratingAvg      Decimal                               @default(0) @db.Decimal(2, 1)
  ratingCount    Int                                   @default(0)
  searchExtra    String?                               // category, tag and area names, set by the worker
  searchVector   Unsupported("tsvector")?              // set by trigger
  seoTitle       String?
  seoDescription String?
  createdAt      DateTime                              @default(now())
  updatedAt      DateTime                              @updatedAt
  deletedAt      DateTime?

  owner         User?              @relation("BusinessOwner", fields: [ownerId], references: [id])
  area          Area?              @relation(fields: [areaId], references: [id])
  categories    BusinessCategory[]
  tags          BusinessTag[]
  media         Media[]
  offers        Offer[]
  reviews       Review[]
  savedBy       SavedListing[]
  claims        Claim[]
  events        Event[]
  subscriptions Subscription[]
  payments      Payment[]
  stats         ListingStatDaily[]

  @@index([ownerId])
  @@index([status, areaId])
  @@index([featuredUntil])
  @@map("businesses")
}

model BusinessCategory {
  businessId String  @db.Uuid
  categoryId String  @db.Uuid
  isPrimary  Boolean @default(false)

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([businessId, categoryId])
  @@index([categoryId, isPrimary])
  @@map("business_categories")
}

model BusinessTag {
  businessId String @db.Uuid
  tagId      String @db.Uuid

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  tag      Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([businessId, tagId])
  @@index([tagId])
  @@map("business_tags")
}

model Media {
  id         String    @id @default(uuid(7)) @db.Uuid
  businessId String    @db.Uuid
  type       MediaType
  url        String
  publicId   String?   // Cloudinary id; null for YouTube embeds
  altText    String
  sortOrder  Int       @default(0)
  createdAt  DateTime  @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, sortOrder])
  @@map("media")
}

model Offer {
  id         String   @id @default(uuid(7)) @db.Uuid
  businessId String   @db.Uuid
  title      String
  body       String?
  startsAt   DateTime
  endsAt     DateTime
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, endsAt])
  @@map("offers")
}

model Review {
  id         String           @id @default(uuid(7)) @db.Uuid
  businessId String           @db.Uuid
  userId     String           @db.Uuid
  rating     Int              // 1 to 5
  body       String?          @db.VarChar(1000)
  status     ModerationStatus @default(PENDING)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([businessId, userId])
  @@index([businessId, status, createdAt])
  @@map("reviews")
}

model SavedListing {
  userId     String   @db.Uuid
  businessId String   @db.Uuid
  createdAt  DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@id([userId, businessId])
  @@map("saved_listings")
}

model Claim {
  id           String           @id @default(uuid(7)) @db.Uuid
  businessId   String           @db.Uuid
  userId       String           @db.Uuid
  proofUrl     String?
  note         String?
  status       ModerationStatus @default(PENDING)
  reviewedById String?          @db.Uuid
  reviewedAt   DateTime?
  createdAt    DateTime         @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status, createdAt])
  @@map("claims")
}

model Report {
  id          String       @id @default(uuid(7)) @db.Uuid
  entityType  ReportEntity
  entityId    String       @db.Uuid
  userId      String?      @db.Uuid
  reason      String
  details     String?      @db.VarChar(1000)
  status      ReportStatus @default(OPEN)
  handledById String?      @db.Uuid
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([status, createdAt])
  @@index([entityType, entityId])
  @@map("reports")
}

// ---------- Events (phase 2) ----------

model Event {
  id            String                                @id @default(uuid(7)) @db.Uuid
  businessId    String?                               @db.Uuid
  submittedById String?                               @db.Uuid
  slug          String                                @unique
  title         String
  description   String?
  startsAt      DateTime
  endsAt        DateTime?
  venue         String?
  areaId        String?                               @db.Uuid
  location      Unsupported("geography(Point, 4326)")?
  coverUrl      String?
  ticketUrl     String?
  status        ModerationStatus                      @default(PENDING)
  createdAt     DateTime                              @default(now())
  updatedAt     DateTime                              @updatedAt

  business Business? @relation(fields: [businessId], references: [id], onDelete: SetNull)
  area     Area?     @relation(fields: [areaId], references: [id])

  @@index([status, startsAt])
  @@map("events")
}

// ---------- Marketplace (phase 2) ----------

model MarketItem {
  id              String        @id @default(uuid(7)) @db.Uuid
  sellerId        String        @db.Uuid
  categoryId      String        @db.Uuid // category with kind = MARKET
  slug            String        @unique
  title           String        @db.VarChar(100)
  description     String?       @db.VarChar(1000)
  priceNpr        Int
  isNegotiable    Boolean       @default(false)
  condition       ItemCondition
  areaId          String?       @db.Uuid
  contactPhone    String?
  contactWhatsapp String?
  status          MarketStatus  @default(PENDING)
  expiresAt       DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  deletedAt       DateTime?

  seller   User              @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  category Category          @relation(fields: [categoryId], references: [id])
  area     Area?             @relation(fields: [areaId], references: [id])
  media    MarketItemMedia[]

  @@index([status, categoryId, createdAt])
  @@index([sellerId])
  @@index([expiresAt])
  @@map("market_items")
}

model MarketItemMedia {
  id        String   @id @default(uuid(7)) @db.Uuid
  itemId    String   @db.Uuid
  url       String
  publicId  String
  altText   String
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  item MarketItem @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@index([itemId, sortOrder])
  @@map("market_item_media")
}

// ---------- Plans and payments ----------

model Plan {
  id           String   @id @default(uuid(7)) @db.Uuid
  code         String   @unique // BASIC, FEATURED
  name         String
  priceNpr     Int
  durationDays Int
  features     Json     // { maxPhotos, maxVideos, featured, homepage }
  isActive     Boolean  @default(true)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  subscriptions Subscription[]

  @@map("plans")
}

model Subscription {
  id         String             @id @default(uuid(7)) @db.Uuid
  businessId String             @db.Uuid
  planId     String             @db.Uuid
  status     SubscriptionStatus @default(PENDING)
  startsAt   DateTime?
  endsAt     DateTime?
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt

  business Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  plan     Plan      @relation(fields: [planId], references: [id])
  payments Payment[]

  @@index([businessId, status])
  @@index([status, endsAt])
  @@map("subscriptions")
}

model Payment {
  id             String         @id @default(uuid(7)) @db.Uuid
  subscriptionId String         @db.Uuid
  businessId     String         @db.Uuid
  gateway        PaymentGateway
  gatewayRef     String         @unique // Khalti pidx or eSewa transaction_uuid
  invoiceNo      String?        @unique
  amountNpr      Int
  status         PaymentStatus  @default(INITIATED)
  raw            Json?
  verifiedAt     DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  subscription Subscription @relation(fields: [subscriptionId], references: [id])
  business     Business     @relation(fields: [businessId], references: [id])

  @@index([businessId, createdAt])
  @@map("payments")
}

// ---------- Content and settings ----------

model CmsPage {
  id             String   @id @default(uuid(7)) @db.Uuid
  slug           String   @unique
  title          String
  body           String   // sanitized HTML
  seoTitle       String?
  seoDescription String?
  isPublished    Boolean  @default(false)
  updatedById    String?  @db.Uuid
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("cms_pages")
}

model HomeSection {
  id        String          @id @default(uuid(7)) @db.Uuid
  type      HomeSectionType
  title     String?
  config    Json?           // e.g. { categoryId, limit, businessIds, imageUrl, href }
  sortOrder Int             @default(0)
  isActive  Boolean         @default(true)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  @@index([isActive, sortOrder])
  @@map("home_sections")
}

model Setting {
  key       String   @id // e.g. emergency_numbers, social_links, contact
  value     Json
  updatedAt DateTime @updatedAt

  @@map("settings")
}

model SearchSynonym {
  id        String   @id @default(uuid(7)) @db.Uuid
  term      String   @unique
  synonyms  String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("search_synonyms")
}

// ---------- Analytics and audit ----------

model ListingStatDaily {
  businessId    String   @db.Uuid
  date          DateTime @db.Date
  views         Int      @default(0)
  calls         Int      @default(0)
  whatsapp      Int      @default(0)
  mapClicks     Int      @default(0)
  websiteClicks Int      @default(0)

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@id([businessId, date])
  @@map("listing_stats_daily")
}

model AuditLog {
  id        String   @id @default(uuid(7)) @db.Uuid
  actorId   String?  @db.Uuid
  action    String   // e.g. business.update, category.reorder
  entity    String
  entityId  String?
  diff      Json?
  ip        String?
  createdAt DateTime @default(now())

  actor User? @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([entity, entityId])
  @@index([actorId, createdAt])
  @@map("audit_logs")
}
```

## 4. Raw SQL in the first migration

Create the first migration with `--create-only`, put this at the top, then append Prisma's generated SQL below it. Add the indexes and trigger at the end.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- after Prisma's CREATE TABLE statements:

CREATE INDEX businesses_location_gix ON businesses USING GIST (location);
CREATE INDEX businesses_search_gin   ON businesses USING GIN ("searchVector");
CREATE INDEX businesses_name_trgm    ON businesses USING GIN (name gin_trgm_ops);
CREATE INDEX businesses_live_area    ON businesses ("areaId") WHERE status = 'LIVE' AND "deletedAt" IS NULL;
CREATE INDEX events_location_gix     ON events USING GIST (location);
CREATE INDEX market_items_title_trgm ON market_items USING GIN (title gin_trgm_ops);

CREATE FUNCTION businesses_search_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
      setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A')
   || setweight(to_tsvector('simple', coalesce(NEW."nameNe", '')), 'A')
   || setweight(to_tsvector('simple', coalesce(NEW."searchExtra", '')), 'B')
   || setweight(to_tsvector('simple', coalesce(NEW."shortDesc", '')), 'B')
   || setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER businesses_search_trigger
BEFORE INSERT OR UPDATE OF name, "nameNe", "searchExtra", "shortDesc", description
ON businesses FOR EACH ROW EXECUTE FUNCTION businesses_search_update();
```

The `simple` text config is used because listings mix English, Nepali and romanised Nepali; trigram matching covers spelling variations.

Prisma does not model these indexes, the trigger or PostGIS's `spatial_ref_sys` table, so a later `migrate dev` may propose dropping them. Always generate migrations with `--create-only`, read the SQL, and delete any such `DROP` lines before applying. If drift checks keep flagging the extension objects, enable the `postgresqlExtensions` preview feature and declare `extensions = [postgis, pg_trgm]` in the datasource block.

## 5. Prisma 7 setup

`server/prisma.config.ts` (CLI only: migrate, seed, studio)

```ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.js',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
})
```

`server/src/config/db.js` (runtime: pooled URL through the driver adapter)

```js
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { env } from './env.js'

const create = (connectionString) =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 10, connectionTimeoutMillis: 5000 }),
  })

export const db = create(env.DATABASE_URL)
export const readDb = env.DATABASE_REPLICA_URL ? create(env.DATABASE_REPLICA_URL) : db
```

Example distance query:

```js
const rows = await readDb.$queryRaw`
  SELECT id, slug, name, "shortDesc", "logoUrl",
         ST_Distance(location, ST_MakePoint(${lng}, ${lat})::geography) AS meters
  FROM businesses
  WHERE status = 'LIVE' AND "deletedAt" IS NULL
    AND ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radiusMeters})
  ORDER BY meters, id
  LIMIT ${limit}`
```

## 6. Seed (`prisma/seed.js`)

Idempotent (upserts). Creates:
- Super admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (refuses weak or default passwords when `NODE_ENV=production`).
- Groups, categories (DIRECTORY and MARKET) and areas from Part 1 §3, with a centre point for each area.
- Plans: BASIC (Rs 0, active), FEATURED (inactive until Admin sets the price).
- Settings: emergency numbers (Police 100, Fire 101, Ambulance 102, Tourist Police 1144), contact, social links.
- Home sections in default order; starter synonyms (plumber = dhara mistri, electrician = bijuli mistri, momo = dumpling).

## 7. Operations

- Local and `dev`: `npm run db:migrate` (`prisma migrate dev --create-only`, review the SQL, then `prisma migrate dev`).
- Production: `npx prisma migrate deploy` from the Render Shell, never `migrate dev`.
- Changes that rename or drop columns go in two deploys: add new → backfill → switch code → drop old.
- Weekly `pg_dump` (direct URL) to storage outside Neon; test a restore once per quarter.

---

# Part 6: API

Base URL: `https://api.allthingskathmandu.com/api/v1` (local: `http://localhost:5001/api/v1`).

## 1. Conventions

- JSON only. Success: `{ "success": true, "data": …, "meta": { "nextCursor": "…" } }`. Error: `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] } }`.
- Lists: `?cursor=<id>&limit=20` (max 50). Never page numbers.
- Every body and query is validated with Zod in `validators/`.
- Auth: `Authorization: Bearer <access token>`; refresh token in an httpOnly cookie scoped to `/api/v1/auth`.
- Public GETs are cached in Redis (`cache.middleware`); writes clear the matching tags and queue page revalidation.
- Guest forms (register, contact, report) require a Cloudflare Turnstile token.

## 2. Public (`/public`, no login)

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/home` | Active home sections with their data, in Admin order |
| GET | `/groups` | Directory category tree (visible, with live counts) |
| GET | `/categories/:slug` | Category, parent group, tags |
| GET | `/categories/:slug/listings` | Cards. Query: `area`, `tags`, `open`, `price`, `rating`, `lat`, `lng`, `cursor`, `limit` |
| GET | `/listings/:slug` | Listing detail (media and offers only when Featured) |
| GET | `/listings/:slug/reviews` | Approved reviews |
| GET | `/listings/:slug/similar` | Same category, nearby |
| GET | `/search` | Results. Query: `q`, `area`, `lat`, `lng`, `cursor` |
| GET | `/search/suggest` | Autocomplete for `q` (categories, listings, areas) |
| GET | `/areas` | Visible areas |
| GET | `/plans` | Active plans and prices |
| GET | `/events` | Approved events. Query: `from`, `to`, `area`, `cursor` |
| GET | `/events/:slug` | Event detail |
| GET | `/market/categories` | Market categories |
| GET | `/market` | Live items. Query: `category`, `condition`, `min`, `max`, `area`, `q`, `cursor` |
| GET | `/market/:slug` | Item detail |
| GET | `/pages/:slug` | Published CMS page |
| GET | `/settings` | Public settings (emergency numbers, contact, social links) |
| POST | `/track` | `{ businessId, kind: view, call, whatsapp, map, website }` → Redis counter |
| POST | `/reports` | Report wrong info (Turnstile) |
| POST | `/contact` | Contact form → email queue (Turnstile) |

## 3. Auth (`/auth`)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/register` | Sends verification email (Turnstile) |
| POST | `/verify-email` | Token from email |
| POST | `/resend-verification` | Same response whether the email exists or not |
| POST | `/login` | Returns access token, sets refresh cookie; lockout after repeated failures |
| POST | `/google` | Google ID token → login or register (optional) |
| POST | `/refresh` | Rotates refresh token |
| POST | `/logout` | Revokes current session |
| POST | `/logout-all` | Revokes all sessions |
| POST | `/forgot-password` | Same response whether the email exists or not |
| POST | `/reset-password` | Token + new password, revokes all sessions |
| POST | `/2fa/setup` | Admin roles: returns QR for TOTP |
| POST | `/2fa/enable` | Confirms first code |
| POST | `/2fa/verify` | Second login step for admin roles |

## 4. Member (`/me`, any logged-in user)

| Method | Path | Notes |
| --- | --- | --- |
| GET, PATCH | `/` | Profile |
| PATCH | `/password` | Revokes other sessions |
| DELETE | `/` | Delete account (soft delete, anonymise reviews) |
| GET, DELETE | `/sessions`, `/sessions/:id` | Active devices |
| GET | `/saved` | Saved listings |
| PUT, DELETE | `/saved/:businessId` | Save or unsave |
| GET, POST | `/reviews` | My reviews; create one per listing |
| PATCH, DELETE | `/reviews/:id` | Edit goes back to PENDING |
| POST | `/claims` | Claim a listing (proof upload) |
| POST | `/listings` | "List your business": creates a PENDING listing |
| GET, POST | `/market` | My items; post a new item (PENDING) |
| PATCH, DELETE | `/market/:id` | Edit goes back to PENDING |
| POST | `/market/:id/sold` | Mark sold |
| POST | `/market/media/sign` | Signed upload params (count and size caps) |

## 5. Business (`/business`, BUSINESS_OWNER + ownership)

All `:id` routes run `requireOwnership`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/listings` | My listings |
| GET, PATCH | `/listings/:id` | Detail and edit (name, descriptions, contacts, categories, tags) |
| PUT | `/listings/:id/hours` | Weekly hours JSON |
| PUT | `/listings/:id/location` | `{ lat, lng, address, areaId }` |
| POST | `/listings/:id/logo/sign` | Signed upload params for the logo |
| POST | `/listings/:id/media/sign` | Featured only; checks plan limits |
| POST | `/listings/:id/media` | Save uploaded photo or YouTube/Reels link |
| PATCH | `/listings/:id/media/order` | Reorder |
| DELETE | `/listings/:id/media/:mediaId` | Remove (queues Cloudinary delete) |
| GET, POST | `/listings/:id/offers` | Featured only |
| PATCH, DELETE | `/listings/:id/offers/:offerId` | |
| GET | `/listings/:id/stats` | Daily stats, `from`, `to` (max 365 days) |
| GET | `/listings/:id/subscription` | Current plan and expiry |
| GET | `/listings/:id/invoices` | Completed payments |
| POST | `/listings/:id/events` | Submit an event (phase 2) |

## 6. Payments (`/payments`, BUSINESS_OWNER)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/khalti/initiate` | `{ businessId, planCode }` → creates PENDING subscription + INITIATED payment, returns Khalti `payment_url` |
| POST | `/khalti/verify` | `{ pidx }` → Khalti lookup API; activates only if status is Completed and amount matches |
| POST | `/esewa/initiate` | `{ businessId, planCode }` → returns signed form fields |
| POST | `/esewa/verify` | `{ data }` from the success redirect → signature check + eSewa status check, then activate |

Activation runs in one transaction: payment COMPLETED, subscription ACTIVE with `startsAt`/`endsAt`, `businesses.featuredUntil` set, audit row written. A second call with the same `gatewayRef` returns the existing result.

## 7. Admin (`/admin`)

ADMIN and SUPER_ADMIN unless marked. Every write writes `audit_logs`.

| Area | Endpoints |
| --- | --- |
| Overview | `GET /overview` (counts, pending queues, revenue this month) |
| Listings | `GET /listings`, `POST /listings`, `GET/PATCH/DELETE /listings/:id`, `POST /listings/:id/status`, `POST /listings/:id/assign-owner`, `POST /listings/import` (CSV, queued) |
| Claims (MOD) | `GET /claims`, `POST /claims/:id/approve`, `POST /claims/:id/reject` |
| Categories | `GET /categories`, `POST /categories`, `PATCH/DELETE /categories/:id`, `PATCH /categories/reorder` |
| Tags, Areas | `GET/POST /tags`, `PATCH/DELETE /tags/:id`; same for `/areas` |
| Reviews (MOD) | `GET /reviews`, `POST /reviews/:id/approve`, `POST /reviews/:id/reject` |
| Reports (MOD) | `GET /reports`, `PATCH /reports/:id` |
| Events (MOD) | `GET /events`, `POST /events/:id/approve`, `POST /events/:id/reject`, `PATCH/DELETE /events/:id` |
| Market (MOD) | `GET /market`, `POST /market/:id/approve`, `POST /market/:id/reject`, `DELETE /market/:id` |
| Homepage | `GET/POST /home-sections`, `PATCH/DELETE /home-sections/:id`, `PATCH /home-sections/reorder` |
| Pages | `GET/POST /pages`, `PATCH/DELETE /pages/:id` |
| Synonyms | `GET/POST /synonyms`, `PATCH/DELETE /synonyms/:id` |
| Plans | `GET/POST /plans`, `PATCH /plans/:id` |
| Payments | `GET /payments`, `GET /payments/:id` |
| Media | `GET /media`, `DELETE /media/:id` |
| Settings | `GET /settings`, `PUT /settings/:key` |
| Users (SUPER_ADMIN for roles) | `GET /users`, `PATCH /users/:id/status`, `PATCH /users/:id/role` |
| Audit (SUPER_ADMIN) | `GET /audit` |
| Cache | `POST /cache/purge` (tag or all) |

## 8. Rate limits (Redis-backed)

| Scope | Limit |
| --- | --- |
| Login | 5 per 15 min per IP + email, then lockout grows |
| Register, forgot password, contact, reports | 5 per hour per IP |
| Search and suggest | 60 per min per IP |
| Track | 120 per min per IP |
| Payment initiate | 10 per min per user |
| Everything else | 300 per 15 min per IP |

## 9. Health

`GET /health` (outside `/api/v1`): `{ status: "ok", db: "ok", redis: "ok", version }`. Returns 503 if the database is unreachable. Redis down returns 200 with `redis: "degraded"` so the API stays in rotation.

---

# Part 7: Environment variables

Copy this into `.env.example` at the repo root. The SERVER block goes to Render (and `server/.env` locally), the CLIENT block to Vercel (and `client/.env.local` locally).

```bash
# All Things Kathmandu: environment variables
# Copy the SERVER block to server/.env and the CLIENT block to client/.env.local.
# Production values live only in Render (server) and Vercel (client).
# URLs never end with a trailing slash.

# ============================== SERVER (Render: API + worker) ==============================

NODE_ENV=development                          # development | production
PORT=5001                                     # Render sets this in production

# --- Database (Neon) ---
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/atk?sslmode=require   # pooled (-pooler host), used by the app at runtime
DIRECT_URL=postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/atk?sslmode=require            # direct, used by Prisma CLI (migrations) via prisma.config.ts
DATABASE_REPLICA_URL=                         # Neon read replica (pooled). Empty = reads go to primary
# Local: DATABASE_URL=DIRECT_URL=postgresql://atk:atk@localhost:5432/atk

# --- Redis / Valkey (Render Key Value) ---
REDIS_URL=redis://localhost:6379              # Render internal URL in production

# --- URLs ---
CLIENT_URL=http://localhost:3000              # production: https://allthingskathmandu.com (apex, no www)
SERVER_PUBLIC_URL=http://localhost:5001       # production: https://api.allthingskathmandu.com
FORCE_HTTPS=false                             # true in production
COOKIE_DOMAIN=                                # production: api.allthingskathmandu.com

# --- Auth ---
JWT_ACCESS_SECRET=change-me-64-random-chars   # openssl rand -base64 48
JWT_REFRESH_SECRET=change-me-different-64     # must differ from access secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
TOTP_ISSUER=All Things Kathmandu              # name shown in authenticator apps for admin 2FA
GOOGLE_CLIENT_ID=                             # optional: verifies Google sign-in ID tokens

# --- Cloudinary ---
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=atk-dev                     # atk-prod in production

# --- Email (SMTP) ---
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=hello@allthingskathmandu.com
FROM_NAME=All Things Kathmandu

# --- Payments ---
KHALTI_SECRET_KEY=                            # test key in dev, live key in production
KHALTI_BASE_URL=https://dev.khalti.com/api/v2 # confirm sandbox and live base URLs in Khalti docs
ESEWA_PRODUCT_CODE=EPAYTEST                   # sandbox merchant code
ESEWA_SECRET_KEY=                             # from eSewa merchant onboarding
ESEWA_FORM_URL=https://rc-epay.esewa.com.np/api/epay/main/v2/form   # sandbox form URL
ESEWA_STATUS_URL=                             # status check endpoint from eSewa docs

# --- Cloudflare Turnstile (bot check on register, contact, reports) ---
TURNSTILE_SECRET_KEY=

# --- Next.js revalidation ---
REVALIDATE_URL=http://localhost:3000/api/revalidate
REVALIDATE_SECRET=change-me-random            # same value in client env

# --- Seed (remove after first production seed) ---
ADMIN_EMAIL=
ADMIN_PASSWORD=                               # seed refuses weak or default passwords in production

# --- Monitoring ---
SENTRY_DSN=
LOG_LEVEL=info                                # debug | info | warn | error

# ============================== CLIENT (Vercel) ==============================

NEXT_PUBLIC_SITE_URL=http://localhost:3000    # production: https://allthingskathmandu.com
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1
INTERNAL_API_ORIGIN=http://localhost:5001     # used by server components; same API in production
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_GOOGLE_MAPS_KEY=                  # restrict by HTTP referrer to your domains in Google Cloud
NEXT_PUBLIC_GOOGLE_CLIENT_ID=                 # optional: Google sign-in for members
NEXT_PUBLIC_TURNSTILE_SITE_KEY=               # Cloudflare Turnstile widget
REVALIDATE_SECRET=change-me-random            # server-only, same as server value
NEXT_PUBLIC_SENTRY_DSN=
```

---

# Part 8: Deployment

Everything runs in or near Singapore (closest region to Nepal for Render and Neon). Production secrets live only in Render and Vercel.

| Piece | Platform | Name |
| --- | --- | --- |
| Web | Vercel | `atk-web` |
| API | Render web service | `atk-api` |
| Worker | Render background worker | `atk-worker` |
| Redis | Render Key Value | `atk-kv` |
| Database | Neon | project `atk`, branches `main`, `dev` |
| DNS, proxy | Cloudflare | `allthingskathmandu.com` |

## 1. Neon

1. Create project `atk` in AWS Asia Pacific (Singapore), database `atk`.
2. Branches: `main` (production) and `dev` (development). Separate roles and passwords per branch.
3. Copy two URLs per branch: pooled (host contains `-pooler`) → `DATABASE_URL`; direct → `DIRECT_URL`.
4. Compute: autoscaling on. Set a minimum size so production does not scale to zero (cold starts add latency).
5. Stage 2: add a read replica and set `DATABASE_REPLICA_URL` (pooled).

## 2. Render

Create the services from a Blueprint (`render.yaml` at repo root) so the setup is in Git:

```yaml
envVarGroups:
  - name: atk-server
    envVars:
      - key: NODE_ENV
        value: production
      - key: FORCE_HTTPS
        value: "true"
      - key: DATABASE_URL
        sync: false
      - key: DIRECT_URL
        sync: false
      - key: JWT_ACCESS_SECRET
        sync: false
      - key: JWT_REFRESH_SECRET
        sync: false
      # add every other server variable from .env.example with sync: false

services:
  - type: keyvalue
    name: atk-kv
    region: singapore
    plan: starter
    ipAllowList: []            # internal only
    maxmemoryPolicy: noeviction

  - type: web
    name: atk-api
    runtime: node
    region: singapore
    plan: standard
    rootDir: server
    buildCommand: npm ci && npx prisma generate
    startCommand: npm start    # "start": "tsx index.js"
    healthCheckPath: /health
    scaling:
      minInstances: 2
      maxInstances: 4
      targetCPUPercent: 70
      targetMemoryPercent: 80
    envVars:
      - fromGroup: atk-server
      - key: REDIS_URL
        fromService:
          type: keyvalue
          name: atk-kv
          property: connectionString

  - type: worker
    name: atk-worker
    runtime: node
    region: singapore
    plan: starter
    rootDir: server
    buildCommand: npm ci && npx prisma generate
    startCommand: npm run worker   # "worker": "tsx worker.js"
    envVars:
      - fromGroup: atk-server
      - key: REDIS_URL
        fromService:
          type: keyvalue
          name: atk-kv
          property: connectionString
```

Notes:
- `prisma`, `@prisma/adapter-pg` and `tsx` go in `dependencies` (not `devDependencies`), because `npm ci` skips dev packages when `NODE_ENV=production`.
- Instance plans above are starting points; adjust after the load test.
- Custom domain: add `api.allthingskathmandu.com` to `atk-api` before turning on the Cloudflare proxy (Part 8 §4).

## 3. Vercel

1. Import the repo, root directory `client`, framework Next.js, Node 24.
2. Add every CLIENT variable from `.env.example` to Production (and Preview with dev values).
3. Domains: `allthingskathmandu.com` as primary, `www.allthingskathmandu.com` → 308 redirect to apex.
4. Use the Pro plan (Hobby is for non-commercial use).

## 4. Cloudflare DNS

| Record | Name | Target | Proxy |
| --- | --- | --- | --- |
| A / CNAME | `@` | Values shown in Vercel's domain settings | DNS only |
| CNAME | `www` | Value shown in Vercel | DNS only |
| CNAME | `api` | `atk-api.onrender.com` (your service URL) | Proxied, after Render issues its certificate |
| TXT, CNAME | email | SPF, DKIM, DMARC from your SMTP provider | DNS only |

- SSL/TLS mode: Full (strict).
- WAF: managed rules on; rate-limit rule on `api.allthingskathmandu.com/api/v1/auth/*`.
- Turnstile: create a widget for `allthingskathmandu.com`, copy the site and secret keys.

## 5. Other services

| Service | Setup |
| --- | --- |
| Cloudinary | Folders `atk-dev`, `atk-prod`; signed uploads only; allowed formats jpg, png, webp, mp4; size caps per plan |
| Khalti | Merchant account; test keys for dev; return URL `https://allthingskathmandu.com/business/plan/return/khalti` |
| eSewa | Merchant account; sandbox code `EPAYTEST` for dev; success and failure URLs under `/business/plan/return/esewa` |
| Google Cloud | Maps JavaScript API key restricted to `allthingskathmandu.com/*` and `localhost:3000/*` |
| SMTP | Provider with a verified sending domain |
| Sentry | Projects `atk-web`, `atk-api`; DSNs in env |
| Uptime monitor | Checks `/health` and the homepage every minute, alerts by email |

## 6. First production deploy

1. Neon `main` branch ready, URLs in the Render env group.
2. Deploy the Blueprint on Render; wait for `atk-api` to show healthy.
3. Render Shell on `atk-api`: `npx prisma migrate deploy`, then `npx prisma db seed` once. Remove `ADMIN_PASSWORD` from the env group afterwards.
4. Deploy `atk-web` on Vercel with `INTERNAL_API_ORIGIN` and `NEXT_PUBLIC_API_URL` pointing at `api.`.
5. Point DNS as in Part 8 §4; turn on the `api` proxy once Render shows the certificate.
6. Log in as super admin, enable 2FA, set the Featured price, load categories and first listings.
7. Run the k6 load test and the Khalti/eSewa sandbox flow end to end before switching to live keys.

## 7. Releases

- Branches: `main` is production; work on feature branches with PRs.
- CI (`.github/workflows/ci.yml`) on every PR: server lint + tests (Postgres with PostGIS and Valkey as service containers) + `prisma validate`; client lint + build.
- Merging to `main` auto-deploys Vercel and Render.
- PRs with migrations: run `npx prisma migrate deploy` from the Render Shell before or right after the deploy, and keep changes backward compatible (add, backfill, switch, then drop in a later release).

## 8. Rollback

| Piece | How |
| --- | --- |
| Web | Vercel "Instant Rollback" to the previous deployment |
| API, worker | Render "Rollback" to the previous deploy |
| Database | Neon point-in-time restore into a new branch, verify, then switch `DATABASE_URL` |

---

# Part 9: Build phases

Do these in order. Each phase ends with the build and tests passing and a commit.

**P0. Repo setup**
Save this file as `docs/SPEC.md`. Create `.gitignore` first, then `CLAUDE.md` from Part 2, `.env.example` from Part 7, `docker-compose.yml` with `postgis/postgis` and `valkey/valkey` (ports 5432 and 6379, named volumes), `README.md` (local setup and ports), `CHANGELOG.md`, `render.yaml` from Part 8 §2, `.github/workflows/ci.yml` (server: lint, `prisma validate`, tests with PostGIS and Valkey service containers; client: lint, build) and a PR template. No client or server code yet.

**P1. Server skeleton**
Create `server/` per Part 3 §13: Node 24, Express 5, ESM, run with `tsx`. Build `config/env.js` (Zod-validated, rules from Part 2), utils (ApiError, ApiResponse, winston logger), errorHandler, `app.js` in the order listed in Part 3 §13, `/health` per Part 6 §9, graceful shutdown in `index.js`, and `worker.js` with a BullMQ connection and an empty processor registry. Scripts: dev, start, worker, worker:dev, test, db:generate, db:migrate, db:seed. Verify `npm run dev` and `GET /health` against docker compose.

**P2. Database**
Implement Part 5 exactly: `prisma/schema.prisma` from §3, `prisma.config.ts` and `src/config/db.js` from §5, the first migration with the raw SQL from §4 (`--create-only`, add the SQL, apply), and an idempotent `prisma/seed.js` per §6 using the taxonomy, areas and plans in Part 1. Add `lib/geo.js` with the distance query and a test that seeds two listings and checks ordering by distance.

**P3. Auth**
Build Part 6 §3 with every security default in Part 2: sessions table with hashed rotating refresh tokens and reuse detection, progressive lockout, email verification and password reset through the email queue, no account enumeration, Turnstile on register, TOTP 2FA required for MODERATOR and above, optional Google sign-in. Add `auth`, `requireRole` and `ownership` middleware. Tests for register, verify, login, refresh rotation, reuse detection, lockout and 2FA.

**P4. Client foundation**
Create `client/` with Next.js 16 (App Router, JavaScript), Tailwind 4 with placeholder tokens in `globals.css` per Part 4 §6, TanStack Query provider, `services/api.js` (single axios instance, in-memory access token, one refresh on 401 with a queue), `store/authStore.js`, `src/proxy.js` guarding `/account`, `/business` and `/admin`, the auth pages, and `layout.js`, `robots.js`, `sitemap.js`, `not-found.js`, `error.js`. `npm run build` must pass.

**P5. Directory API**
Build the public endpoints in Part 6 §2 for groups, categories, listings, search, suggest, areas, plans, settings and track. Use `readDb`, cursor pagination, the Redis cache middleware with tag invalidation, search with full-text + trigram + synonyms + area and distance filters, and Redis counters for track flushed to `listing_stats_daily` by a worker job every 5 minutes. Add a worker job that keeps `categories.liveCount` and `businesses.searchExtra` current. Tests for each endpoint.

**P6. Public pages**
Build Home, Group, Category, Listing detail and Search per Part 4 §2 to §4, §7 and §9, as server components with `generateMetadata` and ISR tags (`home`, `category:<id>`, `listing:<id>`). Add `app/api/revalidate/route.js` (secret checked, `revalidateTag(tag, 'max')`) and a worker job that calls it after changes. The map loads lazily. Include skeleton, empty and error states. The listing page scores 90+ on Lighthouse mobile performance locally.

**P7. Admin panel**
Build Part 6 §7 with the roles in Part 3 §7: listings CRUD with CSV import (queued), claims, categories tree with drag reorder, tags, areas, reviews, reports, homepage builder, CMS pages with Tiptap and sanitize-html, synonyms, plans, payments list, settings, users and roles, audit log viewer, cache purge. Every write records `audit_logs` and queues cache purge plus revalidation. Admin login requires 2FA.

**P8. Business portal**
Build the claim flow and Part 6 §5: edit listing, hours editor, location picker on the map, logo and media uploads with signed Cloudinary params and plan limits, offers, stats for the last 30 days, current plan and invoices. Every `:id` route uses `requireOwnership`. Test that an owner cannot read or edit another owner's listing.

**P9. Payments**
Implement Khalti and eSewa as Part 6 §6 and Part 3 §4 describe, after checking the current Khalti ePayment and eSewa ePay v2 docs. Price comes from `plans`; activation only after server-side verification; `gatewayRef` unique; activation in one transaction. Worker jobs: renewal reminders 7 days and 1 day before expiry, expire subscriptions and clear `featuredUntil`. Test the full sandbox flow for both gateways, including a repeated verify call.

**P10. Member area**
Build Part 6 §4 (except market): profile, password change, sessions list with sign-out, saved listings, reviews (one per listing, edits go back to moderation), account deletion, with the matching pages under `(member)/account`.

**P11. Events and Marketplace (phase 2)**
Build Events and the second-hand Marketplace from Part 3 §6, Part 5 and Part 6: submission, moderation queues, 30-day expiry job with an email to the seller, market list and item pages per Part 4 §3, contact by call or WhatsApp only.

**P12. Hardening before launch**
Add Sentry to web, API and worker. Review rate limits against Part 6 §8. Check security headers, CORS, cookie flags and robots rules. Write a k6 script for home, category, listing and search at the target load and report p95. Run an accessibility review of the public pages against Part 4 §8. Add a weekly `pg_dump` job that uploads to storage outside Neon. Walk through Part 8 §6 and list anything missing.

---

# Appendix: Accounts and packages

## Accounts

| Service | Used for |
| --- | --- |
| GitHub | Repo, CI |
| Vercel (Pro) | Next.js web app |
| Render | API, worker, Key Value |
| Neon | PostgreSQL + PostGIS |
| Cloudflare | DNS, API proxy, WAF, Turnstile |
| Cloudinary | Logos, photos, videos |
| Khalti, eSewa | Plan payments |
| Google Cloud | Maps JavaScript API |
| SMTP provider | Transactional email |
| Sentry | Errors |
| Uptime monitor | `/health` and homepage checks |

## Packages

| Where | Runtime | Dev |
| --- | --- | --- |
| Server | express, prisma, @prisma/adapter-pg, pg, tsx, zod, jsonwebtoken, bcryptjs, helmet, cors, cookie-parser, express-rate-limit, rate-limit-redis, ioredis, bullmq, cloudinary, nodemailer, winston, otplib, qrcode, sanitize-html, slugify, csv-parse, @sentry/node, dotenv, google-auth-library (optional) | vitest, supertest, eslint, prettier |
| Client | next, react, react-dom, tailwindcss, @tailwindcss/postcss, @tanstack/react-query, zustand, axios, react-hook-form, zod, @hookform/resolvers, @vis.gl/react-google-maps, next-cloudinary, lucide-react, clsx, @marsidev/react-turnstile, @sentry/nextjs, @tiptap/react, @tiptap/starter-kit, @dnd-kit/core, @dnd-kit/sortable | eslint, eslint-config-next, prettier, prettier-plugin-tailwindcss |
| Machine | Node 24, Docker, k6 | |

`prisma`, `@prisma/adapter-pg` and `tsx` go in server `dependencies` (Render skips dev packages in production). Pin exact versions after the first install.
