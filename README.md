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
npm run db:migrate      # creates the migration only; review the SQL, then: npx prisma migrate dev
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

## Ports

| Service | Port | Notes |
| --- | --- | --- |
| Web (Next.js) | 3000 | `client/` |
| API (Express) | 5001 | `server/`, base path `/api/v1`, health at `/health` |
| Postgres + PostGIS | 5432 | user `atk`, password `atk`; databases `atk` (dev) and `atk_test` (tests) |
| Valkey | 6379 | |

On Apple Silicon the `postgis/postgis` image runs under amd64 emulation (the image has no arm64 build). If something else already listens on 5432 or 6379 (for example a Homebrew `postgresql` or `redis` service), stop it before `docker compose up`.

## Tests

```bash
cd server
npm test               # Vitest + Supertest against the atk_test database and local Valkey
```

The `atk_test` database is created on the first start of an empty Postgres volume. To recreate it: `docker compose down -v && docker compose up -d`.

## Deployment

See `docs/SPEC.md` Part 8. In short: web on Vercel (`client/`), API and worker on Render (`render.yaml`), database on Neon, DNS and API proxy on Cloudflare.
