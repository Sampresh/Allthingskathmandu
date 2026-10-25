'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { AccountT as T } from '@/components/common/AccountT'
import { FormError, FormSuccess } from '@/components/common/FormStatus'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CloudImage } from '@/components/ui/CloudImage'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { allAccountMessages } from '@/hooks/useAccountT'
import { formatDate, formatNpr, marketHref } from '@/lib/format'
import {
  deleteMarketItem,
  getProfile,
  markItemSold,
  myMarketItems,
} from '@/services/member.service'
import { MarketItemForm } from './MarketItemForm'
import { Section } from './Section'

const TONE = {
  PENDING: 'neutral',
  LIVE: 'success',
  SOLD: 'brand',
  EXPIRED: 'neutral',
  REJECTED: 'danger',
}

/** My market items (Part 4 §3): post, edit, mark sold, delete. */
export function MarketPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null) // null | 'new' | item
  const [sent, setSent] = useState(false)
  const profile = useQuery({ queryKey: ['account', 'profile'], queryFn: getProfile })
  const items = useInfiniteQuery({
    queryKey: ['account', 'market'],
    queryFn: ({ pageParam }) => myMarketItems(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['account', 'market'] })
  const sold = useMutation({ mutationFn: markItemSold, onSuccess: refresh })
  const remove = useMutation({ mutationFn: deleteMarketItem, onSuccess: refresh })
  const rows = items.data?.pages.flatMap((p) => p.data) ?? []

  if (editing) {
    return (
      <Section titleKey={editing === 'new' ? 'market.form.new' : 'market.form.edit'}>
        <p className="max-w-2xl text-text-muted">
          <T k="market.mine.rules" />
        </p>
        <MarketItemForm
          item={editing === 'new' ? null : editing}
          phone={profile.data?.phone}
          onDone={() => {
            setSent(true)
            setEditing(null)
          }}
        />
      </Section>
    )
  }

  return (
    <Section titleKey="market.mine.title">
      <p className="max-w-2xl text-text-muted">
        <T k="market.mine.rules" />
      </p>
      {sent && (
        <FormSuccess>
          <T k="market.form.done" />
        </FormSuccess>
      )}
      <Button
        onClick={() => {
          setSent(false)
          setEditing('new')
        }}
        className="self-start"
      >
        <Plus aria-hidden="true" className="size-5" />
        <T k="market.mine.post" />
      </Button>
      <FormError error={items.error ?? sold.error ?? remove.error} messages={allAccountMessages} />
      {items.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState message={<T k="market.mine.empty" />} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap gap-3 rounded-box border border-border p-3 sm:flex-nowrap"
            >
              {item.photo ? (
                <CloudImage
                  src={item.photo.url}
                  alt={item.photo.altText}
                  width={96}
                  height={72}
                  widths={[96, 192]}
                  sizes="96px"
                  className="aspect-[4/3] w-24 shrink-0 rounded-box object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="aspect-[4/3] w-24 shrink-0 rounded-box bg-surface-raised"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">
                    {item.status === 'LIVE' ? (
                      <Link href={marketHref(item.slug)} className="text-brand hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </h3>
                  <Badge tone={TONE[item.status]}>
                    <T k={`status.${item.status}`} />
                  </Badge>
                </div>
                <p className="text-sm text-text-muted">
                  {formatNpr(item.priceNpr)}
                  {item.status === 'LIVE' && item.expiresAt && (
                    <>
                      {' · '}
                      <T k="market.mine.until" /> {formatDate(item.expiresAt)}
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {item.status !== 'SOLD' && (
                    <Button variant="secondary" onClick={() => setEditing(item)}>
                      <T k="market.mine.edit" />
                    </Button>
                  )}
                  {item.status === 'LIVE' && (
                    <Button
                      variant="secondary"
                      onClick={() => sold.mutate(item.id)}
                      loading={sold.isPending && sold.variables === item.id}
                    >
                      <T k="market.mine.sold" />
                    </Button>
                  )}
                  <ConfirmButton
                    variant="danger"
                    title={<T k="market.mine.deleteTitle" />}
                    message={<T k="market.mine.deleteBody" />}
                    confirmLabel={<T k="market.mine.delete" />}
                    cancelLabel={<T k="account.cancel" />}
                    onConfirm={() => remove.mutateAsync(item.id)}
                  >
                    <T k="market.mine.delete" />
                  </ConfirmButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => items.fetchNextPage()}
          loading={items.isFetchingNextPage}
          className="self-start"
        >
          <T k="listing.loadMore" />
        </Button>
      )}
    </Section>
  )
}
