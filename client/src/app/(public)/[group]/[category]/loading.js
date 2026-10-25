import { CardListSkeleton, Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-9 w-72" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-24 rounded-pill" />
        ))}
      </div>
      <CardListSkeleton />
    </div>
  )
}
