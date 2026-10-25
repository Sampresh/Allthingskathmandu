import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="flex gap-4">
        <Skeleton className="size-18 shrink-0" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:flex">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-11 sm:w-32" />
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full max-w-md" />
    </div>
  )
}
