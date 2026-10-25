'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Turnstile } from '@marsidev/react-turnstile'
import { z } from 'zod'
import { FormError, FormSuccess } from '@/components/common/FormStatus'
import { AuthT as T } from '@/components/common/AuthT'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLang } from '@/hooks/useLang'
import { register as registerAccount } from '@/services/auth.service'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const schema = z.object({
  name: z.string().trim().min(1, 'v.required').max(100),
  email: z.string().trim().min(1, 'v.required').pipe(z.email('v.email')),
  password: z
    .string()
    .min(8, 'v.passwordMin')
    .refine((v) => new TextEncoder().encode(v).length <= 72, 'v.passwordMax'),
})

export function RegisterForm() {
  const lang = useLang()
  const [turnstileToken, setTurnstileToken] = useState()
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    setError(null)
    try {
      await registerAccount({ ...values, turnstileToken })
      setDone(true)
    } catch (err) {
      setError(err)
    }
  }

  if (done)
    return (
      <FormSuccess>
        <T k="auth.register.done" />
      </FormSuccess>
    )

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormError error={error} />
        <Input
          label={<T k="auth.name" />}
          autoComplete="name"
          error={errors.name && <T k={errors.name.message} />}
          {...register('name')}
        />
        <Input
          label={<T k="auth.email" />}
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email && <T k={errors.email.message} />}
          {...register('email')}
        />
        <Input
          label={<T k="auth.password" />}
          type="password"
          autoComplete="new-password"
          hint={<T k="auth.passwordHint" />}
          error={errors.password && <T k={errors.password.message} />}
          {...register('password')}
        />
        {TURNSTILE_SITE_KEY && (
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken(undefined)}
            options={{ language: lang, size: 'flexible' }}
          />
        )}
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={Boolean(TURNSTILE_SITE_KEY) && !turnstileToken}
          fullWidth
        >
          <T k="auth.register.submit" />
        </Button>
      </form>
      <p className="text-sm text-text-muted">
        <T k="auth.haveAccount" />{' '}
        <Link href="/login" className="font-semibold text-brand">
          <T k="auth.loginLink" />
        </Link>
      </p>
    </div>
  )
}
