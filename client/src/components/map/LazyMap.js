'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { T } from '@/components/common/T'
import { Skeleton } from '@/components/ui/Skeleton'

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full" />,
})

const HAS_KEY = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY)

/**
 * The map script loads only once this block scrolls into view (Part 4 §9). Without a Maps
 * key it says so; the address and the Directions button still work.
 */
export function LazyMap({ points, className }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!HAS_KEY || !ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  if (!HAS_KEY || !points.length) {
    return (
      <p className="rounded-box border border-dashed border-border p-4 text-sm text-text-muted">
        <T k="listing.mapUnavailable" />
      </p>
    )
  }
  return (
    <div ref={ref} className={className ?? 'h-80'}>
      {visible ? (
        <MapView points={points} className={className ?? 'h-80'} />
      ) : (
        <Skeleton className="size-full" />
      )}
    </div>
  )
}
