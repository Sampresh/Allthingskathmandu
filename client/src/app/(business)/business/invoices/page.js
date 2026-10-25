'use client'

import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/admin/DataTable'
import { useBusinessListing } from '@/hooks/useBusinessListing'
import { formatDate, formatNpr } from '@/lib/format'
import { getInvoices } from '@/services/business.service'

export default function InvoicesPage() {
  const { listingId } = useBusinessListing()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['business', 'invoices', listingId],
    queryFn: () => getInvoices(listingId),
    enabled: Boolean(listingId),
  })
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <DataTable
        caption="Invoices"
        loading={isPending}
        error={isError}
        onRetry={refetch}
        rows={data ?? []}
        rowLabel={(p) => p.invoiceNo}
        empty="No payments yet."
        columns={[
          { key: 'invoiceNo', header: 'Invoice' },
          { key: 'date', header: 'Paid', render: (p) => formatDate(p.verifiedAt) },
          { key: 'plan', header: 'Plan', render: (p) => p.subscription.plan.name },
          {
            key: 'period',
            header: 'Period',
            render: (p) =>
              p.subscription.startsAt
                ? `${formatDate(p.subscription.startsAt)} – ${formatDate(p.subscription.endsAt)}`
                : '—',
          },
          { key: 'amount', header: 'Amount', render: (p) => formatNpr(p.amountNpr) },
          {
            key: 'gateway',
            header: 'Paid with',
            render: (p) => (p.gateway === 'KHALTI' ? 'Khalti' : 'eSewa'),
          },
        ]}
      />
    </div>
  )
}
