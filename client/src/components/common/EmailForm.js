'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormError, FormSuccess } from './FormStatus'
import { T } from './T'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const schema = z.object({
  email: z.string().trim().min(1, 'v.required').pipe(z.email('v.email')),
})

/** Single email field that calls `action(email)` and then shows `doneKey`. */
export function EmailForm({ action, submitKey, doneKey }) {
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email }) => {
    setError(null)
    try {
      await action(email)
      setDone(true)
    } catch (err) {
      setError(err)
    }
  }

  if (done) return <FormSuccess k={doneKey} />

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormError error={error} />
      <Input
        label={<T k="auth.email" />}
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email && <T k={errors.email.message} />}
        {...register('email')}
      />
      <Button type="submit" loading={isSubmitting} fullWidth>
        <T k={submitKey} />
      </Button>
    </form>
  )
}
