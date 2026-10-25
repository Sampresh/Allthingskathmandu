/**
 * Processor registry: queue name → { concurrency, handlers: { [jobName]: async (job) => result } }.
 * worker.js starts one BullMQ Worker per queue listed here and dispatches by job name.
 */
export const processors = {}
