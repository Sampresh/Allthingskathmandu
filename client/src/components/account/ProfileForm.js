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
import { updateProfile } from '@/services/member.service'
import { useAuthStore } from '@/store/authStore'
import { Section } from './Section'

const schema = z.object({
  name: z.string().trim().min(1, 'v.name').max(80, 'v.name'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+?[0-9][0-9 ()-]{6,19}$/.test(v), 'v.phone'),
})

export function ProfileForm({ profile }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: profile.name, phone: profile.phone ?? '' },
  })

  const onSubmit = async ({ name, phone }) => {
    setError(null)
    setSaved(false)
    try {
      const updated = await updateProfile({ name, phone: phone || null })
      queryClient.setQueryData(['account', 'profile'], updated)
      // The header shows the first name.
      useAuthStore.getState().setUser({ ...useAuthStore.getState().user, name: updated.name })
      setSaved(true)
    } catch (err) {
      const field = err.details?.find((d) => d.path === 'phone')
      if (field) setFieldError('phone', { message: field.message })
      else setError(err)
    }
  }

  const fieldError = (e) => e && (e.message.startsWith('v.') ? <T k={e.message} /> : e.message)

  return (
    <Section titleKey="account.profile.title">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-md flex-col gap-4">
        <FormError error={error} messages={allAccountMessages} />
        {saved && <FormSuccess>{<T k="account.savedChanges" />}</FormSuccess>}
        <Input
          label={<T k="account.name" />}
          autoComplete="name"
          error={fieldError(errors.name)}
          {...register('name')}
        />
        <Input
          label={<T k="account.email" />}
          value={profile.email}
          readOnly
          hint={<T k="account.emailHint" />}
        />
        <Input
          label={<T k="account.phone" />}
          type="tel"
          autoComplete="tel"
          error={fieldError(errors.phone)}
          {...register('phone')}
        />
        <Button type="submit" loading={isSubmitting} className="self-start">
          <T k="account.save" />
        </Button>
      </form>
    </Section>
  )
}
