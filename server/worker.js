import { Worker } from 'bullmq'
import { db, readDb } from './src/config/db.js'
import { createQueueConnection } from './src/config/redis.js'
import { closeQueues } from './src/jobs/queues.js'
import { processors } from './src/jobs/processors/index.js'
import { registerSchedules } from './src/jobs/schedules.js'
import { logger } from './src/utils/logger.js'

const SHUTDOWN_TIMEOUT_MS = 25_000

const connection = createQueueConnection({ worker: true })

function dispatcher(queueName, handlers) {
  return async (job) => {
    const handler = handlers[job.name]
    if (!handler) throw new Error(`no handler for ${queueName}:${job.name}`)
    return handler(job)
  }
}

const workers = Object.entries(processors).map(([queueName, { handlers, concurrency = 5 }]) => {
  const worker = new Worker(queueName, dispatcher(queueName, handlers), {
    connection,
    concurrency,
  })
  worker.on('failed', (job, err) =>
    logger.error(`job failed ${queueName}:${job?.name} (${job?.id}): ${err.message}`, {
      attemptsMade: job?.attemptsMade,
    }),
  )
  worker.on('error', (err) => logger.error(`worker error on ${queueName}: ${err.message}`))
  return worker
})

logger.info(`worker started: ${workers.length} queue(s)`)

registerSchedules()
  .then((count) => logger.info(`registered ${count} repeatable job(s)`))
  .catch((err) => logger.error(`could not register repeatable jobs: ${err.message}`))

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info(`${signal} received: finishing active jobs`)

  setTimeout(() => {
    logger.error('graceful shutdown timed out, exiting')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS).unref()

  await Promise.allSettled(workers.map((w) => w.close()))
  await Promise.allSettled([
    closeQueues(),
    connection.quit(),
    db.$disconnect(),
    readDb === db ? null : readDb.$disconnect(),
  ])
  logger.info('worker stopped')
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => logger.error('unhandled rejection', { reason }))
