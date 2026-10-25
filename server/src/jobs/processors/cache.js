import { purgeAll, purgeTags } from '../../services/cache.js'

// job.data: { tags: [...] } or { all: true }
export async function purgeCacheJob(job) {
  const purged = job.data.all ? await purgeAll() : await purgeTags(job.data.tags ?? [])
  return { purged }
}
