'use client'

import { use } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { canSee } from '@/components/admin/adminNav'
import { ListingEditor } from '@/components/admin/listings/ListingEditor'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { listings } from '@/services/admin.service'
import { useAuthStore } from '@/store/authStore'

export default function EditListingPage({ params }) {
  const { id } = use(params)
  const toast = useToast()
  const queryClient = useQueryClient()
  const canEdit = canSee(
    useAuthStore((s) => s.user.role),
    'ADMIN',
  )
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'listing', id],
    queryFn: () => listings.get(id),
  })

  if (isPending) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label="Loading listing">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (isError) {
    return (
      <p className="flex items-center gap-3 text-danger" role="alert">
        This listing could not be loaded.
        <Button variant="secondary" onClick={() => refetch()}>
          Try again
        </Button>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {data.deletedAt && (
        <div className="flex flex-wrap items-center gap-3 rounded-box border border-danger bg-danger/5 p-4">
          <p className="mr-auto">
            This listing is in Trash and hidden from the site. Restore it to edit.
          </p>
          {canEdit && (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  queryClient.setQueryData(['admin', 'listing', id], await listings.restore(id))
                  await queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] })
                  toast('Restored')
                } catch (err) {
                  toast(errorMessage(err), 'error')
                }
              }}
            >
              <RotateCcw aria-hidden="true" className="size-4" /> Restore
            </Button>
          )}
        </div>
      )}
      <ListingEditor
        key={`${data.id}-${Boolean(data.deletedAt)}`}
        listing={data}
        canEdit={canEdit && !data.deletedAt}
      />
    </div>
  )
}
