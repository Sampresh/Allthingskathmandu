'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { DataTable } from '@/components/admin/DataTable'
import { SelectField, TextArea, TextField } from '@/components/admin/Fields'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useAdminList } from '@/hooks/useAdminList'
import { formatDate } from '@/lib/format'
import { listings } from '@/services/admin.service'

const STATUSES = ['LIVE', 'DRAFT', 'PENDING', 'SUSPENDED']
const statusTone = { LIVE: 'success', DRAFT: 'neutral', PENDING: 'brand', SUSPENDED: 'danger' }

function ImportDialog({ open, onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [csv, setCsv] = useState('')
  const [jobId, setJobId] = useState(null)
  const [job, setJob] = useState(null)

  // Poll the queued import until it finishes.
  useEffect(() => {
    if (!jobId) return
    const timer = setInterval(async () => {
      const status = await listings.importStatus(jobId).catch(() => null)
      if (!status) return
      setJob(status)
      if (['completed', 'failed'].includes(status.state)) {
        clearInterval(timer)
        queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] })
      }
    }, 1500)
    return () => clearInterval(timer)
  }, [jobId, queryClient])

  const start = async () => {
    try {
      const { jobId: id } = await listings.importCsv(csv)
      setJobId(id)
      setJob({ state: 'waiting' })
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const reset = () => {
    setCsv('')
    setJobId(null)
    setJob(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={reset} title="Import listings from CSV">
      {!jobId ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            Columns: name, nameNe, slug, type, category, tags, area, shortDesc, description, phone,
            whatsapp, email, website, playStoreUrl, appStoreUrl, address, lat, lng, priceLevel,
            status. Category and tags are slugs separated by semicolons (first category is primary).
            Rows whose slug exists update that listing. New listings start as DRAFT unless status
            says otherwise.
          </p>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => setCsv((await e.target.files?.[0]?.text()) ?? '')}
              className="text-sm font-normal"
            />
          </label>
          <TextArea
            label="Or paste CSV"
            rows={6}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <Button onClick={start} disabled={!csv.trim()}>
            Start import
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p>
            Status: <strong>{job?.state ?? 'waiting'}</strong>
          </p>
          {job?.result && (
            <>
              <p>
                Created {job.result.created}, updated {job.result.updated}, failed{' '}
                {job.result.failed}.
              </p>
              {job.result.errors.length > 0 && (
                <ul className="max-h-60 overflow-y-auto text-sm text-danger">
                  {job.result.errors.map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {job?.error && <p className="text-danger">{job.error}</p>}
          <Button variant="secondary" onClick={reset}>
            Close
          </Button>
        </div>
      )}
    </Dialog>
  )
}

export default function ListingsPage() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('status') ?? ''),
  )
  const [selected, setSelected] = useState(new Set())
  const [bulkStatus, setBulkStatus] = useState('LIVE')
  const [importing, setImporting] = useState(false)
  const { rows, query, tableProps } = useAdminList('listings', listings.list, { q: search, status })

  const applyBulk = async () => {
    let done = 0
    for (const id of selected) {
      try {
        await listings.setStatus(id, bulkStatus)
        done += 1
      } catch (err) {
        toast(errorMessage(err), 'error')
      }
    }
    toast(`${done} listing${done === 1 ? '' : 's'} set to ${bulkStatus}`)
    setSelected(new Set())
    query.refetch()
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (l) => (
        <Link href={`/admin/listings/${l.id}`} className="font-semibold text-brand hover:underline">
          {l.name}
        </Link>
      ),
    },
    { key: 'category', header: 'Category', render: (l) => l.category?.nameEn ?? '—' },
    { key: 'area', header: 'Area', render: (l) => l.area?.nameEn ?? '—' },
    { key: 'type', header: 'Type' },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <Badge tone={statusTone[l.status]}>{l.status}</Badge>,
    },
    { key: 'owner', header: 'Owner', render: (l) => l.owner?.email ?? '—' },
    {
      key: 'featuredUntil',
      header: 'Featured until',
      render: (l) =>
        l.featuredUntil && new Date(l.featuredUntil) > new Date()
          ? formatDate(l.featuredUntil)
          : '—',
    },
    { key: 'updatedAt', header: 'Updated', render: (l) => formatDate(l.updatedAt) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Listings</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImporting(true)}>
            Import CSV
          </Button>
          <Button href="/admin/listings/new">New listing</Button>
        </div>
      </div>
      <form
        role="search"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setSearch(q.trim())
        }}
      >
        <TextField
          label="Search name or slug"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-64"
        />
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-box border border-brand p-3">
          <p className="self-center font-semibold">{selected.size} selected</p>
          <SelectField
            label="Set status to"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectField>
          <Button onClick={applyBulk}>Apply</Button>
        </div>
      )}
      <DataTable
        caption="Listings"
        columns={columns}
        rows={rows}
        selected={selected}
        onSelectedChange={setSelected}
        empty="No listings match."
        {...tableProps}
      />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  )
}
