'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { AccountT as T } from '@/components/common/AccountT'
import { Button } from '@/components/ui/Button'
import { myEvents, signEventCover, submitEvent } from '@/services/member.service'
import { EventForm } from './EventForm'
import { Section } from './Section'
import { SubmittedEvents } from './SubmittedEvents'

/** A member's event submissions and the form to add one. */
export function EventsPage() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(0)

  return (
    <div className="flex flex-col gap-6">
      <Section titleKey="events.mine.title">
        <p className="text-text-muted">
          <T k="events.mine.rules" />
        </p>
        <SubmittedEvents queryKey={['account', 'events']} load={myEvents} />
      </Section>
      <Section titleKey="events.mine.add">
        {adding ? (
          <EventForm
            key={adding}
            signCover={signEventCover}
            onSubmit={async (body) => {
              await submitEvent(body)
              queryClient.invalidateQueries({ queryKey: ['account', 'events'] })
            }}
          />
        ) : (
          <Button onClick={() => setAdding((n) => n + 1)} className="self-start">
            <Plus aria-hidden="true" className="size-5" />
            <T k="events.mine.add" />
          </Button>
        )}
      </Section>
    </div>
  )
}
