import { Suspense } from 'react'
import { AuthCard } from '@/components/common/AuthCard'
import { ResetPasswordForm } from './ResetPasswordForm'

export const metadata = { title: 'Choose a new password', robots: { index: false, follow: false } }

export default function ResetPasswordPage() {
  return (
    <AuthCard titleKey="auth.reset.title">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  )
}
