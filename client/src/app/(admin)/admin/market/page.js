'use client'

import { useState } from 'react'
import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { DataTable } from '@/components/admin/DataTable'
import { QueueTabs } from '@/components/admin/QueueTabs'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { CloudImage } from '@/components/ui/CloudImage'
import { useAdminList } from '@/hooks/useAdminList'
import { formatDate, formatNpr, marketHref } from '@/lib/format'
import { market } from '@/services/admin.service'

const CONDITION = { NEW: 'New', LIKE_NEW: 'Like new', GOOD: 'Good', FAIR: 'Fair' }

export default function AdminMarketPage() {
  const toast = useToast()
  const [status, setStatus] = useState('PENDING')
  const { rows, query, tableProps } = useAdminList('market', market.list, { status })

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
      key: 'photos',
      header: 'Photos',
      render: (i) =>
        i.media.length ? (
          <ul className="flex max-w-56 flex-wrap gap-1">
            {i.media.map((m) => (
              <li key={m.id}>
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  <CloudImage
                    src={m.url}
                    alt={m.altText}
                    width={64}
                    height={48}
                    widths={[64, 128]}
                    sizes="64px"
                    className="aspect-[4/3] w-16 rounded-box object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          '—'
        ),
    },
    {
      key: 'title',
      header: 'Item',
      render: (i) => (
        <div className="flex max-w-sm flex-col">
          {i.status === 'LIVE' ? (
            <a href={marketHref(i.slug)} className="font-semibold text-brand hover:underline">
              {i.title}
            </a>
          ) : (
            <span className="font-semibold">{i.title}</span>
          )}
          <span className="text-sm text-text-muted">
            {formatNpr(i.priceNpr)} · {CONDITION[i.condition]} · {i.category.nameEn}
            {i.area && ` · ${i.area.nameEn}`}
          </span>
          {i.description && (
            <span className="line-clamp-3 text-sm whitespace-pre-line">{i.description}</span>
          )}
        </div>
      ),
    },
    {
      key: 'seller',
      header: 'Seller',
      render: (i) => (
        <div className="flex flex-col text-sm">
          <span>{i.seller.email}</span>
          <span className="text-text-muted">
            {[i.contactPhone, i.contactWhatsapp && `WhatsApp ${i.contactWhatsapp}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (i) => (
        <div className="flex flex-col text-sm">
          <span>Posted {formatDate(i.createdAt)}</span>
          {i.expiresAt && <span className="text-text-muted">Until {formatDate(i.expiresAt)}</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (i) => (
        <div className="flex flex-wrap gap-2">
          {['PENDING', 'REJECTED', 'EXPIRED'].includes(i.status) && (
            <Button onClick={() => run(() => market.approve(i.id), 'Item approved for 30 days')}>
              Approve
            </Button>
          )}
          {['PENDING', 'LIVE'].includes(i.status) && (
            <Button
              variant="secondary"
              onClick={() => run(() => market.reject(i.id), 'Item rejected')}
            >
              Reject
            </Button>
          )}
          <ConfirmButton
            title="Delete this item?"
            message={`"${i.title}" comes off the market and its photos are deleted.`}
            confirmLabel="Delete"
            onConfirm={() => run(() => market.remove(i.id), 'Item deleted')}
          >
            Delete
          </ConfirmButton>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Market" />
      <QueueTabs
        options={['PENDING', 'LIVE', 'SOLD', 'EXPIRED', 'REJECTED']}
        value={status}
        onChange={setStatus}
      />
      <DataTable
        caption="Market items"
        columns={columns}
        rows={rows}
        rowLabel={(i) => i.title}
        empty="No items here."
        {...tableProps}
      />
    </div>
  )
}
