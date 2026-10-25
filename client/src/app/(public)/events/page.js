import { Plus } from 'lucide-react'
import { ST as T } from '@/components/common/ST'
import { EventList } from '@/components/events/EventList'
import { Button } from '@/components/ui/Button'
import { pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'

export const revalidate = 3600

export const metadata = pageMetadata({
  title: 'Events in Kathmandu',
  description:
    'Upcoming concerts, fairs, festivals and workshops in Kathmandu, Patan and Bhaktapur.',
  path: '/events',
})

export default async function EventsPage() {
  const [events, areas] = await Promise.all([
    publicGet('/events?limit=20', { tags: ['events'] }),
    publicGet('/areas', { tags: ['areas'] }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-3xl font-semibold">
            <T k="events.title" />
          </h1>
          <p className="text-text-muted">
            <T k="events.intro" />
          </p>
        </div>
        <Button href="/account/events" prefetch={false} variant="secondary">
          <Plus aria-hidden="true" className="size-5" />
          <T k="events.add" />
        </Button>
      </div>
      <EventList
        areas={areas?.data ?? []}
        initialItems={events?.data ?? []}
        initialCursor={events?.meta.nextCursor ?? null}
      />
    </div>
  )
}
