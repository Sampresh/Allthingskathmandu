import { defineConfig } from 'vitest/config'

// Tests run against the atk_test database and local Valkey (docker compose), or the CI
// service containers. These are throwaway local values, not secrets.
const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://atk:atk@localhost:5432/atk_test',
  DIRECT_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://atk:atk@localhost:5432/atk_test',
  DATABASE_REPLICA_URL: '',
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1',
  CLIENT_URL: 'http://localhost:3000',
  SERVER_PUBLIC_URL: 'http://localhost:5001',
  FORCE_HTTPS: 'false',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdefghijklmnopqrstuv',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdefghijklmnopqrstu',
  REVALIDATE_URL: 'http://localhost:3000/api/revalidate',
  REVALIDATE_SECRET: 'test-revalidate-secret-0123456789abcdefghijklmn',
  LOG_LEVEL: 'error',
}

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    env: testEnv,
    setupFiles: ['tests/setup.js'],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
})
