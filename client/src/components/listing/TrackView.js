'use client'

import { useEffect } from 'react'
import { track } from '@/services/track.service'

/** Counts one view per page visit (the API dedupes repeats). */
export function TrackView({ businessId }) {
  useEffect(() => {
    track(businessId, 'view')
  }, [businessId])
  return null
}
