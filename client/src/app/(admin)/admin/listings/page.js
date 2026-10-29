'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Plus, Upload } from 'lucide-react'
import { canSee } from '@/components/admin/adminNav'
import { ListingsTable } from '@/components/admin/listings/ListingsTable'
import { PageHeader } from '@/components/admin/PageHeader'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Button } from '@/components/ui/Button'
import { saveBlob } from '@/lib/download'
import { listings } from '@/services/admin.service'
import { useAuthStore } from '@/store/authStore'

const EXPORT_KEYS = [
  'q',
  'status',
  'group',
  'category',
  'area',
  'type',
  'verified',
  'featured',
  'hasOwner',
  'missing',
]

function ExportButton() {
  const params = useSearchParams()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    try {
      const filters = Object.fromEntries(EXPORT_KEYS.map((k) => [k, params.get(k)]))
      const file = await listings.exportCsv(filters)
      saveBlob(file, `listings-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="secondary" onClick={download} loading={busy}>
      <Download aria-hidden="true" className="size-4" />
      Export CSV
    </Button>
  )
}

export default function ListingsPage() {
  const role = useAuthStore((s) => s.user.role)
  const canEdit = canSee(role, 'ADMIN')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Listings"
        actions={
          <Suspense>
            <ExportButton />
            {canEdit && (
              <>
                <Button variant="secondary" href="/admin/listings/import">
                  <Upload aria-hidden="true" className="size-4" />
                  Import CSV
                </Button>
                <Button href="/admin/listings/new">
                  <Plus aria-hidden="true" className="size-5" />
                  New listing
                </Button>
              </>
            )}
          </Suspense>
        }
      />
      <Suspense>
        <ListingsTable canEdit={canEdit} isSuper={canSee(role, 'SUPER_ADMIN')} />
      </Suspense>
    </div>
  )
}
