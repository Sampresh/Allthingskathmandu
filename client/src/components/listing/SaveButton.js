'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { T } from '@/components/common/T'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'

// The API client loads on first use, not with the listing page.
const member = () => import('@/services/member.service')

/** Save or unsave a listing (members); logged-out visitors go to log in first. */
export function SaveButton({ businessId, slug }) {
  const router = useRouter()
  const status = useAuthStore((s) => s.status)
  const signedIn = status === 'authenticated'
  const queryClient = useQueryClient()
  const key = ['saved', businessId]
  const { data: saved = false, isPending } = useQuery({
    queryKey: key,
    queryFn: async () => (await member()).isSaved(businessId),
    enabled: signedIn,
  })
  const toggle = useMutation({
    mutationFn: async (next) => {
      const api = await member()
      return next ? api.saveListing(businessId) : api.unsaveListing(businessId)
    },
    onSuccess: (result) => {
      queryClient.setQueryData(key, result.saved)
      queryClient.invalidateQueries({ queryKey: ['account', 'saved'] })
    },
  })

  const onClick = () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/listing/${slug}`)}`)
      return
    }
    toggle.mutate(!saved)
  }
  const Icon = saved ? BookmarkCheck : Bookmark

  return (
    <Button
      variant="secondary"
      onClick={onClick}
      loading={toggle.isPending}
      // Wait for the session check (and the saved state) so the first tap does the right thing.
      disabled={status === 'idle' || status === 'loading' || (signedIn && isPending)}
      className="self-start"
    >
      <Icon aria-hidden="true" className={saved ? 'size-5 fill-current' : 'size-5'} />
      <T k={saved ? 'listing.saved' : 'listing.save'} />
    </Button>
  )
}
