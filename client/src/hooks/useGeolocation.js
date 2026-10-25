'use client'

import { useCallback, useState } from 'react'

/** Asks for the visitor's position on demand (never on page load). */
export function useGeolocation() {
  const [point, setPoint] = useState(null)
  const [status, setStatus] = useState('idle') // idle | locating | ready | denied

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setStatus('denied')
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPoint({
          lat: Number(coords.latitude.toFixed(5)),
          lng: Number(coords.longitude.toFixed(5)),
        })
        setStatus('ready')
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }, [])

  const clear = useCallback(() => {
    setPoint(null)
    setStatus('idle')
  }, [])

  return { point, status, locate, clear }
}
