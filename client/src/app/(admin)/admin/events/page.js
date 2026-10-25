'use client'

import { useState } from 'react'
import { EventForm } from '@/components/account/EventForm'
import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { DataTable } from '@/components/admin/DataTable'
import { QueueTabs } from '@/components/admin/QueueTabs'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useAdminList } from '@/hooks/useAdminList'
import { formatClock, formatDay } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { events } from '@/services/admin.service'

export default function AdminEventsPage() {
  const toast = useToast()
  const [status, setStatus] = useState('PENDING')
  const [editing, setEditing] = useState(null)
  const { rows, query, tableProps } = useAdminList('events', events.list, { status })

  const run = async (action, message) => {
    try {
      await action()
      toast(message)
      query.refetch()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const columns = [
    {
      key: 'title',
      header: 'Event',
      render: (e) => (
        <div className="flex max-w-sm flex-col">
          <span className="font-semibold">{e.title}</span>
          {e.description && (
            <span className="line-clamp-2 text-sm text-text-muted">{e.description}</span>
          )}
        </div>
      ),
    },
    {
      key: 'when',
      header: 'When',
      render: (e) => `${formatDay(e.startsAt)}, ${formatClock(e.startsAt)}`,
    },
    {
      key: 'where',
      header: 'Where',
      render: (e) => [e.venue, e.area?.nameEn].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'by',
      header: 'Submitted by',
      render: (e) => (
        <div className="flex flex-col text-sm">
          <span>{e.submittedBy?.email ?? '—'}</span>
          {e.business && <span className="text-text-muted">for {e.business.name}</span>}
        </div>
      ),
    },
    { key: 'createdAt', header: 'Sent', render: (e) => formatDate(e.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (e) => (
        <div className="flex flex-wrap gap-2">
          {e.status !== 'APPROVED' && (
            <Button onClick={() => run(() => events.approve(e.id), 'Event approved')}>
              Approve
            </Button>
          )}
          {e.status !== 'REJECTED' && (
            <Button
              variant="secondary"
              onClick={() => run(() => events.reject(e.id), 'Event rejected')}
            >
              Reject
            </Button>
          )}
          <Button variant="secondary" onClick={() => setEditing(e)}>
            Edit
          </Button>
          <ConfirmButton
            title="Delete this event?"
            message={`"${e.title}" and its cover image are removed for good.`}
            confirmLabel="Delete"
            onConfirm={() => run(() => events.remove(e.id), 'Event deleted')}
          >
            Delete
          </ConfirmButton>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Events</h1>
      <QueueTabs
        options={['PENDING', 'APPROVED', 'REJECTED']}
        value={status}
        onChange={setStatus}
      />
      <DataTable
        caption="Events"
        columns={columns}
        rows={rows}
        rowLabel={(e) => e.title}
        empty="No events here."
        {...tableProps}
      />
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit event">
        {editing && (
          <EventForm
            key={editing.id}
            event={editing}
            allowPast
            submitKey="events.form.save"
            onSubmit={async (body) => {
              await events.update(editing.id, body)
              toast('Event saved')
              query.refetch()
            }}
          />
        )}
      </Dialog>
    </div>
  )
}
