'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BusinessShell } from '@/components/business/BusinessShell'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/store/authStore'

const STAFF = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN']

function Loading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-6" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-60 w-full" />
    </div>
  )
}

/** Owners manage listings; members see how to claim or add one (on the dashboard). */
export default function BusinessLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, status } = useAuthStore()

  const memberElsewhere = user?.role === 'MEMBER' && pathname !== '/business/dashboard'

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    // Members only have the dashboard (claim or add a listing) until they own one.
    if (memberElsewhere) router.replace('/business/dashboard')
  }, [status, pathname, router, memberElsewhere])

  if (!user) return <Loading />
  if (STAFF.includes(user.role)) {
    return (
      <main id="main" className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-semibold">Business portal</h1>
        <p className="mt-2 text-text-muted">
          This portal is for business owners. Manage listings from the{' '}
          <Link href="/admin/listings" className="text-brand underline">
            admin panel
          </Link>
          .
        </p>
      </main>
    )
  }
  if (memberElsewhere) return <Loading />
  const isOwner = user.role === 'BUSINESS_OWNER'
  return (
    <Suspense fallback={<Loading />}>
      <BusinessShell isOwner={isOwner}>{children}</BusinessShell>
    </Suspense>
  )
}
