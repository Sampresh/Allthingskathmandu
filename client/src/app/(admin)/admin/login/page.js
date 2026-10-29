import { Suspense } from 'react'
import { Card } from '@/components/ui/Card'
import { LoginForm } from '@/app/(auth)/login/LoginForm'

export const metadata = { title: 'Admin log in' }

/** Separate admin login (Part 3 §10). Staff always pass the TOTP step after the password. */
export default function AdminLoginPage() {
  return (
    <main
      id="main"
      data-area="admin"
      className="flex min-h-dvh items-center justify-center bg-surface-raised px-4"
    >
      <Card className="flex w-full max-w-md flex-col gap-6 p-6">
        <div>
          <p className="text-sm font-semibold text-text-muted">All Things Kathmandu</p>
          <h1 className="text-2xl font-semibold">Admin log in</h1>
        </div>
        <Suspense>
          <LoginForm defaultNext="/admin" staffOnly />
        </Suspense>
      </Card>
    </main>
  )
}
