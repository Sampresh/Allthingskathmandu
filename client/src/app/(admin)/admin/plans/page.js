'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '@/components/admin/DataTable'
import { Checkbox, TextField } from '@/components/admin/Fields'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { formatNpr } from '@/lib/format'
import { plans } from '@/services/admin.service'

const blank = {
  code: '',
  name: '',
  priceNpr: 0,
  durationDays: 30,
  isActive: false,
  sortOrder: 0,
  features: { maxPhotos: 0, maxVideos: 0, featured: false, homepage: false },
}

function PlanDialog({ plan, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(plan.id ? plan : blank)
  const [saving, setSaving] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setF = (patch) => setForm((f) => ({ ...f, features: { ...f.features, ...patch } }))

  const save = async () => {
    setSaving(true)
    const body = {
      name: form.name.trim(),
      priceNpr: Number(form.priceNpr),
      durationDays: Number(form.durationDays),
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
      features: {
        maxPhotos: Number(form.features.maxPhotos),
        maxVideos: Number(form.features.maxVideos),
        featured: form.features.featured,
        homepage: form.features.homepage,
      },
    }
    try {
      if (plan.id) await plans.update(plan.id, body)
      else await plans.create({ ...body, code: form.code.trim() })
      toast('Plan saved')
      onSaved()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={plan.id ? `Edit ${plan.name}` : 'New plan'}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!plan.id && (
          <TextField
            label="Code"
            hint="e.g. FEATURED"
            value={form.code}
            onChange={(e) => set({ code: e.target.value })}
          />
        )}
        <TextField label="Name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        <TextField
          label="Price (Rs)"
          type="number"
          min={0}
          value={form.priceNpr}
          onChange={(e) => set({ priceNpr: e.target.value })}
        />
        <TextField
          label="Days per payment"
          type="number"
          min={1}
          value={form.durationDays}
          onChange={(e) => set({ durationDays: e.target.value })}
        />
        <TextField
          label="Max photos"
          type="number"
          min={0}
          value={form.features.maxPhotos}
          onChange={(e) => setF({ maxPhotos: e.target.value })}
        />
        <TextField
          label="Max videos"
          type="number"
          min={0}
          value={form.features.maxVideos}
          onChange={(e) => setF({ maxVideos: e.target.value })}
        />
        <Checkbox
          label="Featured placement"
          checked={form.features.featured}
          onChange={(e) => setF({ featured: e.target.checked })}
        />
        <Checkbox
          label="Homepage spot"
          checked={form.features.homepage}
          onChange={(e) => setF({ homepage: e.target.checked })}
        />
        <Checkbox
          label="On sale (active)"
          checked={form.isActive}
          onChange={(e) => set({ isActive: e.target.checked })}
        />
        <TextField
          label="Order"
          type="number"
          value={form.sortOrder}
          onChange={(e) => set({ sortOrder: e.target.value })}
        />
      </div>
    </Dialog>
  )
}

export default function PlansPage() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: plans.list,
  })
  const [editing, setEditing] = useState(null)

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Plans</h1>
        <Button onClick={() => setEditing({})}>New plan</Button>
      </div>
      <p className="text-sm text-text-muted">
        Prices are what businesses pay per period through Khalti or eSewa. A Featured plan needs a
        price before it can go on sale.
      </p>
      <DataTable
        caption="Plans"
        loading={isPending}
        error={isError}
        onRetry={refetch}
        rows={data ?? []}
        columns={[
          { key: 'name', header: 'Plan', render: (p) => `${p.name} (${p.code})` },
          {
            key: 'priceNpr',
            header: 'Price',
            render: (p) => `${formatNpr(p.priceNpr)} / ${p.durationDays} days`,
          },
          {
            key: 'features',
            header: 'Includes',
            render: (p) =>
              [
                p.features.featured && 'Featured',
                p.features.homepage && 'Homepage',
                `${p.features.maxPhotos} photos`,
                `${p.features.maxVideos} videos`,
              ]
                .filter(Boolean)
                .join(', '),
          },
          {
            key: 'isActive',
            header: 'On sale',
            render: (p) => (p.isActive ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>),
          },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            render: (p) => (
              <Button variant="secondary" onClick={() => setEditing(p)}>
                Edit
              </Button>
            ),
          },
        ]}
      />
      {editing && (
        <PlanDialog
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
          }}
        />
      )}
    </div>
  )
}
