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
 * coordinates (unless `showCoordinates` is false). `value` = { lat, lng } or null.
 */
export function LocationPicker({
  value,
  onChange,
  hint = 'Use your current location while at the business, or enter the coordinates.',
  showCoordinates = true,
}) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState(null)

  const here = () => {
    if (!navigator.geolocation) return setError('This browser cannot share its location')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        place({
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

  // While typing, keep the text ("27." is not a number yet) and send numbers when they parse.
  const [draft, setDraft] = useState(null)
  const shown = draft ?? { lat: value?.lat ?? '', lng: value?.lng ?? '' }
  const setCoord = (key) => (e) => {
    const next = { ...shown, [key]: e.target.value }
    setDraft(next)
    const lat = Number.parseFloat(next.lat)
    const lng = Number.parseFloat(next.lng)
    onChange({ lat: Number.isFinite(lat) ? lat : '', lng: Number.isFinite(lng) ? lng : '' })
  }
  const place = (point) => {
    setDraft(null)
    onChange(point)
  }

  return (
    <div className="flex flex-col gap-3">
      {HAS_KEY ? (
        <PickerMap value={value} onChange={place} />
      ) : (
        <p className="text-sm text-text-muted">{hint}</p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        {showCoordinates && (
          <>
            <label className="flex flex-col text-sm font-semibold">
              Latitude
              <input
                inputMode="decimal"
                value={shown.lat}
                onChange={setCoord('lat')}
                className="min-h-11 rounded-box border border-text-muted bg-surface px-3 font-normal"
              />
            </label>
            <label className="flex flex-col text-sm font-semibold">
              Longitude
              <input
                inputMode="decimal"
                value={shown.lng}
                onChange={setCoord('lng')}
                className="min-h-11 rounded-box border border-text-muted bg-surface px-3 font-normal"
              />
            </label>
          </>
        )}
        <Button variant="secondary" onClick={here} loading={locating}>
          <LocateFixed aria-hidden="true" className="size-4" />
          Use my current location
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
