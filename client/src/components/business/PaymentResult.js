'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, Clock } from 'lucide-react'
import { errorMessage } from '@/components/admin/Toast'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { withListing } from '@/hooks/useBusinessListing'
import { formatDate, formatNpr } from '@/lib/format'

function Panel({ tone, icon: Icon, title, children }) {
  const colour = { success: 'border-success', danger: 'border-danger', neutral: 'border-border' }
  const text = { success: 'text-success', danger: 'text-danger', neutral: 'text-text-muted' }
  return (
    <section
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex flex-col gap-3 rounded-box border p-4 ${colour[tone]}`}
    >
      <h2 className={`flex items-center gap-2 text-lg font-semibold ${text[tone]}`}>
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * Return page body: sends the gateway's reference to the API, which verifies with the gateway
 * before activating. The API is idempotent, so a reload or a second tab shows the same result.
 */
export function PaymentResult({ gateway, reference, displayRef = reference, verify }) {
  const queryClient = useQueryClient()
  const result = useQuery({
    queryKey: ['payment', gateway, reference],
    queryFn: () => verify(reference),
    enabled: Boolean(reference),
    retry: false,
    staleTime: Infinity,
  })
  const status = result.data?.status
  useEffect(() => {
    // The plan, history and invoices change once a payment is settled.
    if (status === 'COMPLETED' || status === 'FAILED')
      queryClient.invalidateQueries({ queryKey: ['business'] })
  }, [status, queryClient])

  const planHref = withListing('/business/plan', result.data?.listingId)
  const back = (
    <div className="flex flex-wrap gap-2">
      <Button href={planHref} variant="secondary">
        Back to plan
      </Button>
    </div>
  )

  let body
  if (!reference) {
    body = (
      <Panel tone="danger" icon={CircleAlert} title="No payment to check">
        <p>This page is opened by {gateway} after a payment. Start from your plan page.</p>
        {back}
      </Panel>
    )
  } else if (result.isPending) {
    body = (
      <div role="status" aria-label="Checking your payment" className="flex flex-col gap-3">
        <p>Checking your payment with {gateway}…</p>
        <Skeleton className="h-24 w-full" />
      </div>
    )
  } else if (result.isError) {
    // Only a gateway timeout or outage is worth retrying; a rejected response stays rejected.
    const retryable = !result.error.status || result.error.status >= 500
    body = (
      <Panel tone="danger" icon={CircleAlert} title="We could not confirm this payment">
        <p>{errorMessage(result.error)}</p>
        <p className="text-sm text-text-muted">
          No plan was activated. If money left your account, contact us with this reference:{' '}
          <span className="font-mono break-all">{displayRef}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {retryable && (
            <Button onClick={() => result.refetch()} loading={result.isFetching}>
              Check again
            </Button>
          )}
          <Button href="/contact" variant="secondary">
            Contact us
          </Button>
        </div>
      </Panel>
    )
  } else if (status === 'COMPLETED') {
    const p = result.data
    body = (
      <Panel tone="success" icon={CircleCheck} title="Payment received">
        <p>
          <strong>{p.plan}</strong> is active from {formatDate(p.startsAt)} until{' '}
          {formatDate(p.endsAt)}.
        </p>
        <p className="text-sm text-text-muted">
          Invoice {p.invoiceNo} · {formatNpr(p.amountNpr)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button href={withListing('/business/invoices', p.listingId)}>View invoices</Button>
          <Button href={planHref} variant="secondary">
            Back to plan
          </Button>
        </div>
      </Panel>
    )
  } else if (status === 'PENDING') {
    body = (
      <Panel tone="neutral" icon={Clock} title="Payment not confirmed yet">
        <p>
          {gateway} has not confirmed this payment yet. Your plan starts as soon as it does; check
          again in a minute.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => result.refetch()} loading={result.isFetching}>
            Check again
          </Button>
          <Button href={planHref} variant="secondary">
            Back to plan
          </Button>
        </div>
      </Panel>
    )
  } else {
    body = (
      <Panel tone="danger" icon={CircleAlert} title="Payment not completed">
        <p>The payment was cancelled or did not go through. No plan was activated.</p>
        {back}
      </Panel>
    )
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Plan payment</h1>
      {body}
    </div>
  )
}
