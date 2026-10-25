'use client'

import { use } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ListingForm } from '@/components/admin/ListingForm'
import { Skeleton } from '@/components/ui/Skeleton'
import { listings } from '@/services/admin.service'

export default function EditListingPage({ params }) {
  const { id } = use(params)
  const { data, isPending, isError } = useQuery({
    queryKey: ['admin', 'listing', id],
    queryFn: () => listings.get(id),
  })

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/listings" className="text-sm font-semibold text-brand">
        ← Listings
      </Link>
      {isPending && <Skeleton className="h-96 w-full max-w-3xl" />}
      {isError && <p className="text-danger">This listing could not be loaded.</p>}
      {data && (
        <>
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <ListingForm key={data.updatedAt} listing={data} />
        </>
      )}
    </div>
  )
}
