import { defineConfig } from '@playwright/test'

/*
 * End-to-end run against a production build and its own data: the API on 5002 (with the
 * worker, so saves revalidate pages) uses the atk_e2e database and Redis db 2, prepared by
 * server/tests/e2e/prepare.js; the web app is built into .next-e2e and served on 3002.
 * Needs `docker compose up -d` (Postgres + Valkey) and Google Chrome.
 *
 *   npm run test:e2e
 */
const API = 'http://localhost:5002'
const WEB = 'http://localhost:3002'
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://atk:atk@localhost:5432/atk_e2e'

// The rest of the API's settings come from server/.env.
const serverEnv = {
  ...process.env,
  PORT: '5002',
  DATABASE_URL,
  DIRECT_URL: DATABASE_URL,
  DATABASE_REPLICA_URL: '',
  REDIS_URL: 'redis://localhost:6379/2',
  CLIENT_URL: WEB,
  SERVER_PUBLIC_URL: API,
  REVALIDATE_URL: `${WEB}/api/revalidate`,
  STAFF_TWO_FACTOR: 'false',
  NODE_ENV: 'development',
  LOG_LEVEL: 'warn',
  ADMIN_EMAIL: 'e2e-super@atk.test',
  ADMIN_PASSWORD: 'E2e-Super-Passw0rd!',
}

export default defineConfig({
  testDir: 'e2e',
  // One shared database: run files one after another.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      name: 'api',
      command: 'npx tsx tests/e2e/prepare.js && (npm run worker & npm start)',
      cwd: '../server',
      url: `${API}/health`,
      env: serverEnv,
      timeout: 120_000,
      // E2E_REUSE=1 runs against a stack you started yourself (debugging).
      reuseExistingServer: Boolean(process.env.E2E_REUSE),
    },
    {
      name: 'web',
      // A clean build each run: cached pages must not outlive the database reset.
      command: `node -e "require('fs').rmSync('.next-e2e',{recursive:true,force:true})" && node e2e/wait-for.mjs ${API}/health && npm run build && npx next start -p 3002`,
      url: WEB,
      env: {
        ...process.env,
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_API_URL: `${API}/api/v1`,
        NEXT_PUBLIC_SITE_URL: WEB,
        INTERNAL_API_ORIGIN: API,
      },
      timeout: 600_000,
      // E2E_REUSE=1 runs against a stack you started yourself (debugging).
      reuseExistingServer: Boolean(process.env.E2E_REUSE),
    },
  ],
})
