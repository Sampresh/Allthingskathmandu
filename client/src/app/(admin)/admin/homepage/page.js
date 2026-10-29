'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { Checkbox, SelectField, TextField } from '@/components/admin/Fields'
import { SortableList } from '@/components/admin/SortableList'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { PageHeader } from '@/components/admin/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { listings, sections } from '@/services/admin.service'

const TYPES = {
  GROUPS: 'Group icons',
  OPEN_NOW: 'Open now near you',
  FEATURED: 'Featured listings',
  POPULAR: 'Popular this week',
  EVENTS: 'Upcoming events',
  MARKET: 'Latest market items',
  BANNER: 'Banner',
  CUSTOM_LIST: 'Hand-picked listings',
}
const HAS_LIMIT = ['OPEN_NOW', 'FEATURED', 'POPULAR', 'EVENTS', 'MARKET']

function ListingPicker({ ids, onChange }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [names, setNames] = useState({})
  const find = async () => {
    const page = await listings.list({ q: q.trim(), status: 'LIVE', limit: 10 })
    setResults(page.data)
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">Listings, in order</p>
      <ol className="flex flex-col gap-1">
        {ids.map((id, i) => (
          <li key={id} className="flex items-center justify-between gap-2 text-sm">
            {i + 1}. {names[id] ?? id}
            <button
              type="button"
              className="text-danger underline"
              onClick={() => onChange(ids.filter((x) => x !== id))}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <div className="flex items-end gap-2">
        <TextField
          label="Find a live listing"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1"
        />
        <Button variant="secondary" onClick={find} disabled={!q.trim()}>
          Find
        </Button>
      </div>
      <ul className="flex flex-col gap-1">
        {results
          .filter((r) => !ids.includes(r.id))
          .map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="min-h-11 text-left text-sm text-brand underline"
                onClick={() => {
                  setNames((n) => ({ ...n, [r.id]: r.name }))
                  onChange([...ids, r.id])
                }}
              >
                Add {r.name}
              </button>
            </li>
          ))}
      </ul>
    </div>
  )
}

function SectionDialog({ section, onClose, onSaved }) {
  const toast = useToast()
  const isNew = !section.id
  const [type, setType] = useState(section.type ?? 'FEATURED')
  const [title, setTitle] = useState(section.title ?? '')
  const [isActive, setActive] = useState(section.isActive ?? true)
  const [config, setConfig] = useState(section.config ?? {})
  const [saving, setSaving] = useState(false)
  const setC = (patch) => setConfig((c) => ({ ...c, ...patch }))

  const save = async () => {
    setSaving(true)
    const cleanConfig = {
      ...(HAS_LIMIT.includes(type) && config.limit && { limit: Number(config.limit) }),
      ...(type === 'CUSTOM_LIST' && { businessIds: config.businessIds ?? [] }),
      ...(type === 'BANNER' && {
        ...(config.body && { body: config.body }),
        ...(config.ctaLabel && { ctaLabel: config.ctaLabel }),
        ...(config.href && { href: config.href }),
      }),
    }
    const body = {
      title: title.trim() || null,
      isActive,
      config: Object.keys(cleanConfig).length ? cleanConfig : null,
    }
    try {
      if (isNew) await sections.create({ ...body, type })
      else await sections.update(section.id, body)
      toast('Section saved')
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
      title={isNew ? 'Add section' : `Edit ${TYPES[type]}`}
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
      <div className="flex flex-col gap-4">
        {isNew && (
          <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectField>
        )}
        <TextField
          label="Title"
          hint="Leave empty to use the default title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {HAS_LIMIT.includes(type) && (
          <TextField
            label="How many to show"
            type="number"
            min={1}
            max={24}
            value={config.limit ?? ''}
            onChange={(e) => setC({ limit: e.target.value })}
          />
        )}
        {type === 'BANNER' && (
          <>
            <TextField
              label="Text"
              value={config.body ?? ''}
              onChange={(e) => setC({ body: e.target.value })}
            />
            <TextField
              label="Button label"
              value={config.ctaLabel ?? ''}
              onChange={(e) => setC({ ctaLabel: e.target.value })}
            />
            <TextField
              label="Button link"
              hint="A site path like /business, or an https link"
              value={config.href ?? ''}
              onChange={(e) => setC({ href: e.target.value })}
            />
          </>
        )}
        {type === 'CUSTOM_LIST' && (
          <ListingPicker
            ids={config.businessIds ?? []}
            onChange={(businessIds) => setC({ businessIds })}
          />
        )}
        <Checkbox
          label="Show on the homepage"
          checked={isActive}
          onChange={(e) => setActive(e.target.checked)}
        />
      </div>
    </Dialog>
  )
}

export default function HomepagePage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery({ queryKey: ['admin', 'sections'], queryFn: sections.list })
  const [editing, setEditing] = useState(null)
  const reload = () => queryClient.invalidateQueries({ queryKey: ['admin', 'sections'] })

  const reorder = async (items) => {
    queryClient.setQueryData(['admin', 'sections'], items)
    try {
      await sections.reorder(items.map((s) => s.id))
      toast('Order saved')
    } catch (err) {
      toast(errorMessage(err), 'error')
      reload()
    }
  }

  const toggle = async (s) => {
    try {
      await sections.update(s.id, { isActive: !s.isActive })
      reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Homepage" />
        <div className="flex gap-2">
          <Button variant="secondary" href="/" target="_blank">
            View homepage
          </Button>
          <Button onClick={() => setEditing({})}>Add section</Button>
        </div>
      </div>
      <p className="text-sm text-text-muted">
        Drag to set the order. Hidden sections stay here so you can prepare them before they go
        live. The search bar always stays on top.
      </p>
      {isPending ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <SortableList
          items={data}
          label={(s) => s.title ?? TYPES[s.type]}
          onReorder={reorder}
          renderItem={(s) => (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{s.title ?? TYPES[s.type]}</p>
                <p className="text-sm text-text-muted">
                  {TYPES[s.type]} {!s.isActive && <Badge>Hidden</Badge>}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => toggle(s)}>
                  {s.isActive ? 'Hide' : 'Show'}
                </Button>
                <Button variant="secondary" onClick={() => setEditing(s)}>
                  Edit
                </Button>
                <ConfirmButton
                  title="Delete section"
                  message="Delete this section from the homepage?"
                  confirmLabel="Delete"
                  onConfirm={async () => {
                    try {
                      await sections.remove(s.id)
                      reload()
                    } catch (err) {
                      toast(errorMessage(err), 'error')
                    }
                  }}
                >
                  Delete
                </ConfirmButton>
              </div>
            </div>
          )}
        />
      )}
      {editing && (
        <SectionDialog
          section={editing}
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
