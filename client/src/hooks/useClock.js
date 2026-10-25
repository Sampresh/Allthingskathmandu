'use client'

import { useSyncExternalStore } from 'react'

const everyMinute = (callback) => {
  const timer = setInterval(callback, 60_000)
  return () => clearInterval(timer)
}

/**
 * A value computed from the current time, refreshed each minute. The server (and the first
 * client render) uses `serverValue`, so cached HTML hydrates without mismatches.
 */
export function useClockValue(compute, serverValue) {
  return useSyncExternalStore(everyMinute, compute, () => serverValue)
}
