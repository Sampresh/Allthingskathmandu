'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  MapPinned,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { googlePlaceHref, listingHref } from '@/lib/format'
import { areas, categories, listings } from '@/services/admin.service'
import { errorMessage, useToast } from '../Toast'
import { BulkBar } from './BulkBar'
import { DeleteDialog, PermanentDeleteDialog } from './DeleteDialogs'
import { MISSING, STATUS, STATUS_TABS, TYPES, formatDay } from './listingMeta'

const PAGE_SIZE = 50
const EMPTY = new Set()
const FILTER_KEYS = [
  'q',
  'status',
  'group',
  'category',
  'area',
  'type',
  'verified',
  'featured',
  'hasOwner',
  'missing',
  'sort',
  'dir',
]
const COLUMNS = [
  { key: 'logo', label: 'Logo', className: 'w-14' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'area', label: 'Area' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'verified', label: 'Verified' },
  { key: 'updated', label: 'Updated' },
]
// Default direction per sort (matches the API).
const DEFAULT_DIR = { updated: 'desc', verified: 'desc', logo: 'desc' }

/** Filters live in the URL, so a view can be shared and survives the back button. */
function useFilters() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const filters = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])),
    [params],
  )
  const setFilters = (patch) => {
    const next = new URLSearchParams()
    for (const key of FILTER_KEYS) {
      const value = key in patch ? patch[key] : filters[key]
      if (value) next.set(key, value)
    }
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }
  return [filters, setFilters]
}

export function ListingsTable({ canEdit, isSuper }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useFilters()
  // Selection belongs to one view (filters + sort); changing the view starts empty.
  const viewKey = JSON.stringify(filters)
  const [selection, setSelection] = useState({ view: viewKey, ids: new Set() })
  const selected = selection.view === viewKey ? selection.ids : EMPTY
  const setSelected = (next) =>
    setSelection((current) => ({
      view: viewKey,
      ids: typeof next === 'function' ? next(current.view === viewKey ? current.ids : EMPTY) : next,
    }))
  const [dialog, setDialog] = useState(null)
  const [search, setSearch] = useState(filters.q)
  const sort = filters.sort || 'updated'
  const dir = filters.dir || DEFAULT_DIR[sort] || 'asc'
  const inTrash = filters.status === 'TRASH'

  // Search waits for a pause in typing.
  useEffect(() => {
    if (search === filters.q) return
    const timer = setTimeout(() => setFilters({ q: search.trim() }), 300)
    return () => clearTimeout(timer)
  })

  const queryParams = { ...filters, sort, dir, limit: PAGE_SIZE }
  const query = useInfiniteQuery({
    queryKey: ['admin', 'listings', queryParams],
    queryFn: ({ pageParam }) => listings.list({ ...queryParams, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
    placeholderData: (previous) => previous,
  })
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.data) ?? [], [query.data])
  const counts = query.data?.pages[0]?.meta.counts

  const taxonomy = useQuery({ queryKey: ['admin', 'categories'], queryFn: categories.list })
  const areaList = useQuery({ queryKey: ['admin', 'areas'], queryFn: areas.list })
  const groups = taxonomy.data?.groups ?? []
  const categoryOptions = filters.group
    ? (groups.find((g) => g.id === filters.group)?.children ?? [])
    : groups.flatMap((g) => g.children)

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] }),
    ])

  const sortBy = (key) => {
    if (key === sort) setFilters({ dir: dir === 'asc' ? 'desc' : 'asc' })
    else setFilters({ sort: key === 'updated' ? '' : key, dir: '' })
  }

  const toggleMissing = (key) => {
    const current = filters.missing ? filters.missing.split(',') : []
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    setFilters({ missing: next.join(',') })
  }
  const missing = filters.missing ? filters.missing.split(',') : []
  const hasFilters = FILTER_KEYS.some((k) => !['status', 'sort', 'dir'].includes(k) && filters[k])

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const act = async (fn, success) => {
    try {
      await fn()
      toast(success)
      await refresh()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Status"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {STATUS_TABS.map((tab) => {
          const active = (filters.status || '') === tab.key
          return (
            <button
              key={tab.key || 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilters({ status: tab.key })}
              className={clsx(
                '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold',
                active
                  ? 'border-brand text-brand'
                  : 'border-transparent text-text-muted hover:text-text',
              )}
            >
              {tab.label}
              <span
                className={clsx(
                  'rounded-pill px-2 py-0.5 text-xs',
                  active ? 'bg-brand/10' : 'bg-surface-raised',
                )}
              >
                {counts ? counts[tab.count] : '·'}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-3 rounded-box border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-60 flex-1">
            <span className="sr-only">Search listings</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, slug, phone or address"
              className="min-h-11 w-full rounded-box border border-border bg-surface pr-3 pl-9 text-sm"
            />
          </label>
          <FilterSelect
            label="Group"
            value={filters.group}
            onChange={(v) => setFilters({ group: v, category: '' })}
            options={groups.map((g) => [g.id, g.nameEn])}
          />
          <FilterSelect
            label="Category"
            value={filters.category}
            onChange={(v) => setFilters({ category: v })}
            options={categoryOptions.map((c) => [c.id, c.nameEn])}
          />
          <FilterSelect
            label="Area"
            value={filters.area}
            onChange={(v) => setFilters({ area: v })}
            options={[['none', 'No area'], ...(areaList.data ?? []).map((a) => [a.id, a.nameEn])]}
          />
          <FilterSelect
            label="Type"
            value={filters.type}
            onChange={(v) => setFilters({ type: v })}
            options={Object.entries(TYPES)}
          />
          <FilterSelect
            label="Verified"
            value={filters.verified}
            onChange={(v) => setFilters({ verified: v })}
            options={[
              ['true', 'Verified'],
              ['false', 'Not verified'],
            ]}
          />
          <FilterSelect
            label="Featured"
            value={filters.featured}
            onChange={(v) => setFilters({ featured: v })}
            options={[
              ['true', 'Featured'],
              ['false', 'Not featured'],
            ]}
          />
          <FilterSelect
            label="Owner"
            value={filters.hasOwner}
            onChange={(v) => setFilters({ hasOwner: v })}
            options={[
              ['true', 'Has owner'],
              ['false', 'No owner'],
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Missing
          </span>
          {MISSING.map((chip) => {
            const on = missing.includes(chip.key)
            return (
              <button
                key={chip.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleMissing(chip.key)}
                className={clsx(
                  'inline-flex min-h-9 items-center rounded-pill border px-3 text-sm',
                  on
                    ? 'border-brand bg-brand/10 font-semibold text-brand'
                    : 'border-border text-text-muted hover:bg-surface-raised',
                )}
              >
                {chip.label}
              </button>
            )
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setFilters(
                  Object.fromEntries(
                    FILTER_KEYS.map((k) => [k, k === 'status' ? filters.status : '']),
                  ),
                )
              }}
              className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-box px-2 text-sm font-semibold text-text-muted hover:text-text"
            >
              <X aria-hidden="true" className="size-4" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-box border border-border bg-surface">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <caption className="sr-only">
            Listings{counts ? `, ${rows.length} shown` : ''}. Column headers sort the table.
          </caption>
          <thead className="bg-surface-raised">
            <tr>
              {canEdit && (
                <th scope="col" className="w-12 px-4 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all shown listings"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-5 accent-[var(--atk-brand)]"
                  />
                </th>
              )}
              {COLUMNS.map((col) => {
                const active = sort === col.key
                const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={clsx('px-2 py-2', col.className)}
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(col.key)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-box px-2 text-xs font-semibold tracking-wide text-text-muted uppercase hover:text-text"
                    >
                      {col.label}
                      <Icon
                        aria-hidden="true"
                        className={clsx('size-3.5', !active && 'opacity-40')}
                      />
                    </button>
                  </th>
                )
              })}
              <th scope="col" className="w-14 px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {query.isPending &&
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="border-t border-border">
                  <td colSpan={COLUMNS.length + 2} className="px-4 py-3">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
            {rows.map((row) => (
              <Row
                key={row.id}
                row={row}
                canEdit={canEdit}
                isSuper={isSuper}
                selected={selected.has(row.id)}
                onToggle={() => toggle(row.id)}
                onDuplicate={() =>
                  act(() => listings.duplicate(row.id), `Copied as "${row.name} (copy)"`)
                }
                onDelete={() => setDialog({ kind: 'delete', listing: row })}
                onRestore={() => act(() => listings.restore(row.id), `${row.name} restored`)}
                onPermanent={() => setDialog({ kind: 'permanent', listing: row })}
              />
            ))}
          </tbody>
        </table>
        {query.isError && (
          <div className="flex items-center gap-3 p-4 text-danger" role="alert">
            Could not load listings.
            <Button variant="secondary" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {!query.isPending && !query.isError && rows.length === 0 && (
          <p className="p-8 text-center text-text-muted">
            {inTrash ? 'Trash is empty.' : 'No listings match these filters.'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted">
        <span aria-live="polite">
          {rows.length > 0 && `Showing ${rows.length}`}
          {counts &&
            rows.length > 0 &&
            ` of ${counts[STATUS_TABS.find((t) => t.key === (filters.status || '')).count]}`}
        </span>
        {query.hasNextPage && (
          <Button
            variant="secondary"
            onClick={() => query.fetchNextPage()}
            loading={query.isFetchingNextPage}
          >
            Load {PAGE_SIZE} more
          </Button>
        )}
      </div>

      {canEdit && selected.size > 0 && (
        <BulkBar
          ids={[...selected]}
          inTrash={inTrash}
          groups={groups}
          areas={areaList.data ?? []}
          onClear={() => setSelected(new Set())}
          onDone={async () => {
            setSelected(new Set())
            await refresh()
          }}
        />
      )}

      <DeleteDialog
        listing={dialog?.kind === 'delete' ? dialog.listing : null}
        onClose={() => setDialog(null)}
        onConfirm={(listing) =>
          act(() => listings.remove(listing.id), `${listing.name} moved to Trash`)
        }
      />
      <PermanentDeleteDialog
        listing={dialog?.kind === 'permanent' ? dialog.listing : null}
        onClose={() => setDialog(null)}
        onConfirm={(listing, confirmName) =>
          act(
            () => listings.removePermanently(listing.id, confirmName),
            `${listing.name} deleted for good`,
          )
        }
      />
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'min-h-11 appearance-none rounded-box border bg-surface pr-8 pl-3 text-sm',
          value ? 'border-brand font-semibold text-brand' : 'border-border text-text',
        )}
      >
        <option value="">{label}: any</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-text-muted"
      />
    </label>
  )
}

function Row({
  row,
  canEdit,
  isSuper,
  selected,
  onToggle,
  onDuplicate,
  onDelete,
  onRestore,
  onPermanent,
}) {
  const status = STATUS[row.status]
  const trashed = Boolean(row.deletedAt)
  const editHref = `/admin/listings/${row.id}`
  return (
    <tr
      className={clsx(
        'border-t border-border transition-colors hover:bg-surface-raised',
        selected && 'bg-brand/5',
      )}
    >
      {canEdit && (
        <td className="px-4 py-2">
          <input
            type="checkbox"
            aria-label={`Select ${row.name}`}
            checked={selected}
            onChange={onToggle}
            className="size-5 accent-[var(--atk-brand)]"
          />
        </td>
      )}
      <td className="px-2 py-2">
        <Avatar src={row.logoUrl} name={row.name} size={36} alt="" />
      </td>
      <td className="max-w-72 px-2 py-2">
        <Link href={editHref} className="font-semibold hover:text-brand hover:underline">
          {row.name}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          {row.featured && (
            <span className="inline-flex items-center gap-0.5 text-featured">
              <Star aria-hidden="true" className="size-3" /> Featured
            </span>
          )}
          {row.missing.length > 0 && (
            <span title={row.missing.map((m) => `no ${m}`).join(', ')}>
              Missing {row.missing.length}
            </span>
          )}
          {row.status !== 'LIVE' && !trashed && row.publishProblems.length === 0 && (
            <span className="font-semibold text-success">Ready to publish</span>
          )}
        </div>
      </td>
      <td className="px-2 py-2">
        {row.category ? (
          <>
            <span>{row.category.nameEn}</span>
            <span className="block text-xs text-text-muted">{row.category.groupNameEn}</span>
          </>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </td>
      <td className="px-2 py-2">
        {row.area?.nameEn ??
          (['APP', 'HOTLINE'].includes(row.type) ? (
            <span className="text-text-muted">—</span>
          ) : (
            <span className="text-warning">Needs area</span>
          ))}
      </td>
      <td className="px-2 py-2 text-text-muted">{TYPES[row.type]}</td>
      <td className="px-2 py-2">
        {trashed ? (
          <Badge tone="danger">In Trash</Badge>
        ) : (
          <Badge tone={status.tone}>{status.label}</Badge>
        )}
      </td>
      <td className="px-2 py-2">
        {row.isVerified ? (
          <span className="inline-flex items-center gap-1 text-brand">
            <BadgeCheck aria-hidden="true" className="size-4" /> Yes
          </span>
        ) : (
          <span className="text-text-muted">No</span>
        )}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-text-muted">{formatDay(row.updatedAt)}</td>
      <td className="px-2 py-2">
        <RowMenu
          row={row}
          canEdit={canEdit}
          isSuper={isSuper}
          trashed={trashed}
          editHref={editHref}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onRestore={onRestore}
          onPermanent={onPermanent}
        />
      </td>
    </tr>
  )
}

const itemClass =
  'flex min-h-10 w-full items-center gap-2 rounded-box px-3 text-left text-sm hover:bg-surface-raised focus-visible:bg-surface-raised'

function RowMenu({
  row,
  canEdit,
  isSuper,
  trashed,
  editHref,
  onDuplicate,
  onDelete,
  onRestore,
  onPermanent,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const button = useRef(null)

  useEffect(() => {
    if (!open) return
    ref.current?.querySelector('a, button')?.focus()
    const onPointer = (e) => !ref.current?.parentElement.contains(e.target) && setOpen(false)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = [...ref.current.querySelectorAll('a, button')]
        const i = items.indexOf(document.activeElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (fn) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${row.name}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-box text-text-muted hover:bg-surface-raised hover:text-text"
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <div
          ref={ref}
          role="menu"
          aria-label={`Actions for ${row.name}`}
          className="absolute right-0 z-30 mt-1 w-56 rounded-box border border-border bg-surface p-1 shadow-overlay"
        >
          {!trashed && (
            <Link role="menuitem" href={editHref} className={itemClass}>
              <Pencil aria-hidden="true" className="size-4 text-text-muted" />
              {canEdit ? 'Edit' : 'View'}
            </Link>
          )}
          {row.status === 'LIVE' && !trashed && (
            <a
              role="menuitem"
              href={listingHref(row.slug)}
              target="_blank"
              rel="noopener"
              className={itemClass}
            >
              <Eye aria-hidden="true" className="size-4 text-text-muted" />
              Preview on site
              <ExternalLink aria-hidden="true" className="ml-auto size-3.5 text-text-muted" />
            </a>
          )}
          {row.googlePlaceId && (
            <a
              role="menuitem"
              href={googlePlaceHref(row.googlePlaceId)}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
            >
              <MapPinned aria-hidden="true" className="size-4 text-text-muted" />
              Open in Google Maps
              <ExternalLink aria-hidden="true" className="ml-auto size-3.5 text-text-muted" />
            </a>
          )}
          {canEdit && !trashed && (
            <button role="menuitem" type="button" onClick={run(onDuplicate)} className={itemClass}>
              <Copy aria-hidden="true" className="size-4 text-text-muted" />
              Duplicate
            </button>
          )}
          {canEdit && !trashed && (
            <button
              role="menuitem"
              type="button"
              onClick={run(onDelete)}
              className={clsx(itemClass, 'text-danger')}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Move to Trash
            </button>
          )}
          {canEdit && trashed && (
            <button role="menuitem" type="button" onClick={run(onRestore)} className={itemClass}>
              <RotateCcw aria-hidden="true" className="size-4 text-text-muted" />
              Restore
            </button>
          )}
          {isSuper && trashed && (
            <button
              role="menuitem"
              type="button"
              onClick={run(onPermanent)}
              className={clsx(itemClass, 'text-danger')}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Delete for good
            </button>
          )}
        </div>
      )}
    </div>
  )
}
