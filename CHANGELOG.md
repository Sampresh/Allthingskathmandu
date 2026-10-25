# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- P0 repo setup: `docs/SPEC.md`, `CLAUDE.md`, `.env.example`, `docker-compose.yml` (PostGIS 17-3.5, Valkey 8.1, `atk_test` database for tests), `README.md`, `render.yaml`, CI workflow and PR template.
- P1 server skeleton: Express 5 (ESM, run with tsx), Zod-validated `config/env.js`, Prisma 7 client with `@prisma/adapter-pg` (`db` + `readDb`), ioredis connections for cache and BullMQ, winston logger, `ApiError`/`ApiResponse`, error handler, Redis-backed global rate limit (passes through while Redis is down), `/health` (503 on DB down, `redis: "degraded"` on Redis down), graceful shutdown for API and worker, BullMQ worker with an empty processor registry, Vitest + Supertest setup.
- P2 database: Prisma schema from Part 5 §3, first migration with PostGIS, pg_trgm, GiST/GIN/trigram/partial indexes and the `searchVector` trigger, `services/geo.js` (distance query and point writers), idempotent seed (super admin, 10 groups, 60 directory and 9 market categories with Nepali names, 16 areas with centre points, plans, settings, home sections, synonyms, 49 DRAFT brand/app/place stubs and 4 LIVE emergency numbers), tests for distance ordering, the search trigger and seed idempotency.
- P3 auth: `/auth` routes from Part 6 §3. Registration with email verification, login with progressive lockout (5 failures, then 15 min doubling up to 24 h), rotating refresh tokens stored as SHA-256 hashes with reuse detection (reuse revokes every session), logout and logout-all, password reset (revokes all sessions), TOTP 2FA required for Moderator and above (setup, enable, verify; secrets AES-256-GCM encrypted; codes cannot be replayed), optional Google sign-in, Turnstile check on register. No account enumeration on register, resend-verification and forgot-password. Middleware: `verifyToken` (re-reads session and user), `optionalAuth`, `requireRole` (staff hierarchy, 2FA enforced), `requireOwnership`, `validate`. Emails go through the BullMQ `email` queue; without SMTP the worker logs them.

### Notes

- `render.yaml` keeps secrets as `sync: false` on each service because Render does not allow `sync: false` inside an environment group, and uses Render's current plan IDs (`1c-2g`, `0.5c-512mb`, `256mb`).
- `postgis/postgis` has no arm64 image, so local Postgres runs as `linux/amd64`.
- `prisma`, `@prisma/client` and `@prisma/adapter-pg` pinned to 7.10.1 (npm `latest` for `prisma` points at an 8.0 release candidate). `@prisma/client` is required at runtime by the `prisma-client` generator output.
- `ioredis` pinned to 5.11.1, the version BullMQ 6 is tested against (ioredis 6 switched to RESP3 by default).
- Tests use the `atk_test` database and Valkey logical DB 1.
- The five raw-SQL indexes from Part 5 §4 are also declared as `@@index` in the schema (same names and types) so `prisma migrate dev` sees no drift and never proposes dropping them. The partial index and the search trigger stay raw SQL only.
- New env variable `TOTP_ENCRYPTION_KEY` (32 bytes, base64) encrypts admin TOTP secrets at rest; added to `.env.example`, `render.yaml` and CI.
- The API also sets an httpOnly `atk_session=1` hint cookie on the web app's domain at login and refresh (cleared on logout) so `proxy.js` can redirect logged-out visitors; it carries no credentials.
- Seed rows are created only when missing, so re-running the seed never overwrites Admin edits. Seeded listings carry no contact details except the public emergency numbers. Uber is included: it launched in Kathmandu Valley in mid-2026.
