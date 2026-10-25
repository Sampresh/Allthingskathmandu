import { env } from './src/config/env.js'
import { flushSentry } from './src/config/sentry.js'
import { db, readDb } from './src/config/db.js'
import { redis, connectRedis } from './src/config/redis.js'
import { createApp } from './src/app.js'
import { closeQueues } from './src/jobs/queues.js'
import { logger } from './src/utils/logger.js'

const SHUTDOWN_TIMEOUT_MS = 25_000

async function main() {
  try {
    await db.$queryRaw`SELECT 1`
  } catch (err) {
    logger.error(`database unreachable at startup: ${err.message}`)
    process.exit(1)
  }
  await connectRedis()

  const server = createApp().listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
  })
  // Outlive the load balancer's idle timeout so it never reuses a socket we just closed.
  server.keepAliveTimeout = 65_000
  server.headersTimeout = 66_000

  let shuttingDown = false
  const shutdown = (signal) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`${signal} received: closing server`)

    setTimeout(() => {
      logger.error('graceful shutdown timed out, exiting')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS).unref()

    // Stop accepting connections, let in-flight requests finish, then close clients.
    server.close(async (err) => {
      if (err) logger.error(err)
      await Promise.allSettled([
        db.$disconnect(),
        readDb === db ? null : readDb.$disconnect(),
        closeQueues(),
        redis.quit(),
        flushSentry(),
      ])
      logger.info('shutdown complete')
      process.exit(err ? 1 : 0)
    })
    server.closeIdleConnections()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

// Sentry's default integrations report both of these; flush before exiting.
process.on('unhandledRejection', (reason) => logger.error('unhandled rejection', { reason }))
process.on('uncaughtException', (err) => {
  logger.error(err)
  flushSentry().finally(() => process.exit(1))
})

main()
