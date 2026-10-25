'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/admin/DataTable'
import { SelectField } from '@/components/admin/Fields'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useAdminList } from '@/hooks/useAdminList'
import { formatDate, formatNpr } from '@/lib/format'
import { payments } from '@/services/admin.service'

const tone = { COMPLETED: 'success', INITIATED: 'neutral', FAILED: 'danger', REFUNDED: 'brand' }

function PaymentDetail({ id, onClose }) {
  const { data } = useQuery({ queryKey: ['admin', 'payment', id], queryFn: () => payments.get(id) })
  return (
    <Dialog open onClose={onClose} title="Payment">
      {!data ? (
        <p>Loading…</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-semibold">Listing</dt>
          <dd>{data.business.name}</dd>
          <dt className="font-semibold">Owner</dt>
          <dd>{data.business.owner?.email ?? '—'}</dd>
          <dt className="font-semibold">Plan</dt>
          <dd>{data.subscription.plan.name}</dd>
          <dt className="font-semibold">Amount</dt>
          <dd>{formatNpr(data.amountNpr)}</dd>
          <dt className="font-semibold">Gateway</dt>
          <dd>
            {data.gateway} · {data.gatewayRef}
          </dd>
          <dt className="font-semibold">Invoice</dt>
          <dd>{data.invoiceNo ?? '—'}</dd>
          <dt className="font-semibold">Status</dt>
          <dd>{data.status}</dd>
          <dt className="font-semibold">Verified</dt>
          <dd>{data.verifiedAt ? formatDate(data.verifiedAt) : '—'}</dd>
          <dt className="font-semibold">Gateway response</dt>
          <dd>
            <pre className="max-h-60 overflow-auto rounded-box bg-surface-raised p-2 text-xs">
              {JSON.stringify(data.raw, null, 2)}
            </pre>
          </dd>
        </dl>
      )}
    </Dialog>
  )
}

export default function PaymentsPage() {
  const [status, setStatus] = useState('')
  const [gateway, setGateway] = useState('')
  const [open, setOpen] = useState(null)
  const { rows, tableProps } = useAdminList('payments', payments.list, { status, gateway })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <div className="flex flex-wrap gap-3">
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any</option>
          {Object.keys(tone).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <SelectField label="Gateway" value={gateway} onChange={(e) => setGateway(e.target.value)}>
          <option value="">Any</option>
          <option>KHALTI</option>
          <option>ESEWA</option>
        </SelectField>
      </div>
      <DataTable
        caption="Payments"
        rows={rows}
        rowLabel={(p) => p.invoiceNo ?? p.gatewayRef}
        empty="No payments yet."
        columns={[
          { key: 'createdAt', header: 'Date', render: (p) => formatDate(p.createdAt) },
          { key: 'business', header: 'Listing', render: (p) => p.business.name },
          { key: 'plan', header: 'Plan', render: (p) => p.subscription.plan.name },
          { key: 'amount', header: 'Amount', render: (p) => formatNpr(p.amountNpr) },
          { key: 'gateway', header: 'Gateway' },
          {
            key: 'status',
            header: 'Status',
            render: (p) => <Badge tone={tone[p.status]}>{p.status}</Badge>,
          },
          { key: 'invoiceNo', header: 'Invoice', render: (p) => p.invoiceNo ?? '—' },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            render: (p) => (
              <Button variant="secondary" onClick={() => setOpen(p.id)}>
                Details
              </Button>
            ),
          },
        ]}
        {...tableProps}
      />
      {open && <PaymentDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
