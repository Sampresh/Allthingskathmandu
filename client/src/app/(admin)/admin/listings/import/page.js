'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowLeft, CircleCheck, Download, FileUp } from 'lucide-react'
import { canSee } from '@/components/admin/adminNav'
import { PageHeader } from '@/components/admin/PageHeader'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { saveBlob } from '@/lib/download'
import { listings } from '@/services/admin.service'
import { useAuthStore } from '@/store/authStore'

const ACTION_TONE = { create: 'success', update: 'brand', skip: 'neutral', error: 'danger' }
const VIEWS = [
  ['all', 'All rows'],
  ['error', 'Errors'],
  ['flagged', 'To check'],
  ['create', 'New'],
  ['update', 'Updates'],
]
const MAX_BYTES = 2_000_000

/** Upload a CSV (docs/LISTINGS.md format) → dry run report → confirm → progress → result. */
export default function ImportListingsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const canEdit = canSee(
    useAuthStore((s) => s.user.role),
    'ADMIN',
  )
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [csv, setCsv] = useState('')
  const [dryReport, setDryReport] = useState(null)
  const [jobId, setJobId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState('all')

  const job = useQuery({
    queryKey: ['admin', 'import', jobId],
    queryFn: () => listings.importStatus(jobId),
    enabled: Boolean(jobId),
    refetchInterval: (query) =>
      ['completed', 'failed'].includes(query.state.data?.state) ? false : 1000,
  })
  const finished = job.data?.state === 'completed'
  // After a real run the report is the job's result; before it, the dry run's.
  const report = finished
    ? { counts: job.data.counts, rows: job.data.rows, final: true }
    : dryReport

  useEffect(() => {
    if (!finished) return
    queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] })
  }, [finished, queryClient])

  const choose = async (picked) => {
    setDryReport(null)
    setJobId(null)
    if (!picked) return
    if (picked.size > MAX_BYTES) {
      toast('Choose a CSV up to 2 MB', 'error')
      return
    }
    setFile(picked)
    setCsv(await picked.text())
  }

  const dryRun = async () => {
    setBusy(true)
    try {
      setDryReport(await listings.importCsv(csv, true))
      setView('all')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    setBusy(true)
    try {
      const { jobId: id } = await listings.importCsv(csv, false)
      setJobId(id)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const allRows = report?.rows ?? []
  const rows =
    view === 'all'
      ? allRows
      : view === 'flagged'
        ? allRows.filter((r) => r.flags.length)
        : allRows.filter((r) => r.action === view)

  const progress = job.data?.progress
  const running = jobId && !finished && job.data?.state !== 'failed'

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/listings"
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-text-muted hover:text-text"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Listings
      </Link>
      <PageHeader
        title="Import listings"
        description="CSV in the LISTINGS.md format. A dry run shows what will happen before anything is written."
      />

      <ol className="grid gap-3 sm:grid-cols-4" aria-label="Steps">
        {['Choose file', 'Dry run', 'Import', 'Download result'].map((label, i) => {
          const step = finished ? 4 : jobId ? 3 : report ? 2 : file ? 1 : 0
          return (
            <li
              key={label}
              className={clsx(
                'flex items-center gap-2 rounded-box border p-3 text-sm',
                i < step
                  ? 'border-success text-success'
                  : i === step
                    ? 'border-brand font-semibold'
                    : 'border-border text-text-muted',
              )}
            >
              <span className="grid size-6 place-content-center rounded-pill bg-surface-raised text-xs font-semibold">
                {i + 1}
              </span>
              {label}
            </li>
          )
        })}
      </ol>

      <section className="flex flex-col gap-4 rounded-box border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Choose a CSV file"
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={running}>
            <FileUp aria-hidden="true" className="size-4" />
            {file ? 'Choose another file' : 'Choose CSV file'}
          </Button>
          {file && (
            <span className="text-sm text-text-muted">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              onClick={dryRun}
              disabled={!csv || running}
              loading={busy && !jobId}
            >
              Dry run
            </Button>
            {canEdit && report && !report.final && (
              <Button
                onClick={start}
                disabled={running || report.counts.error > 0}
                loading={busy && !jobId}
              >
                Import {report.counts.create + report.counts.update} rows
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Columns: category, type, name, address, phone, hours, website, desc, g_rating, g_reviews,
          place_id. Google ratings are never stored. Rows match existing listings by place id, then
          by name in the same category, so a second import never duplicates. New listings start as
          Pending and unverified.
        </p>
        {report?.counts.error > 0 && !report.final && (
          <p className="text-sm text-danger" role="alert">
            Fix the rows with errors and run the dry run again before importing.
          </p>
        )}
        {running && (
          <div className="flex flex-col gap-2" role="status">
            <p className="text-sm font-semibold">
              Importing…{' '}
              {progress ? `${progress.done} of ${progress.total} rows` : 'waiting for the worker'}
            </p>
            <progress
              className="w-full"
              max={progress?.total ?? 1}
              value={progress?.done ?? 0}
              aria-label="Import progress"
            />
          </div>
        )}
        {job.data?.state === 'failed' && (
          <p className="text-sm text-danger" role="alert">
            The import stopped: {job.data.error}
          </p>
        )}
        {finished && (
          <div className="flex flex-wrap items-center gap-3 rounded-box border border-success bg-success/10 p-3">
            <CircleCheck aria-hidden="true" className="size-5 text-success" />
            <p className="mr-auto text-sm">Import finished. New listings are in the Pending tab.</p>
            <Button
              variant="secondary"
              onClick={async () =>
                saveBlob(await listings.importResult(jobId), `import-${jobId}.csv`)
              }
            >
              <Download aria-hidden="true" className="size-4" /> Download result CSV
            </Button>
          </div>
        )}
      </section>

      {report && (
        <section aria-labelledby="report" className="flex flex-col gap-4">
          <h2 id="report" className="text-lg font-semibold">
            {report.final ? 'Result' : 'Dry run'}
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['Rows', report.counts.total],
              ['New', report.counts.create],
              ['Updates', report.counts.update],
              ['Unchanged', report.counts.skip],
              ['Errors', report.counts.error],
              ['Need an area', report.counts.needsArea],
            ].map(([label, value]) => (
              <div key={label} className="rounded-box border border-border bg-surface p-3">
                <dt className="text-xs text-text-muted">{label}</dt>
                <dd
                  className={clsx(
                    'text-2xl font-semibold',
                    label === 'Errors' && value > 0 && 'text-danger',
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
            {VIEWS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={clsx(
                  'inline-flex min-h-9 items-center rounded-pill border px-3 text-sm',
                  view === key
                    ? 'border-brand bg-brand/10 font-semibold text-brand'
                    : 'border-border',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[32rem] overflow-auto rounded-box border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Row-level report</caption>
              <thead className="sticky top-0 bg-surface-raised">
                <tr>
                  {['Line', 'Action', 'Name', 'Category', 'Area', 'Notes'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-3 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.line} className="border-t border-border align-top">
                    <td className="px-3 py-2 text-text-muted">{row.line}</td>
                    <td className="px-3 py-2">
                      <Badge tone={ACTION_TONE[row.action]}>{row.action}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {row.id && report.final ? (
                        <Link
                          href={`/admin/listings/${row.id}`}
                          className="font-semibold hover:text-brand"
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">{row.name}</span>
                      )}
                      {row.slug && (
                        <span className="block text-xs text-text-muted">/{row.slug}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{row.category ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.area ?? <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {[...row.messages, ...row.flags].map((note) => (
                        <span
                          key={note}
                          className={clsx(
                            'block',
                            row.action === 'error'
                              ? 'text-danger'
                              : row.flags.includes(note)
                                ? 'text-warning'
                                : 'text-text-muted',
                          )}
                        >
                          {note}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="p-6 text-center text-text-muted">No rows here.</p>}
          </div>
        </section>
      )}
    </div>
  )
}
