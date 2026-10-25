import bcrypt from 'bcryptjs'
import { db } from '../../src/config/db.js'
import { redis } from '../../src/config/redis.js'
import { getQueue, QUEUE } from '../../src/jobs/queues.js'

export const PASSWORD = 'Correct-Horse-9'

let counter = 0

/** Creates a verified user directly in the database (low bcrypt cost for speed). */
export async function createUser(data = {}) {
  counter += 1
  return db.user.create({
    data: {
      email: `user${counter}-${Date.now()}@atk.test`,
      name: `User ${counter}`,
      passwordHash: await bcrypt.hash(data.password ?? PASSWORD, 4),
      emailVerifiedAt: new Date(),
      ...Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'password')),
    },
  })
}

/** Clears rate-limit counters, TOTP replay guards and queued jobs (test Redis DB only). */
export const flushRedis = () => redis.flushdb()

export const cookieValue = (res, name) => {
  const header = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`))
  return header ? header.split(';')[0].slice(name.length + 1) : undefined
}

export const cookieHeader = (res, name) =>
  (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`))

/** Polls the email queue until a job for `to` with `template` exists. */
export async function waitForEmail(to, template, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const jobs = await getQueue(QUEUE.EMAIL).getJobs(['waiting', 'active', 'completed', 'delayed'])
    const job = jobs.find((j) => j.data.to === to && j.data.template === template)
    if (job) return job.data
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`no ${template} email for ${to}`)
}

export async function emailJobs() {
  return getQueue(QUEUE.EMAIL).getJobs(['waiting', 'active', 'completed', 'delayed'])
}

export const tokenFromUrl = (url) => new URL(url).searchParams.get('token')

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
