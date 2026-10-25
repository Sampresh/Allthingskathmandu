'use client'

import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps'

const KATHMANDU = { lat: 27.7172, lng: 85.324 }

/** Click to place the pin. Loaded only on the business location page. */
export default function PickerMap({ value, onChange }) {
  const point =
    value?.lat !== '' && value?.lng !== '' && value
      ? { lat: Number(value.lat), lng: Number(value.lng) }
      : null
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}>
      <Map
        defaultCenter={point ?? KATHMANDU}
        defaultZoom={point ? 16 : 12}
        gestureHandling="greedy"
        onClick={(e) => {
          const ll = e.detail.latLng
          if (ll) onChange({ lat: Number(ll.lat.toFixed(6)), lng: Number(ll.lng.toFixed(6)) })
        }}
        className="h-80 w-full overflow-hidden rounded-box"
      >
        {point && <Marker position={point} />}
      </Map>
    </APIProvider>
  )
}
