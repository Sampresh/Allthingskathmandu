import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 50

/** Opaque cursor: base64url JSON. Lists never use page numbers or OFFSET. */
export const encodeCursor = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** Decodes and validates a cursor against `schema`; a tampered cursor is a 400. */
export function decodeCursor(cursor, schema) {
  if (!cursor) return null
  try {
    return schema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')))
  } catch {
    throw ApiError.badRequest('Invalid cursor')
  }
}

/** Keyset position: [sortKey, id]. */
export const keysetSchema = z.tuple([z.number().finite(), z.uuid()])
