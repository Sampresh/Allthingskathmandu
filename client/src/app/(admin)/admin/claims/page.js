'use client'

import { useState } from 'react'
import { DataTable } from '@/components/admin/DataTable'
import { TextField } from '@/components/admin/Fields'
import { QueueTabs } from '@/components/admin/QueueTabs'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useAdminList } from '@/hooks/useAdminList'
import { formatDate } from '@/lib/format'
import { claims } from '@/services/admin.service'

export default function ClaimsPage() {
  const toast = useToast()
  const [status, setStatus] = useState('PENDING')
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const { rows, query, tableProps } = useAdminList('claims', claims.list, { status })

  const act = async (fn, message) => {
    try {
      await fn()
      toast(message)
      query.refetch()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const columns = [
    {
      key: 'business',
      header: 'Listing',
      render: (c) => (
        <a
          href={`/admin/listings/${c.business.id}`}
          className="font-semibold text-brand hover:underline"
        >
          {c.business.name}
        </a>
      ),
    },
    {
      key: 'user',
      header: 'Claimed by',
      render: (c) => (
        <>
          {c.user.name}
          <br />
          <span className="text-text-muted">{c.user.email}</span>
          {c.user.phone && <span className="block text-text-muted">{c.user.phone}</span>}
        </>
      ),
    },
    {
      key: 'proof',
      header: 'Proof',
      render: (c) => (
        <>
          {c.note && <p className="max-w-xs whitespace-pre-line">{c.note}</p>}
          {c.proofUrl && (
            <a
              href={c.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline"
            >
              Open document
            </a>
          )}
          {!c.note && !c.proofUrl && '—'}
        </>
      ),
    },
    { key: 'createdAt', header: 'Sent', render: (c) => formatDate(c.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (c) =>
        c.status === 'PENDING' && (
          <div className="flex gap-2">
            <Button
              onClick={() =>
                act(() => claims.approve(c.id), `${c.business.name} now belongs to ${c.user.email}`)
              }
            >
              Approve
            </Button>
            <Button variant="secondary" onClick={() => setRejecting(c)}>
              Reject
            </Button>
          </div>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Listing claims</h1>
      <QueueTabs
        options={['PENDING', 'APPROVED', 'REJECTED']}
        value={status}
        onChange={setStatus}
      />
      <DataTable
        caption="Claims"
        columns={columns}
        rows={rows}
        rowLabel={(c) => c.business.name}
        empty="No claims here."
        {...tableProps}
      />
      <Dialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject claim"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await act(
                  () => claims.reject(rejecting.id, reason.trim() || undefined),
                  'Claim rejected',
                )
                setRejecting(null)
                setReason('')
              }}
            >
              Reject
            </Button>
          </div>
        }
      >
        <TextField
          label="Reason (sent to the claimant)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Dialog>
    </div>
  )
}
