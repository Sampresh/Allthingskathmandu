'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { LocateFixed } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const HAS_KEY = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY)
const PickerMap = dynamic(() => import('./PickerMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full" />,
})

/**
 * Map pin for a listing: click the map (with a Maps key), use the current location, or type
 * coordinates. `value` = { lat, lng } or null.
 */
export function LocationPicker({ value, onChange }) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState(null)

  const here = () => {
    if (!navigator.geolocation) return setError('This browser cannot share its location')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange({
          lat: Number(coords.latitude.toFixed(6)),
          lng: Number(coords.longitude.toFixed(6)),
        })
        setLocating(false)
      },
      () => {
        setError('Location permission was denied')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const setCoord = (key) => (e) => {
    const n = e.target.value === '' ? '' : Number(e.target.value)
    onChange({ lat: value?.lat ?? '', lng: value?.lng ?? '', [key]: n })
  }

  return (
    <div className="flex flex-col gap-3">
      {HAS_KEY ? (
        <PickerMap value={value} onChange={onChange} />
      ) : (
        <p className="text-sm text-text-muted">
          Use your current location while at the business, or enter the coordinates.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm font-semibold">
          Latitude
          <input
            type="number"
            step="any"
            value={value?.lat ?? ''}
            onChange={setCoord('lat')}
            className="min-h-11 rounded-box border border-text-muted bg-surface px-3 font-normal"
          />
        </label>
        <label className="flex flex-col text-sm font-semibold">
          Longitude
          <input
            type="number"
            step="any"
            value={value?.lng ?? ''}
            onChange={setCoord('lng')}
            className="min-h-11 rounded-box border border-text-muted bg-surface px-3 font-normal"
          />
        </label>
        <Button variant="secondary" onClick={here} loading={locating}>
          <LocateFixed aria-hidden="true" className="size-4" />
          Use my current location
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
