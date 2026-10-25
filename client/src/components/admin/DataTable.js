'use client'

import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Admin table (Part 4 §3): optional row selection for bulk actions, loading, empty and error
 * states, and a Load more button for cursor pages. Plain table markup, usable by keyboard.
 */
export function DataTable({
  caption,
  columns,
  rows,
  rowLabel = (row) => row.name ?? row.id,
  selected,
  onSelectedChange,
  loading,
  error,
  onRetry,
  empty = 'Nothing here.',
  hasMore,
  onLoadMore,
  loadingMore,
}) {
  const selectable = Boolean(onSelectedChange)
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected.has(r.id))
  const toggleAll = () => onSelectedChange(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    onSelectedChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-box border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-raised">
            <tr>
              {selectable && (
                <th scope="col" className="w-12 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-5"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={clsx('px-3 py-2 font-semibold', c.className)}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-t border-border">
                  <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border align-top">
                  {selectable && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${rowLabel(row)}`}
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        className="size-5"
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={clsx('px-3 py-2', c.className)}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && error && (
          <div className="flex items-center gap-3 p-4 text-danger" role="alert">
            Could not load this list.
            {onRetry && (
              <Button variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        )}
        {!loading && !error && rows.length === 0 && <p className="p-4 text-text-muted">{empty}</p>}
      </div>
      {hasMore && (
        <div>
          <Button variant="secondary" onClick={onLoadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
