import { refreshCategoryCounts, syncListings } from '../../services/listingSync.js'

export const refreshCountsJob = () => refreshCategoryCounts()

// job.data.businessIds: sync only these listings; omitted: every listing.
export const syncListingsJob = (job) => syncListings(job.data?.businessIds)
