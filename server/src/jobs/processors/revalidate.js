import { sendRevalidate } from '../../services/revalidate.js'

export const revalidateJob = (job) => sendRevalidate(job.data.tags)
