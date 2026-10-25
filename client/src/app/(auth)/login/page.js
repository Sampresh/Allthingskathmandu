import { Suspense } from 'react'
import { AuthCard } from '@/components/common/AuthCard'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Log in', robots: { index: false, follow: false } }

export default function LoginPage() {
  return (
    <AuthCard titleKey="auth.login.title">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  )
}
