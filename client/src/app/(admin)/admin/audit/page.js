'use client'

import { useState } from 'react'
import { DataTable } from '@/components/admin/DataTable'
import { TextField } from '@/components/admin/Fields'
import { Button } from '@/components/ui/Button'
import { useAdminList } from '@/hooks/useAdminList'
import { audit } from '@/services/admin.service'

const when = (iso) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kathmandu',
  }).format(new Date(iso))

export default function AuditPage() {
  const [entity, setEntity] = useState('')
  const [entityId, setEntityId] = useState('')
  const [filters, setFilters] = useState({})
  const { rows, tableProps } = useAdminList('audit', audit.list, filters)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setFilters({ entity: entity.trim(), entityId: entityId.trim() })
        }}
      >
        <TextField
          label="Entity (e.g. business, user)"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        />
        <TextField
          label="Entity id"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      <DataTable
        caption="Audit log"
        rows={rows}
        rowLabel={(a) => a.action}
        empty="No entries."
        columns={[
          { key: 'createdAt', header: 'When (Nepal time)', render: (a) => when(a.createdAt) },
          { key: 'actor', header: 'Who', render: (a) => a.actor?.email ?? 'System' },
          { key: 'action', header: 'Action' },
          {
            key: 'entity',
            header: 'Entity',
            render: (a) => `${a.entity}${a.entityId ? ` ${a.entityId.slice(0, 8)}…` : ''}`,
          },
          {
            key: 'diff',
            header: 'Change',
            render: (a) =>
              a.diff ? (
                <details>
                  <summary className="cursor-pointer text-brand">Show</summary>
                  <pre className="max-w-md overflow-auto rounded-box bg-surface-raised p-2 text-xs">
                    {JSON.stringify(a.diff, null, 2)}
                  </pre>
                </details>
              ) : (
                '—'
              ),
          },
          { key: 'ip', header: 'IP' },
        ]}
        {...tableProps}
      />
    </div>
  )
}
