import { QUEUE, getQueue } from './queues.js'

const MINUTE = 60 * 1000

// Repeatable jobs. upsertJobScheduler is idempotent, so every worker start re-applies these.
const SCHEDULES = [
  { queue: QUEUE.STATS, id: 'stats-flush', every: 5 * MINUTE, name: 'flush' },
  { queue: QUEUE.DIRECTORY, id: 'directory-counts', every: 10 * MINUTE, name: 'refresh-counts' },
  { queue: QUEUE.DIRECTORY, id: 'directory-sync', every: 10 * MINUTE, name: 'sync-listings' },
]

export async function registerSchedules() {
  for (const { queue, id, every, name } of SCHEDULES) {
    await getQueue(queue).upsertJobScheduler(id, { every }, { name })
  }
  return SCHEDULES.length
}
