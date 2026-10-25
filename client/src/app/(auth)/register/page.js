import { AuthCard } from '@/components/common/AuthCard'
import { RegisterForm } from './RegisterForm'

export const metadata = {
  title: 'Create your account',
  description:
    'Create an All Things Kathmandu account to save listings, write reviews and post items.',
}

export default function RegisterPage() {
  return (
    <AuthCard titleKey="auth.register.title">
      <RegisterForm />
    </AuthCard>
  )
}
