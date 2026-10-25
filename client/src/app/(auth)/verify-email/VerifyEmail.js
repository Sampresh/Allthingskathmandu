'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { EmailForm } from '@/components/common/EmailForm'
import { FormError, FormSuccess } from '@/components/common/FormStatus'
import { AuthT as T } from '@/components/common/AuthT'
import { Button } from '@/components/ui/Button'
import { resendVerification, verifyEmail } from '@/services/auth.service'

function Resend() {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        <T k="auth.resend.title" />
      </h2>
      <EmailForm
        action={resendVerification}
        submitKey="auth.resend.submit"
        doneKey="auth.resend.done"
      />
    </div>
  )
}

export function VerifyEmail() {
  const token = useSearchParams().get('token')
  const [state, setState] = useState('idle') // idle | working | done | failed
  const [error, setError] = useState(null)

  // Verification waits for a click: link scanners that open the URL must not use the token.
  const verify = async () => {
    setState('working')
    try {
      await verifyEmail(token)
      setState('done')
    } catch (err) {
      setError(err)
      setState('failed')
    }
  }

  if (!token) return <Resend />

  if (state === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <FormSuccess>
          <T k="auth.verify.done" />
        </FormSuccess>
        <Button href="/login" fullWidth>
          <T k="auth.loginLink" />
        </Button>
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div className="flex flex-col gap-6">
        <FormError error={error} />
        <Resend />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-text-muted">
        <T k="auth.verify.intro" />
      </p>
      <Button onClick={verify} loading={state === 'working'} fullWidth>
        <T k="auth.verify.submit" />
      </Button>
    </div>
  )
}
