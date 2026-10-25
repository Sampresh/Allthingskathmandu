'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Button } from '@/components/ui/Button'
import { esewaInitiate, khaltiInitiate } from '@/services/business.service'

/** eSewa ePay v2 takes a browser form POST; the API signs the fields. */
function postToEsewa({ formUrl, fields }) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = formUrl
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.append(input)
  }
  document.body.append(form)
  form.submit()
}

/** Starts a plan purchase. The price is read from `plans` on the server, never sent from here. */
export function PayButtons({ listingId, plan, describedBy }) {
  const toast = useToast()
  const [leaving, setLeaving] = useState(null)
  const start = useMutation({
    mutationFn: ({ gateway }) =>
      (gateway === 'khalti' ? khaltiInitiate : esewaInitiate)({
        businessId: listingId,
        planCode: plan.code,
      }),
    onSuccess: (data, { gateway }) => {
      // Keep the buttons disabled while the browser leaves for the gateway.
      setLeaving(gateway)
      if (gateway === 'khalti') window.location.assign(data.paymentUrl)
      else postToEsewa(data)
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  })
  useEffect(() => {
    // Back from the gateway restores this page from the bfcache: enable the buttons again.
    const onShow = (event) => event.persisted && setLeaving(null)
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])
  const busy = start.isPending || leaving !== null
  const pending = start.isPending ? start.variables.gateway : leaving

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() => start.mutate({ gateway: 'khalti' })}
        disabled={busy}
        loading={pending === 'khalti'}
        aria-describedby={describedBy}
      >
        Pay with Khalti
      </Button>
      <Button
        variant="secondary"
        onClick={() => start.mutate({ gateway: 'esewa' })}
        disabled={busy}
        loading={pending === 'esewa'}
        aria-describedby={describedBy}
      >
        Pay with eSewa
      </Button>
    </div>
  )
}
