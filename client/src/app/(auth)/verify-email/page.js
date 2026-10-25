import { Suspense } from 'react'
import { AuthCard } from '@/components/common/AuthCard'
import { VerifyEmail } from './VerifyEmail'

export const metadata = { title: 'Verify your email', robots: { index: false, follow: false } }

export default function VerifyEmailPage() {
  return (
    <AuthCard titleKey="auth.verify.title">
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthCard>
  )
}
