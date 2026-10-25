'use client'

import { useClockValue } from '@/hooks/useClock'
import { isOpenAt } from '@/lib/hours'
import { T } from '@/components/common/T'
import { Badge } from '@/components/ui/Badge'

/**
 * "Open now" / "Closed now". Starts from the server's value, then recomputes from the
 * hours in the browser, since a cached page may be up to an hour old.
 */
export function OpenStatus({ hours, initial, showClosed = false }) {
  const open = useClockValue(() => isOpenAt(hours), initial)

  if (open === true) {
    return (
      <Badge tone="success">
        <T k="listing.openNow" />
      </Badge>
    )
  }
  if (open === false && showClosed) {
    return (
      <Badge>
        <T k="listing.closedNow" />
      </Badge>
    )
  }
  return null
}
