'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { Checkbox, TextArea, TextField } from '@/components/admin/Fields'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { FeaturedGate } from '@/components/business/FeaturedGate'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useBusinessListing } from '@/hooks/useBusinessListing'
import { formatDate } from '@/lib/format'
import { createOffer, deleteOffer, listOffers, updateOffer } from '@/services/business.service'

const today = () => new Date().toISOString().slice(0, 10)
const inDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
// Offers run whole days in Nepal time.
const startOf = (day) => new Date(`${day}T00:00:00+05:45`)
const endOf = (day) => new Date(`${day}T23:59:59+05:45`)

function OfferForm({ listingId, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    title: '',
    body: '',
    from: today(),
    to: inDays(7),
    isActive: true,
  })
  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))
  return (
    <section className="flex flex-col gap-3 rounded-box border border-dashed border-border p-4">
      <h2 className="font-semibold">New offer</h2>
      <TextField label="Title" maxLength={80} value={form.title} onChange={set('title')} />
      <TextArea label="Details" maxLength={300} value={form.body} onChange={set('body')} />
      <div className="flex flex-wrap gap-3">
        <TextField label="Starts" type="date" value={form.from} onChange={set('from')} />
        <TextField label="Ends" type="date" value={form.to} onChange={set('to')} />
      </div>
      <Checkbox label="Show now" checked={form.isActive} onChange={set('isActive')} />
      <div>
        <Button
          disabled={!form.title.trim()}
          onClick={async () => {
            try {
              await createOffer(listingId, {
                title: form.title.trim(),
                body: form.body.trim() || null,
                startsAt: startOf(form.from),
                endsAt: endOf(form.to),
                isActive: form.isActive,
              })
              setForm({ title: '', body: '', from: today(), to: inDays(7), isActive: true })
              toast('Offer added')
              onSaved()
            } catch (err) {
              toast(errorMessage(err), 'error')
            }
          }}
        >
          Add offer
        </Button>
      </div>
    </section>
  )
}

export default function OffersPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { listingId } = useBusinessListing()
  const { data, isPending, error } = useQuery({
    queryKey: ['business', 'offers', listingId],
    queryFn: () => listOffers(listingId),
    enabled: Boolean(listingId),
    retry: false,
  })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['business', 'offers', listingId] })

  if (error?.code === 'FEATURED_REQUIRED') {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">Offers</h1>
        <FeaturedGate listingId={listingId} what="Offers" />
      </div>
    )
  }
  if (isPending) return <Skeleton className="h-60 w-full" />

  const now = new Date()
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Offers</h1>
      <ul className="flex flex-col gap-3">
        {data.length === 0 && <li className="text-text-muted">No offers yet.</li>}
        {data.map((o) => {
          const running = o.isActive && new Date(o.startsAt) <= now && new Date(o.endsAt) > now
          return (
            <li
              key={o.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-box border border-border p-4"
            >
              <div>
                <p className="font-semibold">
                  {o.title}{' '}
                  {running ? <Badge tone="success">Showing</Badge> : <Badge>Not showing</Badge>}
                </p>
                {o.body && <p className="text-sm text-text-muted">{o.body}</p>}
                <p className="text-sm text-text-muted">
                  {formatDate(o.startsAt)} – {formatDate(o.endsAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await updateOffer(listingId, o.id, { isActive: !o.isActive })
                      refresh()
                    } catch (err) {
                      toast(errorMessage(err), 'error')
                    }
                  }}
                >
                  {o.isActive ? 'Pause' : 'Resume'}
                </Button>
                <ConfirmButton
                  title="Delete offer"
                  message={`Delete “${o.title}”?`}
                  confirmLabel="Delete"
                  onConfirm={async () => {
                    await deleteOffer(listingId, o.id)
                    refresh()
                  }}
                >
                  Delete
                </ConfirmButton>
              </div>
            </li>
          )
        })}
      </ul>
      <OfferForm listingId={listingId} onSaved={refresh} />
    </div>
  )
}
