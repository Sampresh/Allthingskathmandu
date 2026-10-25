'use client'

import { EmailForm } from '@/components/common/EmailForm'
import { forgotPassword } from '@/services/auth.service'

export function ForgotPasswordForm() {
  return (
    <EmailForm action={forgotPassword} submitKey="auth.forgot.submit" doneKey="auth.forgot.done" />
  )
}
