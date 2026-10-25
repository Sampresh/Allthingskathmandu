'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { AccountT as T } from '@/components/common/AccountT'
import { FormError } from '@/components/common/FormStatus'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { allAccountMessages } from '@/hooks/useAccountT'
import { deleteAccount } from '@/services/member.service'
import { Section } from './Section'

const schemaFor = (hasPassword) =>
  z.object({
    password: hasPassword ? z.string().min(1, 'v.required') : z.string().optional(),
    confirm: z.literal('DELETE', { error: 'v.confirmDelete' }),
  })

/** Soft delete (Part 6 §4): the password and typing DELETE confirm it. */
export function DeleteAccount({ hasPassword }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [error, setError] = useState(null)
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schemaFor(hasPassword)) })

  const onSubmit = async ({ password, confirm }) => {
    setError(null)
    try {
      await deleteAccount(hasPassword ? { password, confirm } : { confirm })
      queryClient.clear()
      router.replace('/')
    } catch (err) {
      if (err.code === 'INVALID_PASSWORD') {
        setFieldError('password', { message: 'e.INVALID_PASSWORD' })
      } else setError(err)
    }
  }

  const fieldError = (e) => e && <T k={e.message} />

  return (
    <Section titleKey="account.delete.title" tone="danger">
      <p className="max-w-2xl">
        <T k="account.delete.intro" />
      </p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-md flex-col gap-4">
        <FormError error={error} messages={allAccountMessages} />
        {hasPassword && (
          <Input
            label={<T k="account.delete.password" />}
            type="password"
            autoComplete="current-password"
            error={fieldError(errors.password)}
            {...register('password')}
          />
        )}
        <Input
          label={<T k="account.delete.confirm" />}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          error={fieldError(errors.confirm)}
          {...register('confirm')}
        />
        <Button type="submit" variant="danger" loading={isSubmitting} className="self-start">
          <T k="account.delete.submit" />
        </Button>
      </form>
    </Section>
  )
}
