import { defineConfig } from 'vitest/config'
import { testEnv } from './tests/testEnv.js'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    env: testEnv,
    globalSetup: ['tests/globalSetup.js'],
    setupFiles: ['tests/setup.js'],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
})
