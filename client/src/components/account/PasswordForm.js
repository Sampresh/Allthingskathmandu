'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { AccountT as T } from '@/components/common/AccountT'
import { FormError, FormSuccess } from '@/components/common/FormStatus'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { allAccountMessages } from '@/hooks/useAccountT'
import { changePassword } from '@/services/member.service'
import { Section } from './Section'

const newPassword = z
  .string()
  .min(8, 'v.passwordMin')
  .refine((v) => new TextEncoder().encode(v).length <= 72, 'v.passwordMax')

const schemaFor = (hasPassword) =>
  z
    .object({
      currentPassword: hasPassword ? z.string().min(1, 'v.required') : z.string().optional(),
      newPassword,
      confirm: z.string().min(1, 'v.required'),
    })
    .refine((v) => v.newPassword === v.confirm, {
      path: ['confirm'],
      message: 'v.passwordMatch',
    })

/** Change the password (other devices are signed out), or set a first one after Google sign-in. */
export function PasswordForm({ hasPassword }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schemaFor(hasPassword)) })

  const onSubmit = async ({ currentPassword, newPassword: next }) => {
    setError(null)
    setDone(false)
    try {
      await changePassword(
        hasPassword ? { currentPassword, newPassword: next } : { newPassword: next },
      )
      reset()
      setDone(true)
      queryClient.invalidateQueries({ queryKey: ['account'] })
    } catch (err) {
      if (err.code === 'INVALID_PASSWORD') {
        setFieldError('currentPassword', { message: 'e.INVALID_PASSWORD' })
      } else setError(err)
    }
  }

  const fieldError = (e) => e && <T k={e.message} />

  return (
    <Section titleKey="account.password.title">
      {!hasPassword && (
        <p className="text-text-muted">
          <T k="account.password.googleOnly" />
        </p>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-md flex-col gap-4">
        <FormError error={error} messages={allAccountMessages} />
        {done && (
          <FormSuccess>
            <T k="account.password.done" />
          </FormSuccess>
        )}
        {hasPassword && (
          <Input
            label={<T k="account.password.current" />}
            type="password"
            autoComplete="current-password"
            error={fieldError(errors.currentPassword)}
            {...register('currentPassword')}
          />
        )}
        <Input
          label={<T k="account.password.new" />}
          type="password"
          autoComplete="new-password"
          hint={<T k="auth.passwordHint" />}
          error={fieldError(errors.newPassword)}
          {...register('newPassword')}
        />
        <Input
          label={<T k="account.password.confirm" />}
          type="password"
          autoComplete="new-password"
          error={fieldError(errors.confirm)}
          {...register('confirm')}
        />
        <Button type="submit" loading={isSubmitting} className="self-start">
          <T k={hasPassword ? 'account.password.submit' : 'account.password.set'} />
        </Button>
      </form>
    </Section>
  )
}
