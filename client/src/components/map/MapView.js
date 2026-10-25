'use client'

import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps'

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
// Kathmandu Valley
const VALLEY = { lat: 27.7, lng: 85.33 }

/**
 * Google map with one pin per point: { id, lat, lng, label, href? }. Loaded on demand only
 * (see LazyMap), never in the first page load.
 */
export default function MapView({ points, zoom = 14, className = 'h-80' }) {
  const center = points.length === 1 ? points[0] : (points[0] ?? VALLEY)
  return (
    <APIProvider apiKey={KEY}>
      <Map
        defaultCenter={{ lat: center.lat, lng: center.lng }}
        defaultZoom={points.length > 1 ? 12 : zoom}
        gestureHandling="cooperative"
        className={`${className} w-full overflow-hidden rounded-box`}
      >
        {points.map((p) => (
          <Marker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            title={p.label}
            onClick={p.href ? () => window.location.assign(p.href) : undefined}
          />
        ))}
      </Map>
    </APIProvider>
  )
}
