'use client'

import { useState } from 'react'
import {
  BadgeCheck,
  Ban,
  CircleCheck,
  EyeOff,
  FolderTree,
  MapPin,
  RotateCcw,
  Star,
  StarOff,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { listings } from '@/services/admin.service'
import { SelectField, TextField } from '../Fields'
import { errorMessage, useToast } from '../Toast'

const DAY_MS = 86_400_000
const inDays = (days) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10)

const ACTIONS = [
  { action: 'publish', label: 'Publish', icon: CircleCheck },
  { action: 'unpublish', label: 'Unpublish', icon: EyeOff },
  { action: 'suspend', label: 'Suspend', icon: Ban },
  { action: 'verify', label: 'Verify', icon: BadgeCheck },
  { action: 'set-category', label: 'Category', icon: FolderTree, dialog: true },
  { action: 'set-area', label: 'Area', icon: MapPin, dialog: true },
  { action: 'feature', label: 'Feature', icon: Star, dialog: true },
  { action: 'unfeature', label: 'Unfeature', icon: StarOff },
  { action: 'delete', label: 'Trash', icon: Trash2, dialog: true, danger: true },
]

/** Sticky bar for the selected rows: one action at a time, with a summary of what failed. */
export function BulkBar({ ids, inTrash, groups, areas, onClear, onDone }) {
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [value, setValue] = useState('')
  const [failed, setFailed] = useState(null)
  const count = ids.length
  const noun = count === 1 ? 'listing' : 'listings'

  const run = async (action, extra = {}) => {
    setBusy(action)
    try {
      const result = await listings.bulk({ ids, action, ...extra })
      setDialog(null)
      if (result.done.length)
        toast(`${result.done.length} ${result.done.length === 1 ? 'listing' : 'listings'} updated`)
      if (result.failed.length) setFailed(result.failed)
      await onDone()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const open = (action) => {
    setValue(action === 'feature' ? inDays(30) : '')
    setDialog(action)
  }

  const shown = inTrash ? [{ action: 'restore', label: 'Restore', icon: RotateCcw }] : ACTIONS

  return (
    <>
      <div
        role="region"
        aria-label="Bulk actions"
        className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-box border border-brand bg-surface p-2 shadow-overlay"
      >
        <span className="px-2 text-sm font-semibold">
          {count} {noun} selected
        </span>
        <div className="flex flex-wrap gap-1">
          {shown.map(({ action, label, icon: Icon, dialog: needsDialog, danger }) => (
            <button
              key={action}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => (needsDialog ? open(action) : run(action))}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-box px-3 text-sm font-semibold hover:bg-surface-raised disabled:opacity-50 ${danger ? 'text-danger' : ''}`}
            >
              <Icon aria-hidden="true" className="size-4" />
              {busy === action ? 'Working…' : label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="ml-auto inline-flex size-10 items-center justify-center rounded-box text-text-muted hover:bg-surface-raised"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <Dialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={
          {
            'set-category': `Primary category for ${count} ${noun}`,
            'set-area': `Area for ${count} ${noun}`,
            feature: `Feature ${count} ${noun}`,
            delete: `Move ${count} ${noun} to Trash?`,
          }[dialog] ?? ''
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={dialog === 'delete' ? 'danger' : 'primary'}
              loading={Boolean(busy)}
              disabled={dialog === 'set-category' && !value}
              onClick={() =>
                run(dialog, {
                  ...(dialog === 'set-category' && { categoryId: value }),
                  ...(dialog === 'set-area' && { areaId: value || null }),
                  ...(dialog === 'feature' && {
                    featuredUntil: new Date(`${value}T23:59:59+05:45`).toISOString(),
                  }),
                })
              }
            >
              {dialog === 'delete' ? 'Move to Trash' : 'Apply'}
            </Button>
          </div>
        }
      >
        {dialog === 'set-category' && (
          <SelectField
            label="Primary category"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">Choose…</option>
            {groups.map((g) => (
              <optgroup key={g.id} label={g.nameEn}>
                {g.children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
        )}
        {dialog === 'set-area' && (
          <SelectField label="Area" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">No area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nameEn}
              </option>
            ))}
          </SelectField>
        )}
        {dialog === 'feature' && (
          <TextField
            type="date"
            label="Featured until (end of day, Nepal time)"
            value={value}
            min={inDays(1)}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {dialog === 'delete' && (
          <p>They leave the public site at once. You can restore them from Trash.</p>
        )}
      </Dialog>

      <Dialog
        open={Boolean(failed)}
        onClose={() => setFailed(null)}
        title={`${failed?.length ?? 0} could not be changed`}
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setFailed(null)}>Close</Button>
          </div>
        }
      >
        <ul className="flex flex-col gap-2 text-sm">
          {failed?.map((f) => (
            <li key={f.id}>
              <span className="font-semibold">{f.name ?? 'Unknown listing'}</span>
              <span className="block text-text-muted">{f.message}</span>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  )
}
