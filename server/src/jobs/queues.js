import { Queue } from 'bullmq'
import { createQueueConnection } from '../config/redis.js'

export const QUEUE = {
  EMAIL: 'email',
  STATS: 'stats',
  DIRECTORY: 'directory',
  CACHE: 'cache',
  REVALIDATE: 'revalidate',
}

// Retries with backoff; completed jobs are trimmed, failed jobs stay for inspection (Part 3 §9).
export const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600 },
}

let connection
const queues = new Map()

export function getQueue(name) {
  if (!queues.has(name)) {
    connection ??= createQueueConnection()
    queues.set(name, new Queue(name, { connection, defaultJobOptions }))
  }
  return queues.get(name)
}

export function enqueue(queueName, jobName, data, opts) {
  return getQueue(queueName).add(jobName, data, opts)
}

export async function closeQueues() {
  await Promise.all([...queues.values()].map((q) => q.close()))
  queues.clear()
  if (connection) await connection.quit()
  connection = undefined
}
