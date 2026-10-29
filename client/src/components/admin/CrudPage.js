'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ConfirmButton } from './ConfirmButton'
import { DataTable } from './DataTable'
import { PageHeader } from './PageHeader'
import { Checkbox, SelectField, TextField } from './Fields'
import { errorMessage, useToast } from './Toast'

/**
 * Table + add/edit dialog for small admin lists (tags, areas, synonyms).
 * fields: [{ name, label, type: 'text' | 'number' | 'select' | 'checkbox', options?, hint? }]
 * toForm(entity) → form values; toBody(form) → API body.
 */
export function CrudPage({
  title,
  queryKey,
  api,
  columns,
  fields,
  toForm,
  toBody,
  itemLabel,
  deleteMessage,
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', queryKey],
    queryFn: api.list,
  })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const open = (entity) => {
    setEditing(entity ?? {})
    setForm(toForm(entity))
  }
  const reload = () => queryClient.invalidateQueries({ queryKey: ['admin', queryKey] })

  const save = async () => {
    setSaving(true)
    try {
      if (editing.id) await api.update(editing.id, toBody(form))
      else await api.create(toBody(form))
      toast('Saved')
      setEditing(null)
      reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (entity) => {
    try {
      await api.remove(entity.id)
      toast(`${itemLabel(entity)} deleted`)
      reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const allColumns = [
    ...columns,
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (entity) => (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => open(entity)}>
            Edit
          </Button>
          <ConfirmButton
            title="Delete"
            message={deleteMessage(entity)}
            confirmLabel="Delete"
            onConfirm={() => remove(entity)}
          >
            Delete
          </ConfirmButton>
        </div>
      ),
    },
  ]

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title={title} />
        <Button onClick={() => open(null)}>Add</Button>
      </div>
      <DataTable
        caption={title}
        columns={allColumns}
        rows={data ?? []}
        rowLabel={itemLabel}
        loading={isPending}
        error={isError}
        onRetry={refetch}
      />
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${itemLabel(editing)}` : `Add to ${title.toLowerCase()}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {fields.map((f) => {
            const value = form[f.name] ?? ''
            const onChange = (e) =>
              setForm((s) => ({
                ...s,
                [f.name]: f.type === 'checkbox' ? e.target.checked : e.target.value,
              }))
            if (f.type === 'checkbox')
              return (
                <Checkbox
                  key={f.name}
                  label={f.label}
                  checked={Boolean(value)}
                  onChange={onChange}
                />
              )
            if (f.type === 'select') {
              return (
                <SelectField key={f.name} label={f.label} value={value} onChange={onChange}>
                  {f.options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </SelectField>
              )
            }
            return (
              <TextField
                key={f.name}
                label={f.label}
                hint={f.hint}
                type={f.type === 'number' ? 'number' : 'text'}
                step={f.type === 'number' ? 'any' : undefined}
                value={value}
                onChange={onChange}
              />
            )
          })}
        </div>
      </Dialog>
    </div>
  )
}
