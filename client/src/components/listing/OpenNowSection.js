'use client'

import { useEffect, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { T } from '@/components/common/T'
import { Chip } from '@/components/ui/Chip'
import { useGeolocation } from '@/hooks/useGeolocation'
import { CardGrid } from './ListingCard'

/** "Open now near you": cached list first; with the visitor's location, nearest first. */
export function OpenNowSection({ sectionId, initialItems }) {
  const [items, setItems] = useState(initialItems)
  const near = useGeolocation()

  useEffect(() => {
    if (!near.point) return
    import('@/services/public.service')
      .then(({ getHomeNear }) => getHomeNear(near.point))
      .then((sections) => {
        const match = sections.find((s) => s.id === sectionId)
        if (match) setItems(match.items)
      })
      .catch(() => {})
  }, [near.point, sectionId])

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Chip
          selected={near.status === 'ready'}
          onClick={near.locate}
          disabled={near.status === 'locating'}
        >
          <LocateFixed aria-hidden="true" className="size-4" />
          <T k="home.useLocation" />
        </Chip>
        {near.status === 'denied' && (
          <p className="mt-2 text-sm text-text-muted" role="status">
            <T k="geo.denied" />
          </p>
        )}
      </div>
      <CardGrid cards={items} priorityCount={0} />
    </div>
  )
}
