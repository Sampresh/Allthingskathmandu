'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Flag } from 'lucide-react'
import { T } from '@/components/common/T'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useT } from '@/hooks/useLang'

// Form, Turnstile and the API client load on first open, not with the listing page.
const ReportForm = dynamic(() => import('./ReportForm'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
})

/** "Report wrong info" for guests and members (Turnstile when configured). */
export function ReportDialog({ entityType = 'BUSINESS', entityId }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  // A fresh form each time the dialog opens.
  const [session, setSession] = useState(0)

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setSession((n) => n + 1)
          setOpen(true)
        }}
        className="text-text-muted"
      >
        <Flag aria-hidden="true" className="size-4" />
        <T k="report.open" />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('report.title')}>
        {open && <ReportForm key={session} entityType={entityType} entityId={entityId} />}
      </Dialog>
    </>
  )
}
