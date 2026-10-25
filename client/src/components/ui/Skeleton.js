import { clsx } from 'clsx'

export function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={clsx('animate-pulse rounded-box bg-surface-raised', className)}
    />
  )
}

/** Placeholder matching ListingCard's layout. */
export function CardSkeleton() {
  return (
    <div className="flex gap-3 rounded-box border border-border p-4" aria-hidden="true">
      <Skeleton className="size-14 shrink-0" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}

export function CardListSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-3 md:grid-cols-2" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
