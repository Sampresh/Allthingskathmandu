import { afterAll } from 'vitest'
import { db } from '../src/config/db.js'
import { redis, connectRedis } from '../src/config/redis.js'
import { closeQueues } from '../src/jobs/queues.js'

await connectRedis()

afterAll(async () => {
  await Promise.allSettled([closeQueues(), redis.quit(), db.$disconnect()])
})
