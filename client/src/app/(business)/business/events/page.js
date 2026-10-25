'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { EventForm } from '@/components/account/EventForm'
import { SubmittedEvents } from '@/components/account/SubmittedEvents'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useBusinessListing } from '@/hooks/useBusinessListing'
import { listingEvents, submitListingEvent } from '@/services/business.service'
import { signEventCover } from '@/services/member.service'

/** Events for the selected listing (phase 2): submit for moderation and see their status. */
export default function BusinessEventsPage() {
  const queryClient = useQueryClient()
  const { listingId, current } = useBusinessListing()
  const [adding, setAdding] = useState(0)
  if (!listingId) return <Skeleton className="h-40 w-full" />

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Events</h1>
        <p className="text-text-muted">
          Events for {current.name} appear in the events calendar after a quick check.
        </p>
      </div>
      <SubmittedEvents
        queryKey={['business', 'events', listingId]}
        load={(cursor) => listingEvents(listingId, cursor)}
      />
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Add an event</h2>
        {adding ? (
          <EventForm
            key={`${listingId}-${adding}`}
            signCover={signEventCover}
            onSubmit={async (body) => {
              await submitListingEvent(listingId, body)
              queryClient.invalidateQueries({ queryKey: ['business', 'events', listingId] })
            }}
          />
        ) : (
          <Button onClick={() => setAdding((n) => n + 1)} className="self-start">
            <Plus aria-hidden="true" className="size-5" />
            Add an event
          </Button>
        )}
      </section>
    </div>
  )
}
