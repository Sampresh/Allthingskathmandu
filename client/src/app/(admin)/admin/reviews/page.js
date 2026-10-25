'use client'

import { useState } from 'react'
import { DataTable } from '@/components/admin/DataTable'
import { QueueTabs } from '@/components/admin/QueueTabs'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Button } from '@/components/ui/Button'
import { Stars } from '@/components/ui/Rating'
import { useAdminList } from '@/hooks/useAdminList'
import { formatDate } from '@/lib/format'
import { reviews } from '@/services/admin.service'

export default function ReviewsPage() {
  const toast = useToast()
  const [status, setStatus] = useState('PENDING')
  const [selected, setSelected] = useState(new Set())
  const { rows, query, tableProps } = useAdminList('reviews', reviews.list, { status })

  const decide = async (ids, approve) => {
    let done = 0
    for (const id of ids) {
      try {
        await (approve ? reviews.approve(id) : reviews.reject(id))
        done += 1
      } catch (err) {
        toast(errorMessage(err), 'error')
      }
    }
    toast(`${done} review${done === 1 ? '' : 's'} ${approve ? 'approved' : 'rejected'}`)
    setSelected(new Set())
    query.refetch()
  }

  const columns = [
    { key: 'business', header: 'Listing', render: (r) => r.business.name },
    { key: 'rating', header: 'Rating', render: (r) => <Stars value={r.rating} /> },
    {
      key: 'body',
      header: 'Review',
      render: (r) => <p className="max-w-md whitespace-pre-line">{r.body || '—'}</p>,
    },
    { key: 'user', header: 'By', render: (r) => r.user.email },
    { key: 'createdAt', header: 'Sent', render: (r) => formatDate(r.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (r) => (
        <div className="flex gap-2">
          {r.status !== 'APPROVED' && <Button onClick={() => decide([r.id], true)}>Approve</Button>}
          {r.status !== 'REJECTED' && (
            <Button variant="secondary" onClick={() => decide([r.id], false)}>
              Reject
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Reviews</h1>
      <QueueTabs
        options={['PENDING', 'APPROVED', 'REJECTED']}
        value={status}
        onChange={(s) => {
          setStatus(s)
          setSelected(new Set())
        }}
      />
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-box border border-brand p-3">
          <p className="font-semibold">{selected.size} selected</p>
          <Button onClick={() => decide(selected, true)}>Approve selected</Button>
          <Button variant="secondary" onClick={() => decide(selected, false)}>
            Reject selected
          </Button>
        </div>
      )}
      <DataTable
        caption="Reviews"
        columns={columns}
        rows={rows}
        rowLabel={(r) => `review of ${r.business.name}`}
        selected={selected}
        onSelectedChange={setSelected}
        empty="No reviews here."
        {...tableProps}
      />
    </div>
  )
}
