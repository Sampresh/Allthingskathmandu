import { execFileSync } from 'node:child_process'
import { testEnv } from './testEnv.js'

// Bring the test database to the latest migration once per run.
export function setup() {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'pipe',
    env: { ...process.env, ...testEnv, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  })
}
