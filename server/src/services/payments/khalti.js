import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'

const TIMEOUT_MS = 10_000

export function requireKhalti() {
  if (!env.KHALTI_SECRET_KEY) throw ApiError.unavailable('Khalti payments are not set up')
}

async function call(path, body) {
  requireKhalti()
  let res
  try {
    res = await fetch(`${env.KHALTI_BASE_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${env.KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw ApiError.unavailable('Khalti did not respond; please try again')
  }
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

/**
 * KPG-2 initiate: amount in paisa. Returns { pidx, paymentUrl }. The price always comes from
 * the plans table on the server, never from the browser.
 */
export async function initiateKhalti({ paymentId, amountNpr, planName, customer }) {
  const { ok, data } = await call('/epayment/initiate/', {
    return_url: new URL('/business/plan/return/khalti', env.CLIENT_URL).toString(),
    website_url: env.CLIENT_URL,
    amount: amountNpr * 100,
    purchase_order_id: paymentId,
    purchase_order_name: planName,
    customer_info: {
      name: customer.name,
      email: customer.email,
      ...(customer.phone && { phone: customer.phone }),
    },
  })
  if (!ok || !data.pidx || !data.payment_url) {
    throw ApiError.unavailable('Khalti could not start the payment; please try again')
  }
  return { pidx: data.pidx, paymentUrl: data.payment_url }
}

/**
 * KPG-2 lookup. Only "Completed" with the expected amount counts as paid (Khalti docs).
 * Returns { outcome: 'paid' | 'pending' | 'failed', raw }.
 */
export async function lookupKhalti({ pidx, amountNpr }) {
  const { data } = await call('/epayment/lookup/', { pidx })
  const status = data.status
  if (status === 'Completed') {
    return { outcome: data.total_amount === amountNpr * 100 ? 'paid' : 'mismatch', raw: data }
  }
  if (['Pending', 'Initiated'].includes(status)) return { outcome: 'pending', raw: data }
  if (['Expired', 'User canceled', 'Refunded', 'Partially Refunded'].includes(status)) {
    return { outcome: 'failed', raw: data }
  }
  throw ApiError.unavailable('Khalti did not confirm the payment; please try again')
}
