'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormError, FormSuccess } from '@/components/common/FormStatus'
import { T } from '@/components/common/T'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { resetPassword } from '@/services/auth.service'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'v.passwordMin')
      .refine((v) => new TextEncoder().encode(v).length <= 72, 'v.passwordMax'),
    confirm: z.string().min(1, 'v.required'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'v.passwordMatch' })

export function ResetPasswordForm() {
  const token = useSearchParams().get('token')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-text-muted">
          <T k="auth.linkMissing" />
        </p>
        <Link href="/forgot-password" className="font-semibold text-brand">
          <T k="auth.forgot.submit" />
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <FormSuccess k="auth.reset.done" />
        <Button href="/login" fullWidth>
          <T k="auth.loginLink" />
        </Button>
      </div>
    )
  }

  const onSubmit = async ({ password }) => {
    setError(null)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormError error={error}>
        {error?.code === 'TOKEN_INVALID' && (
          <Link href="/forgot-password" className="font-semibold underline">
            <T k="auth.forgot.submit" />
          </Link>
        )}
      </FormError>
      <Input
        label={<T k="auth.newPassword" />}
        type="password"
        autoComplete="new-password"
        hint={<T k="auth.passwordHint" />}
        error={errors.password && <T k={errors.password.message} />}
        {...register('password')}
      />
      <Input
        label={<T k="auth.confirmPassword" />}
        type="password"
        autoComplete="new-password"
        error={errors.confirm && <T k={errors.confirm.message} />}
        {...register('confirm')}
      />
      <Button type="submit" loading={isSubmitting} fullWidth>
        <T k="auth.reset.submit" />
      </Button>
    </form>
  )
}
