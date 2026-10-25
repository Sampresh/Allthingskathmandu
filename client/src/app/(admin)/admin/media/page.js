'use client'

import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { DataTable } from '@/components/admin/DataTable'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { CloudImage } from '@/components/ui/CloudImage'
import { useAdminList } from '@/hooks/useAdminList'
import { formatDate } from '@/lib/format'
import { media as mediaApi } from '@/services/admin.service'

export default function AdminMediaPage() {
  const toast = useToast()
  const { rows, query, tableProps } = useAdminList('media', mediaApi.list, {})
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Media</h1>
      <DataTable
        caption="Photos and videos"
        rows={rows}
        rowLabel={(m) => m.altText}
        empty="No photos or videos yet."
        columns={[
          {
            key: 'preview',
            header: 'Preview',
            render: (m) =>
              m.type === 'PHOTO' ? (
                <CloudImage
                  src={m.url}
                  alt={m.altText}
                  width={96}
                  height={72}
                  className="aspect-[4/3] w-24 rounded-box object-cover"
                />
              ) : (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline"
                >
                  Video link
                </a>
              ),
          },
          { key: 'altText', header: 'Description' },
          { key: 'business', header: 'Listing', render: (m) => m.business.name },
          { key: 'createdAt', header: 'Added', render: (m) => formatDate(m.createdAt) },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            render: (m) => (
              <ConfirmButton
                title="Remove media"
                message="Remove this from the listing and delete the file?"
                confirmLabel="Remove"
                onConfirm={async () => {
                  try {
                    await mediaApi.remove(m.id)
                    toast('Removed')
                    query.refetch()
                  } catch (err) {
                    toast(errorMessage(err), 'error')
                  }
                }}
              >
                Remove
              </ConfirmButton>
            ),
          },
        ]}
        {...tableProps}
      />
    </div>
  )
}
