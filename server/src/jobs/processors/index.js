import { QUEUE } from '../queues.js'
import { purgeCacheJob } from './cache.js'
import { refreshCountsJob, syncListingsJob } from './directory.js'
import { sendEmailJob } from './email.js'
import { flushStatsJob } from './stats.js'

/**
 * Processor registry: queue name → { concurrency, handlers: { [jobName]: async (job) => result } }.
 * worker.js starts one BullMQ Worker per queue listed here and dispatches by job name.
 */
export const processors = {
  [QUEUE.EMAIL]: { concurrency: 5, handlers: { send: sendEmailJob } },
  [QUEUE.CACHE]: { concurrency: 2, handlers: { purge: purgeCacheJob } },
  [QUEUE.STATS]: { concurrency: 1, handlers: { flush: flushStatsJob } },
  [QUEUE.DIRECTORY]: {
    concurrency: 1,
    handlers: { 'refresh-counts': refreshCountsJob, 'sync-listings': syncListingsJob },
  },
}
