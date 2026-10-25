'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/store/authStore'

const STAFF = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN']

/** Admin area: staff only. The API enforces every permission; this only routes people. */
export default function AdminLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, status } = useAuthStore()
  const isLogin = pathname === '/admin/login'

  useEffect(() => {
    if (!isLogin && status === 'anonymous') {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [isLogin, status, pathname, router])

  if (isLogin) return children
  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-8" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!STAFF.includes(user.role)) {
    return (
      <main id="main" className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-semibold">No access</h1>
        <p className="mt-2 text-text-muted">This area is for the site team.</p>
      </main>
    )
  }
  return <AdminShell user={user}>{children}</AdminShell>
}
