'use client'

import { useSearchParams } from 'next/navigation'
import { PaymentResult } from '@/components/business/PaymentResult'
import { esewaVerify } from '@/services/business.service'

/** The transaction id to quote to support; the API does the real (signed) check. */
function transactionUuid(data) {
  try {
    return JSON.parse(atob(data)).transaction_uuid ?? data
  } catch {
    return data
  }
}

/** eSewa's success_url: `?data=<base64 signed JSON>`, checked by the API with the status API. */
export default function EsewaSuccessPage() {
  const data = useSearchParams().get('data')
  return (
    <PaymentResult
      gateway="eSewa"
      reference={data}
      displayRef={data && transactionUuid(data)}
      verify={esewaVerify}
    />
  )
}
