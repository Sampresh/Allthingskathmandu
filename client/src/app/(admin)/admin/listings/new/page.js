'use client'

import Link from 'next/link'
import { ListingForm } from '@/components/admin/ListingForm'
import { PageHeader } from '@/components/admin/PageHeader'

export default function NewListingPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/listings" className="text-sm font-semibold text-brand">
        ← Listings
      </Link>
      <PageHeader title="New listing" />
      <ListingForm />
    </div>
  )
}
