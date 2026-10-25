'use client'

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AccountT as T } from '@/components/common/AccountT'
import { FormError } from '@/components/common/FormStatus'
import { ListingCard } from '@/components/listing/ListingCard'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { allAccountMessages } from '@/hooks/useAccountT'
import { listSaved, unsaveListing } from '@/services/member.service'
import { Section } from './Section'

export function SavedPage() {
  const queryClient = useQueryClient()
  const saved = useInfiniteQuery({
    queryKey: ['account', 'saved'],
    queryFn: ({ pageParam }) => listSaved(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  })
  const remove = useMutation({
    mutationFn: unsaveListing,
    onSuccess: (_, businessId) => {
      queryClient.setQueryData(['saved', businessId], false)
      queryClient.invalidateQueries({ queryKey: ['account', 'saved'] })
    },
  })
  const cards = saved.data?.pages.flatMap((p) => p.data) ?? []

  return (
    <Section titleKey="account.saved.title">
      <FormError error={saved.error ?? remove.error} messages={allAccountMessages} />
      {saved.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : cards.length === 0 ? (
        <EmptyState message={<T k="account.saved.empty" />} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <li key={card.id} className="flex flex-col gap-2">
              <ListingCard card={card} />
              <Button
                variant="ghost"
                onClick={() => remove.mutate(card.id)}
                loading={remove.isPending && remove.variables === card.id}
                className="self-start text-text-muted"
              >
                <T k="account.saved.remove" />
                <span className="sr-only">: {card.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {saved.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => saved.fetchNextPage()}
          loading={saved.isFetchingNextPage}
          className="self-start"
        >
          <T k="listing.loadMore" />
        </Button>
      )}
    </Section>
  )
}
