'use client'

import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'
import { T } from './T'

const subscribe = (cb) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** Shown while the browser is offline (Part 4 §7): the page on screen is the cached one. */
export function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  if (online) return null
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-semibold text-surface"
    >
      <WifiOff aria-hidden="true" className="size-4" />
      <T k="offline.notice" />
    </div>
  )
}
