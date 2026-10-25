import { destroyAsset } from '../../services/media.js'

export const deleteMediaJob = (job) => destroyAsset(job.data.publicId)
