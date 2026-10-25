import { QUEUE } from '../queues.js'
import { sendEmailJob } from './email.js'

/**
 * Processor registry: queue name → { concurrency, handlers: { [jobName]: async (job) => result } }.
 * worker.js starts one BullMQ Worker per queue listed here and dispatches by job name.
 */
export const processors = {
  [QUEUE.EMAIL]: { concurrency: 5, handlers: { send: sendEmailJob } },
}
