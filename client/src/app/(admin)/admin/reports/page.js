'use client'

import { useState } from 'react'
import { DataTable } from '@/components/admin/DataTable'
import { QueueTabs } from '@/components/admin/QueueTabs'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Button } from '@/components/ui/Button'
import { useAdminList } from '@/hooks/useAdminList'
import { formatDate } from '@/lib/format'
import { reports } from '@/services/admin.service'

const REASONS = {
  closed: 'Permanently closed',
  wrong_contact: 'Wrong phone or contact',
  wrong_location: 'Wrong address or map pin',
  wrong_hours: 'Wrong opening hours',
  wrong_details: 'Other details wrong',
  inappropriate: 'Inappropriate content',
  spam: 'Spam or fake',
  other: 'Something else',
}

function targetLink(report) {
  const t = report.target
  if (!t) return <span className="text-text-muted">Removed</span>
  if (report.entityType === 'BUSINESS') {
    return (
      <a href={`/admin/listings/${t.id}`} className="font-semibold text-brand hover:underline">
        {t.name}
      </a>
    )
  }
  if (report.entityType === 'REVIEW') return <span>Review: “{(t.body ?? '').slice(0, 60)}”</span>
  return <span>{t.title}</span>
}

export default function ReportsPage() {
  const toast = useToast()
  const [status, setStatus] = useState('OPEN')
  const { rows, query, tableProps } = useAdminList('reports', reports.list, { status })

  const update = async (id, next) => {
    try {
      await reports.update(id, next)
      toast(
        next === 'RESOLVED' ? 'Marked as fixed' : next === 'DISMISSED' ? 'Dismissed' : 'Reopened',
      )
      query.refetch()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const columns = [
    {
      key: 'entityType',
      header: 'Type',
      render: (r) => r.entityType.replace('_', ' ').toLowerCase(),
    },
    { key: 'target', header: 'About', render: targetLink },
    { key: 'reason', header: 'Reason', render: (r) => REASONS[r.reason] ?? r.reason },
    {
      key: 'details',
      header: 'Details',
      render: (r) => <p className="max-w-sm whitespace-pre-line">{r.details || '—'}</p>,
    },
    { key: 'createdAt', header: 'Sent', render: (r) => formatDate(r.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (r) =>
        r.status === 'OPEN' ? (
          <div className="flex gap-2">
            <Button onClick={() => update(r.id, 'RESOLVED')}>Fixed</Button>
            <Button variant="secondary" onClick={() => update(r.id, 'DISMISSED')}>
              Dismiss
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => update(r.id, 'OPEN')}>
            Reopen
          </Button>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <QueueTabs options={['OPEN', 'RESOLVED', 'DISMISSED']} value={status} onChange={setStatus} />
      <DataTable
        caption="Reports"
        columns={columns}
        rows={rows}
        rowLabel={(r) => `report ${r.id}`}
        empty="No reports here."
        {...tableProps}
      />
    </div>
  )
}
