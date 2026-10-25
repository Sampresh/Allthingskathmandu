'use client'

import { useSearchParams } from 'next/navigation'
import { PaymentResult } from '@/components/business/PaymentResult'
import { khaltiVerify } from '@/services/business.service'

/** Khalti's return_url: `?pidx=…&status=…`. Only the API's lookup decides the outcome. */
export default function KhaltiReturnPage() {
  const pidx = useSearchParams().get('pidx')
  return <PaymentResult gateway="Khalti" reference={pidx} verify={khaltiVerify} />
}
