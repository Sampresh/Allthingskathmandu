import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { env } from './env.js'

const create = (connectionString) =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 10, connectionTimeoutMillis: 5000 }),
  })

export const db = create(env.DATABASE_URL)
export const readDb = env.DATABASE_REPLICA_URL ? create(env.DATABASE_REPLICA_URL) : db
