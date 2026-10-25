# Hardening review before launch (P12)

Results of the Part 9 P12 checks, run against the local production build on 25 Oct 2026. Rerun the load test against production before switching to live payment keys (Part 8 §6, step 7).

## Error reporting (Sentry)

| Where            | How                                                                            | Reported                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| API              | `server/src/config/sentry.js`, imported first by `index.js`                    | Unexpected errors that become a 500 (not validation, 4xx or known 503s), uncaught exceptions and unhandled rejections; route, method and user id only |
| Worker           | same module, imported first by `worker.js`                                     | Jobs that fail on their last attempt (queue and job name as tags), worker errors                                                                      |
| Web, server side | `client/src/instrumentation.js` (`onRequestError`)                             | Errors in server components, route handlers and `proxy.js`                                                                                            |
| Web, browser     | `client/src/lib/reportError.js`, `lib/errorReporting.js`, `lib/errorBuffer.js` | Uncaught errors and rejections, and errors caught by `error.js` / `global-error.js`                                                                   |

- The browser SDK is not in the first page load (Part 4 §9). An inline script buffers errors from the start of the page, and the SDK loads when the browser is idle, or straight away on the first error, then sends the buffered errors.
- Errors only: no tracing, session replay or personal data (`sendDefaultPii: false`). Nothing is sent when no DSN is set.
- Setup: `SENTRY_DSN` on `atk-api` and `atk-worker` (Render, `sync: false`), `NEXT_PUBLIC_SENTRY_DSN` on Vercel (Part 7). Use the `atk-api` project's DSN for the API and worker and `atk-web`'s for the web app (Part 8 §5).
- Checked locally against a stand-in ingest server: API events arrive with the tags and user id and no IP. Browser events were captured and sent, but this Chrome profile's tracker blocker dropped requests to `*/envelope/?sentry_key=…`. Visitors with ad blockers will do the same. Sentry's `tunnel` option (posting through the site's own domain) avoids that; it was not added because the spec does not ask for it.

## Rate limits (Part 6 §8)

| Scope                                       | Spec                                      | Implemented                                                                                                 |
| ------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Login                                       | 5 per 15 min per IP + email, then lockout | `loginLimiter` (IP + email) and progressive lockout from the 5th failure; the 2FA step has the same budget  |
| Register, forgot password, contact, reports | 5 per hour per IP                         | `registerLimiter`, `emailLimiter` (forgot password, resend verification), `contactLimiter`, `reportLimiter` |
| Search and suggest                          | 60 per min per IP                         | `searchLimiter`                                                                                             |
| Track                                       | 120 per min per IP                        | `trackLimiter`                                                                                              |
| Payment initiate                            | 10 per min per user                       | `initiateLimiter` on both gateways                                                                          |
| Everything else                             | 300 per 15 min per IP                     | `globalLimiter` (`/health` exempt)                                                                          |

Added on top of the spec, all stricter: moderation submissions (claims, reviews, events, market items, "List your business") 10 per hour per account; the current-password check (password change, account deletion) 5 per 15 minutes per account. Limits are stored in Valkey and fail open if it is down, so an outage never locks everyone out.

Notes:

- `req.ip` trusts 2 proxy hops in production (Cloudflare, then Render's load balancer). Keep the `api` DNS record proxied through Cloudflare (Part 8 §6, step 5). With DNS only there is one hop, and visitors could spoof `X-Forwarded-For` to dodge per-IP limits. In that case set `TRUSTED_PROXY_HOPS` in `server/src/app.js` to 1.
- The search page renders its first results on the web server, so those API calls share the web server's IP. Each query is cached for 2 minutes, and if the API ever answers 429 the page falls back to loading results from the visitor's browser.

## Headers, CORS, cookies and robots

- **Web (Next.js):** `Strict-Transport-Security` (2 years, subdomains), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (geolocation for the site only; camera, microphone, payment and USB off), and a production-only allowlist CSP.
  - The CSP covers: the API origin, Cloudinary, Google Maps (Google's published host list), Turnstile, Google sign-in, YouTube (no-cookie) and Instagram embeds, the Sentry ingest host, eSewa as a form target, `object-src 'none'`, `base-uri 'self'` and `frame-ancestors 'none'`.
  - Pages are static (ISR), so the CSP cannot use per-request nonces and keeps `'unsafe-inline'` for scripts. It limits where data can go and who can frame the site; it is not a full XSS defence.
  - No CSP violations on home, listing, search, register, market or events pages. The Maps key, Turnstile and Google sign-in are not set locally, so those three hosts were not exercised.
- **API:** helmet defaults (HSTS, nosniff, `X-Frame-Options`, a restrictive CSP for JSON), `Cross-Origin-Resource-Policy: same-site` for the track beacons, no `X-Powered-By`. CORS allows only `CLIENT_URL`, with credentials.
- **Cookies:**
  - Refresh token: `httpOnly`, `Secure` in production, `SameSite=Lax`, path `/api/v1/auth`, rotated on every refresh, stored hashed.
  - `atk_session`: a non-secret `1` hint, readable by JavaScript by design (P4 decision).
- **robots.txt:** blocks `/admin`, `/business`, `/account`, `/verify-email`, `/reset-password` and `/api/`. Login, search and private pages also send `noindex`.

## Accessibility (Part 4 §8)

Lighthouse (mobile) accessibility scores 100 on home, listing, search, market list and item, events list and event, login and register. The checks fixed during this review:

- The event page's details list (`<dl>`) wrapped `dt`/`dd` in an extra element; fixed.
- Listing pages, search result headings and breadcrumbs linked to categories that have no public page yet (fewer than 5 live listings), which 404ed. Cards and listing details now carry `category.isPublic`, and those categories show as plain text.

Already in place: 4.5:1 text contrast in both themes (P4 tokens), 44 px tap targets, visible focus rings, alt text required by every uploader that adds content images, keyboard-operable admin tables and drag-and-drop, and map content repeated as text (address, area, Directions).

Judgement call: event covers are shown next to the event title, so they are decorative (`alt=""`) instead of repeating the title.

## Load test (k6)

`server/scripts/load-test.js` ramps to 50 visitors over 3 minutes, holds for 2 minutes and browses home, a category, listings and search with 1 to 3 seconds of reading time between pages. It fails if p95 exceeds 300 ms (overall and per page) or more than 1% of requests fail. The run command is in the script's header (Docker image `grafana/k6:2.2.0`).

Local run (production build on this machine; the category was filled with 6 temporary live listings and reverted afterwards):

| Page     | p95    | p99    |
| -------- | ------ | ------ |
| Home     | 1.9 ms | 2.8 ms |
| Category | 2.1 ms | 3.5 ms |
| Listing  | 2.0 ms | 2.9 ms |
| Search   | 5.2 ms | 7.4 ms |
| All      | 4.0 ms | 5.8 ms |

5,668 requests, 0 failed. These numbers have no network latency and hit warm ISR caches, so they only prove the script and the caching. Run it against production (Vercel + Render in Singapore) for the real figure.

## Backups

`.github/workflows/backup.yml` runs every Sunday at 03:15 Kathmandu time, and can also be started by hand.

- It dumps the `DIRECT_URL` database with the Postgres 17 client, encrypts the dump with `BACKUP_PASSPHRASE` (AES-256, gpg) and keeps it as a workflow artifact for 90 days.
- It needs the repository secrets `DIRECT_URL` and `BACKUP_PASSPHRASE`. Keep the passphrase in a password manager too: without it the dumps cannot be opened.
- A local dump-and-restore round trip into an empty database brought back every table, PostGIS and the search trigger. The restore steps are in the workflow file; test them once per quarter (Part 5 §7).

## JS budget (Part 4 §9)

Re-measured on the final build: every public page is under 170 KB gzip (see the CHANGELOG for the figures). The Sentry browser SDK is not part of it.

## Part 8 §6 walkthrough

| Step                                                                  | Status                                                                                                                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Neon `main` ready, URLs in Render                                  | Needs your Neon project. `render.yaml` expects `DATABASE_URL` (pooled), `DIRECT_URL` and optional `DATABASE_REPLICA_URL` as `sync: false`                              |
| 2. Deploy the Blueprint, wait for `atk-api` healthy                   | Ready: `render.yaml` with `/health` as the health check                                                                                                                |
| 3. `prisma migrate deploy`, seed once, remove `ADMIN_PASSWORD`        | Ready: the seed refuses a missing or weak admin password in production                                                                                                 |
| 4. Vercel with `INTERNAL_API_ORIGIN` and `NEXT_PUBLIC_API_URL`        | Needs your Vercel project and the CLIENT variables from `.env.example`                                                                                                 |
| 5. DNS, `api` proxy on                                                | Needs your Cloudflare zone. Keep `api` proxied (see Rate limits)                                                                                                       |
| 6. Super admin login, 2FA, Featured price, categories, first listings | Ready: 2FA is enforced at the first staff login; plans, categories and the CSV import are in Admin                                                                     |
| 7. k6 and the Khalti/eSewa sandbox flow                               | k6 is ready (above). Khalti needs a test secret key; eSewa needs a login to its test wallet. Both verify paths are covered by tests with the gateway responses stubbed |

Not covered by code (accounts and settings you set up, Part 8 §5):

- Sentry projects `atk-web` and `atk-api`.
- An uptime monitor on `/health` and the homepage.
- An SMTP provider with a verified sending domain.
- A Google Maps key restricted to the site and `localhost:3000`.
- A Cloudflare Turnstile site key and secret.
- Khalti and eSewa merchant accounts with live keys.
- The two backup secrets in GitHub.

Also note:

- Part 8 §5 lists `mp4` as an allowed Cloudinary format. Listing videos are YouTube or Instagram links (P8), so the API never signs video uploads.
