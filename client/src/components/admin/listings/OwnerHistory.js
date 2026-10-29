'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { listings } from '@/services/admin.service'
import { TextField } from '../Fields'
import { errorMessage, useToast } from '../Toast'
import { formatWhen } from './listingMeta'

const CLAIM_TONE = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'neutral' }

/** Who owns the listing, assigning an owner by email, and its claims. */
export function OwnerSection({ listing, canEdit, onChanged }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  if (!listing) return <p className="text-sm text-text-muted">Save the listing first.</p>

  const assign = async () => {
    setBusy(true)
    try {
      await listings.assignOwner(listing.id, email.trim())
      setEmail('')
      toast('Owner assigned')
      await onChanged()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {listing.owner ? (
        <p>
          Owned by <strong>{listing.owner.name}</strong>{' '}
          <span className="text-text-muted">({listing.owner.email})</span>
        </p>
      ) : (
        <p className="text-text-muted">
          No owner yet. Owners claim a listing or Admin assigns one.
        </p>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            type="email"
            label={
              listing.owner ? 'Give it to another member (email)' : 'Assign to a member (email)'
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-64 flex-1"
          />
          <Button
            variant="secondary"
            onClick={assign}
            loading={busy}
            disabled={!email.includes('@')}
          >
            Assign owner
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Claims</h3>
        {listing.claims.length === 0 ? (
          <p className="text-sm text-text-muted">Nobody has claimed this listing.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {listing.claims.map((claim) => (
              <li
                key={claim.id}
                className="flex flex-wrap items-center gap-3 rounded-box border border-border p-3 text-sm"
              >
                <Badge tone={CLAIM_TONE[claim.status]}>{claim.status.toLowerCase()}</Badge>
                <span className="font-semibold">{claim.user.name}</span>
                <span className="text-text-muted">{claim.user.email}</span>
                <span className="ml-auto text-text-muted">{formatWhen(claim.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/claims" className="self-start text-sm font-semibold text-brand">
          Open the claims queue
        </Link>
      </div>
    </div>
  )
}

const describe = (entry) => {
  const fields = entry.diff && typeof entry.diff === 'object' ? Object.keys(entry.diff) : []
  const what = {
    'business.create': 'Created',
    'business.update': `Edited ${fields.join(', ')}`,
    'business.status': `Status ${entry.diff?.status?.from?.toLowerCase()} → ${entry.diff?.status?.to?.toLowerCase()}`,
    'business.delete': 'Moved to Trash',
    'business.restore': 'Restored from Trash',
    'business.duplicate': entry.diff?.from ? 'Copied' : 'Created as a copy',
    'business.assign_owner': 'Owner assigned',
    'business.logo': 'Logo changed',
    'business.import_create': 'Imported from CSV',
    'business.import_update': `Updated by CSV import (${entry.diff?.fields?.join(', ') ?? ''})`,
    'business.owner_update': `Owner edited ${fields.join(', ')}`,
    'media.create': 'Photo or video added',
    'media.delete': 'Photo or video removed',
    'media.update': 'Photo description changed',
    'media.reorder': 'Gallery reordered',
  }[entry.action]
  return what ?? entry.action.replace(/^business\.bulk_/, 'Bulk: ').replace(/_/g, ' ')
}

/** Audit log for this listing, newest first. */
export function HistorySection({ listingId }) {
  const query = useInfiniteQuery({
    queryKey: ['admin', 'listing-history', listingId],
    queryFn: ({ pageParam }) => listings.history(listingId, { cursor: pageParam, limit: 20 }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
    enabled: Boolean(listingId),
  })
  if (!listingId) return <p className="text-sm text-text-muted">History starts when you save.</p>
  if (query.isPending) return <Skeleton className="h-24 w-full" />
  const rows = query.data?.pages.flatMap((p) => p.data) ?? []
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {rows.map((entry) => (
          <li key={entry.id} className="flex gap-3 border-l-2 border-border py-2 pl-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{describe(entry)}</p>
              <p className="text-text-muted">
                {entry.actor?.name ?? 'System'} · {formatWhen(entry.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {query.hasNextPage && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => query.fetchNextPage()}
          loading={query.isFetchingNextPage}
        >
          Older changes
        </Button>
      )}
    </div>
  )
}
