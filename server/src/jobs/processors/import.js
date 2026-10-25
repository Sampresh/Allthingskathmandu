import { importListings } from '../../services/listingImport.js'

export const importListingsJob = (job) => importListings(job.data)
