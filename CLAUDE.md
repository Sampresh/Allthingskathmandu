# All Things Kathmandu: project rules

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
