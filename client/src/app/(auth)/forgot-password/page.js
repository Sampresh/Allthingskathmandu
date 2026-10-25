import Link from 'next/link'
import { AuthCard } from '@/components/common/AuthCard'
import { AuthT as T } from '@/components/common/AuthT'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export const metadata = { title: 'Reset your password', robots: { index: false, follow: false } }

export default function ForgotPasswordPage() {
  return (
    <AuthCard titleKey="auth.forgot.title" introKey="auth.forgot.intro">
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm font-semibold text-brand">
        <T k="auth.backToLogin" />
      </Link>
    </AuthCard>
  )
}
