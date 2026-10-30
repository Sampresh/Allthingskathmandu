# All Things Kathmandu

A vetted directory of local businesses, services, places, events and second-hand items for Kathmandu Valley.

- Spec (single source of truth): [`docs/SPEC.md`](docs/SPEC.md)
- Project rules for contributors and AI agents: [`CLAUDE.md`](CLAUDE.md)
- Changes: [`CHANGELOG.md`](CHANGELOG.md)

## Repository layout

| Path | What |
| --- | --- |
| `server/` | API (Express 5) and worker (BullMQ), Prisma 7 |
| `client/` | Web app (Next.js 16) |
| `docs/` | Spec |
| `docker/` | Local Postgres init script |
| `docker-compose.yml` | Local Postgres (PostGIS) and Valkey |
| `render.yaml` | Render Blueprint: API, worker, Key Value |
| `.env.example` | Every environment variable, server and client |

## Prerequisites

- Node 24 LTS (`.node-version` in `server/` and `client/`)
- Docker (Docker Desktop on macOS)
- k6 (only for the pre-launch load test)

## Local setup

```bash
# 1. Start Postgres + PostGIS and Valkey
docker compose up -d

# 2. Environment
#    Copy the SERVER block of .env.example to server/.env
#    and the CLIENT block to client/.env.local, then fill in values.
#    Local database: DATABASE_URL=DIRECT_URL=postgresql://atk:atk@localhost:5432/atk

# 3. API
cd server
npm install
npm run db:generate
npx prisma migrate dev  # applies the existing migrations to the local database
npm run db:seed         # super admin from ADMIN_EMAIL / ADMIN_PASSWORD, taxonomy, areas, plans, starter listings
npm run dev             # http://localhost:5001  (health: http://localhost:5001/health)

# 4. Worker (second terminal)
cd server
npm run worker:dev

# 5. Web (third terminal)
cd client
npm install
npm run dev             # http://localhost:3000
```

Local development notes:

- Without `SMTP_HOST`, the worker logs every email (with its verification or reset link) instead of sending it.
- Without `TURNSTILE_SECRET_KEY`, the bot check is skipped with a warning. Production refuses to start without it.
- Generate secrets with `openssl rand -base64 48` (JWT) and `openssl rand -base64 32` (`TOTP_ENCRYPTION_KEY`).
- Super admin, admin and moderator accounts set up TOTP on first login (any authenticator app). The admin panel is at http://localhost:3000/admin (login at `/admin/login`).

## Everything in Docker

The whole stack can also run in Docker as production builds (the `app` profile in `docker-compose.yml`):

```bash
# server/.env and client/.env.local as in Local setup (the Docker containers override the
# database, Valkey and API hosts themselves). Stop any npm dev servers on 3000 and 5001 first.
docker compose --profile app up -d --build
```

This builds `server/Dockerfile` (API and worker) and `client/Dockerfile` (web), applies the migrations and runs the idempotent seed (the `migrate` container), then starts the API on http://localhost:5001, the worker and the web app on http://localhost:3000. Logs: `docker compose --profile app logs -f api worker web`. Stop it with `docker compose --profile app down` (the database volume is kept).

- `NEXT_PUBLIC_*` values from `client/.env.local` are baked into the web image at build time: rebuild (`--build`) after changing them.
- The web image is built without the API running, so its pages render on request instead of being prerendered; data is still cached by tag and refreshed by the worker.
- Images are for local use; production runs on Render (`render.yaml`) and Vercel.

## Ports

| Service | Port | Notes |
| --- | --- | --- |
| Web (Next.js) | 3000 | `client/` |
| API (Express) | 5001 | `server/`, base path `/api/v1`, health at `/health` |
| Postgres + PostGIS | 5432 | user `atk`, password `atk`; databases `atk` (dev) and `atk_test` (tests) |
| Valkey | 6379 | |

On Apple Silicon the `postgis/postgis` image runs under amd64 emulation (the image has no arm64 build). If something else already listens on 5432 or 6379 (for example a Homebrew `postgresql` or `redis` service), stop it before `docker compose up`.

## Changing the database

```bash
cd server
npm run db:migrate      # prisma migrate dev --create-only: writes the SQL without applying it
# review prisma/migrations/<new>/migration.sql (never keep DROPs of the PostGIS, trigram or search objects)
npx prisma migrate dev  # applies it
npm run db:generate
```

## Tests

```bash
cd server
npm test               # Vitest + Supertest against the atk_test database and local Valkey
```

The `atk_test` database is created on the first start of an empty Postgres volume. To recreate it: `docker compose down -v && docker compose up -d`.

## Deployment

See `docs/SPEC.md` Part 8. In short: web on Vercel (`client/`), API and worker on Render (`render.yaml`), database on Neon, DNS and API proxy on Cloudflare.

## Before launch

`docs/HARDENING.md` covers error reporting (Sentry DSNs), rate limits, security headers, the accessibility review, the k6 load test (`server/scripts/load-test.js`), the weekly encrypted database backup (`.github/workflows/backup.yml`, needs the `DIRECT_URL` and `BACKUP_PASSPHRASE` repository secrets) and the Part 8 §6 checklist.

#ADMIN CREDENTIALS
ID = ADMIN@ATK.LOCAL
PASSWORD = Atk-h1I2LZ7BhMsadA8iYH7cp0j9!