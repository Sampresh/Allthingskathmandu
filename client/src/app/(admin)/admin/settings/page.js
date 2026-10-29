'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { TextField } from '@/components/admin/Fields'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { settings } from '@/services/admin.service'

function useSave(key) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const save = async (value) => {
    setSaving(true)
    try {
      await settings.put(key, value)
      toast('Saved; the site updates within a minute.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }
  return { save, saving }
}

/** Editable list of rows with two text fields each. */
function PairList({ title, settingKey, initial, first, second, empty }) {
  const [rows, setRows] = useState(initial)
  const { save, saving } = useSave(settingKey)
  const update = (i, patch) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  return (
    <section className="flex flex-col gap-3 rounded-box border border-border p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <TextField
            label={first.label}
            value={row[first.key]}
            onChange={(e) => update(i, { [first.key]: e.target.value })}
            className="flex-1"
          />
          <TextField
            label={second.label}
            value={row[second.key]}
            onChange={(e) => update(i, { [second.key]: e.target.value })}
            className="flex-1"
          />
          <button
            type="button"
            aria-label={`Remove row ${i + 1}`}
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
            className="inline-flex size-11 items-center justify-center rounded-box hover:bg-surface-raised"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setRows((r) => [...r, { ...empty }])}>
          Add row
        </Button>
        <Button
          onClick={() => save(rows.filter((r) => r[first.key].trim() && r[second.key].trim()))}
          loading={saving}
        >
          Save
        </Button>
      </div>
    </section>
  )
}

function Contact({ initial }) {
  const [value, setValue] = useState({ email: '', phone: '', address: '', ...initial })
  const { save, saving } = useSave('contact')
  return (
    <section className="flex flex-col gap-3 rounded-box border border-border p-4">
      <h2 className="text-lg font-semibold">Contact</h2>
      <p className="text-sm text-text-muted">Contact form messages go to this email.</p>
      <TextField
        label="Email"
        type="email"
        value={value.email ?? ''}
        onChange={(e) => setValue({ ...value, email: e.target.value })}
      />
      <TextField
        label="Phone"
        type="tel"
        value={value.phone ?? ''}
        onChange={(e) => setValue({ ...value, phone: e.target.value })}
      />
      <TextField
        label="Address"
        value={value.address ?? ''}
        onChange={(e) => setValue({ ...value, address: e.target.value })}
      />
      <div>
        <Button
          onClick={() =>
            save({
              email: value.email.trim() || null,
              phone: value.phone.trim() || null,
              address: value.address.trim() || null,
            })
          }
          loading={saving}
        >
          Save
        </Button>
      </div>
    </section>
  )
}

export default function SettingsPage() {
  const { data, isPending } = useQuery({ queryKey: ['admin', 'settings'], queryFn: settings.list })
  if (isPending) return <Skeleton className="h-96 w-full max-w-3xl" />
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Settings" />
      <PairList
        title="Emergency numbers (footer)"
        settingKey="emergency_numbers"
        initial={data.emergency_numbers ?? []}
        first={{ key: 'label', label: 'Label' }}
        second={{ key: 'number', label: 'Number' }}
        empty={{ label: '', number: '' }}
      />
      <Contact initial={data.contact ?? {}} />
      <PairList
        title="Social links (footer)"
        settingKey="social_links"
        initial={data.social_links ?? []}
        first={{ key: 'platform', label: 'Platform' }}
        second={{ key: 'url', label: 'Link (https://…)' }}
        empty={{ platform: '', url: '' }}
      />
    </div>
  )
}
