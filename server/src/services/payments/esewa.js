import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'

const TIMEOUT_MS = 10_000
const REQUEST_FIELDS = 'total_amount,transaction_uuid,product_code'

export function requireEsewa() {
  if (!env.ESEWA_SECRET_KEY || !env.ESEWA_STATUS_URL)
    throw ApiError.unavailable('eSewa payments are not set up')
}

/** ePay v2 signature: base64 HMAC-SHA256 of "field=value,…" in signed_field_names order. */
export function esewaSignature(fields, signedFieldNames) {
  const message = signedFieldNames
    .split(',')
    .map((name) => `${name}=${fields[name]}`)
    .join(',')
  return createHmac('sha256', env.ESEWA_SECRET_KEY).update(message).digest('base64')
}

/** Signed form fields the browser posts to eSewa (ePay v2). */
export function esewaForm({ transactionUuid, amountNpr }) {
  requireEsewa()
  const fields = {
    amount: String(amountNpr),
    tax_amount: '0',
    product_service_charge: '0',
    product_delivery_charge: '0',
    total_amount: String(amountNpr),
    transaction_uuid: transactionUuid,
    product_code: env.ESEWA_PRODUCT_CODE,
    success_url: new URL('/business/plan/return/esewa/success', env.CLIENT_URL).toString(),
    failure_url: new URL('/business/plan/return/esewa/failure', env.CLIENT_URL).toString(),
    signed_field_names: REQUEST_FIELDS,
  }
  return {
    formUrl: env.ESEWA_FORM_URL,
    fields: { ...fields, signature: esewaSignature(fields, REQUEST_FIELDS) },
  }
}

/**
 * Decodes and checks the base64 `data` eSewa adds to the success URL. Returns the response
 * fields; throws when the signature does not match.
 */
export function decodeEsewaResponse(data) {
  requireEsewa()
  let fields
  try {
    fields = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
  } catch {
    throw ApiError.badRequest('Unreadable eSewa response')
  }
  const expected = Buffer.from(esewaSignature(fields, String(fields.signed_field_names ?? '')))
  const given = Buffer.from(String(fields.signature ?? ''))
  if (
    !fields.signed_field_names ||
    expected.length !== given.length ||
    !timingSafeEqual(expected, given)
  ) {
    throw new ApiError(400, 'SIGNATURE_INVALID', 'The eSewa response could not be verified')
  }
  if (fields.product_code !== env.ESEWA_PRODUCT_CODE)
    throw new ApiError(400, 'SIGNATURE_INVALID', 'Wrong merchant')
  return fields
}

/** "4,000.0" → 4000 */
export const esewaAmount = (value) => Number(String(value).replace(/,/g, ''))

/** Status check API. Returns { outcome: 'paid' | 'pending' | 'failed', raw }. */
export async function checkEsewa({ transactionUuid, amountNpr }) {
  requireEsewa()
  const url = new URL(env.ESEWA_STATUS_URL)
  url.searchParams.set('product_code', env.ESEWA_PRODUCT_CODE)
  url.searchParams.set('total_amount', String(amountNpr))
  url.searchParams.set('transaction_uuid', transactionUuid)

  let data
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    data = await res.json()
  } catch {
    throw ApiError.unavailable('eSewa did not respond; please try again')
  }
  if (data.status === 'COMPLETE') {
    return {
      outcome: esewaAmount(data.total_amount) === amountNpr ? 'paid' : 'mismatch',
      raw: data,
    }
  }
  if (['PENDING', 'AMBIGUOUS'].includes(data.status)) return { outcome: 'pending', raw: data }
  if (['NOT_FOUND', 'CANCELED', 'FULL_REFUND', 'PARTIAL_REFUND'].includes(data.status)) {
    return { outcome: 'failed', raw: data }
  }
  throw ApiError.unavailable('eSewa did not confirm the payment; please try again')
}
