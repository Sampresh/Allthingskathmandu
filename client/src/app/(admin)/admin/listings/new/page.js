'use client'

import Link from 'next/link'
import { ListingForm } from '@/components/admin/ListingForm'

export default function NewListingPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/listings" className="text-sm font-semibold text-brand">
        ← Listings
      </Link>
      <h1 className="text-2xl font-semibold">New listing</h1>
      <ListingForm />
    </div>
  )
}
