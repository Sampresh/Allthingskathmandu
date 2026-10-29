'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { Checkbox, SelectField, TextArea, TextField } from '@/components/admin/Fields'
import { SortableList } from '@/components/admin/SortableList'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { PageHeader } from '@/components/admin/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { categories } from '@/services/admin.service'

const MIN_LIVE = 1 // a category is public once it has a live listing (MIN_LIVE_LISTINGS on the API)

function CategoryDialog({ editing, groups, onClose, onSaved }) {
  const toast = useToast()
  const isNew = !editing?.id
  const [form, setForm] = useState(() => ({
    nameEn: editing?.nameEn ?? '',
    nameNe: editing?.nameNe ?? '',
    slug: editing?.slug ?? '',
    icon: editing?.icon ?? '',
    description: editing?.description ?? '',
    parentId: editing?.parentId ?? '',
    isVisible: editing?.isVisible ?? true,
    seoTitle: editing?.seoTitle ?? '',
    seoDescription: editing?.seoDescription ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const isGroup = editing.kind === 'DIRECTORY' && !form.parentId

  const save = async () => {
    setSaving(true)
    const body = {
      nameEn: form.nameEn.trim(),
      nameNe: form.nameNe.trim() || null,
      description: form.description.trim() || null,
      isVisible: form.isVisible,
      seoTitle: form.seoTitle.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
      icon: isGroup ? form.icon.trim() || null : null,
      ...(form.slug.trim() && { slug: form.slug.trim() }),
      ...(editing.kind === 'DIRECTORY' && { parentId: form.parentId || null }),
    }
    try {
      if (isNew) await categories.create({ ...body, kind: editing.kind })
      else await categories.update(editing.id, body)
      toast(isNew ? 'Category added' : 'Category saved')
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
      title={isNew ? 'Add category' : `Edit ${editing.nameEn}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!form.nameEn.trim()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Name"
          value={form.nameEn}
          onChange={(e) => set({ nameEn: e.target.value })}
        />
        <TextField
          label="Name in Nepali"
          value={form.nameNe}
          onChange={(e) => set({ nameNe: e.target.value })}
        />
        <TextField
          label="Slug"
          hint="Leave empty to make one from the name"
          value={form.slug}
          onChange={(e) => set({ slug: e.target.value })}
        />
        {editing.kind === 'DIRECTORY' && (
          <SelectField
            label="Group"
            value={form.parentId}
            onChange={(e) => set({ parentId: e.target.value })}
          >
            <option value="">None (this is a group)</option>
            {groups
              .filter((g) => g.id !== editing.id)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nameEn}
                </option>
              ))}
          </SelectField>
        )}
        {isGroup && (
          <TextField
            label="Icon"
            hint="Lucide icon name, e.g. utensils"
            value={form.icon}
            onChange={(e) => set({ icon: e.target.value })}
          />
        )}
        <TextArea
          label="Description"
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
        <Checkbox
          label="Visible on the site"
          checked={form.isVisible}
          onChange={(e) => set({ isVisible: e.target.checked })}
        />
        <TextField
          label="SEO title"
          maxLength={70}
          value={form.seoTitle}
          onChange={(e) => set({ seoTitle: e.target.value })}
        />
        <TextArea
          label="SEO description"
          maxLength={160}
          rows={2}
          value={form.seoDescription}
          onChange={(e) => set({ seoDescription: e.target.value })}
        />
      </div>
    </Dialog>
  )
}

export default function CategoriesPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: categories.list,
  })
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(() => new Set())

  const reload = () => queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] })

  const reorder = async (items) => {
    // Show the new order at once, then save it.
    queryClient.setQueryData(['admin', 'categories'], (current) => {
      const order = new Map(items.map((c, i) => [c.id, i]))
      const sort = (list) =>
        [...list].sort(
          (a, b) => (order.get(a.id) ?? a.sortOrder) - (order.get(b.id) ?? b.sortOrder),
        )
      return {
        groups: sort(current.groups).map((g) => ({ ...g, children: sort(g.children) })),
        market: sort(current.market),
      }
    })
    try {
      await categories.reorder(items.map((c, i) => ({ id: c.id, sortOrder: i })))
      toast('Order saved')
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
    reload()
  }

  const remove = async (category) => {
    try {
      await categories.remove(category.id)
      toast(`${category.nameEn} deleted`)
      reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const row = (c, { isGroup = false } = {}) => (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {isGroup ? (
          <button
            type="button"
            aria-expanded={open.has(c.id)}
            onClick={() =>
              setOpen((s) => {
                const next = new Set(s)
                next.has(c.id) ? next.delete(c.id) : next.add(c.id)
                return next
              })
            }
            className="min-h-11 font-semibold hover:underline"
          >
            {c.nameEn} ({c.children.length})
          </button>
        ) : (
          <span className="font-semibold">{c.nameEn}</span>
        )}
        <span className="text-sm text-text-muted">/{c.slug}</span>
        {!c.isVisible && <Badge>Hidden</Badge>}
        {!isGroup && c.kind === 'DIRECTORY' && (
          <Badge tone={c.liveCount >= MIN_LIVE ? 'success' : 'neutral'}>
            {c.liveCount} live{c.liveCount < MIN_LIVE ? ' (not public yet)' : ''}
          </Badge>
        )}
      </div>
      <div className="flex gap-2">
        {isGroup && (
          <Button
            variant="secondary"
            onClick={() => setEditing({ kind: 'DIRECTORY', parentId: c.id })}
          >
            Add category
          </Button>
        )}
        <Button variant="secondary" onClick={() => setEditing(c)}>
          Edit
        </Button>
        <ConfirmButton
          title="Delete category"
          message={`Delete ${c.nameEn}? Only empty categories can be deleted.`}
          confirmLabel="Delete"
          onConfirm={() => remove(c)}
        >
          Delete
        </ConfirmButton>
      </div>
    </div>
  )

  if (isPending) return <Skeleton className="h-96 w-full" />
  if (isError) {
    return (
      <p className="text-danger" role="alert">
        Could not load categories.{' '}
        <button type="button" className="underline" onClick={() => refetch()}>
          Try again
        </button>
      </p>
    )
  }

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Categories" />
        <Button onClick={() => setEditing({ kind: 'DIRECTORY', parentId: null })}>Add group</Button>
      </div>
      <p className="text-sm text-text-muted">
        Drag the handles to change the order on the site. A category shows publicly once it has{' '}
        {MIN_LIVE} live listings.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Directory</h2>
        <SortableList
          items={data.groups}
          label={(g) => g.nameEn}
          onReorder={reorder}
          renderItem={(group) => (
            <div className="flex flex-col gap-2">
              {row(group, { isGroup: true })}
              {open.has(group.id) && (
                <div className="pl-2">
                  <SortableList
                    items={group.children}
                    label={(c) => c.nameEn}
                    onReorder={reorder}
                    renderItem={(c) => row(c)}
                  />
                </div>
              )}
            </div>
          )}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Market</h2>
          <Button variant="secondary" onClick={() => setEditing({ kind: 'MARKET' })}>
            Add market category
          </Button>
        </div>
        <SortableList
          items={data.market}
          label={(c) => c.nameEn}
          onReorder={reorder}
          renderItem={(c) => row(c)}
        />
      </section>

      {editing && (
        <CategoryDialog
          editing={editing}
          groups={data.groups}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
