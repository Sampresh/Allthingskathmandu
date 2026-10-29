import { runImport } from '../../services/listingImport.js'

// Progress is { done, total } rows; the return value holds the counts and row report.
export const importListingsJob = (job) =>
  runImport({ ...job.data, onProgress: (progress) => job.updateProgress(progress) })
