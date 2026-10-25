'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { PenLine } from 'lucide-react'
import { T } from '@/components/common/T'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/store/authStore'

// The form, its text and the API client load when the dialog opens.
const ReviewForm = dynamic(() => import('@/components/account/ReviewForm'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
})

/** "Write a review" for members; logged-out visitors go to log in first. */
export function WriteReview({ businessId, slug }) {
  const router = useRouter()
  const status = useAuthStore((s) => s.status)
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)

  const onClick = () => {
    if (status !== 'authenticated') {
      router.push(`/login?next=${encodeURIComponent(`/listing/${slug}`)}`)
      return
    }
    setSession((n) => n + 1)
    setOpen(true)
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={onClick}
        disabled={status === 'idle' || status === 'loading'}
        className="self-start"
      >
        <PenLine aria-hidden="true" className="size-4" />
        <T k="listing.writeReview" />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={<T k="listing.writeReview" />}>
        {open && <ReviewForm key={session} businessId={businessId} />}
      </Dialog>
    </>
  )
}
