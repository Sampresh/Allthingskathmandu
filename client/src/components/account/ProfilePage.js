'use client'

import { useQuery } from '@tanstack/react-query'
import { FormError } from '@/components/common/FormStatus'
import { Skeleton } from '@/components/ui/Skeleton'
import { allAccountMessages } from '@/hooks/useAccountT'
import { getProfile } from '@/services/member.service'
import { DeleteAccount } from './DeleteAccount'
import { PasswordForm } from './PasswordForm'
import { ProfileForm } from './ProfileForm'
import { SessionList } from './SessionList'

export function ProfilePage() {
  const profile = useQuery({ queryKey: ['account', 'profile'], queryFn: getProfile })
  if (profile.isPending) return <Skeleton className="h-96 w-full" />
  if (profile.isError) return <FormError error={profile.error} messages={allAccountMessages} />
  const { data } = profile
  return (
    <div className="flex flex-col gap-6">
      <ProfileForm profile={data} />
      {/* Remount when a first password is set, so the form asks for the current one. */}
      <PasswordForm key={String(data.hasPassword)} hasPassword={data.hasPassword} />
      <SessionList />
      <DeleteAccount key={`delete-${data.hasPassword}`} hasPassword={data.hasPassword} />
    </div>
  )
}
