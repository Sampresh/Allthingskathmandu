'use client'

import { useEffect, useRef, useState } from 'react'

const defaultFormat = (n) => Math.round(n).toLocaleString('en-US')

/** Counts smoothly from the last shown number to `target` (jumps when motion is reduced). */
export function useAnimatedNumber(target, duration = 700) {
  const [value, setValue] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    const ms = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration
    const from = current.current
    const start = performance.now()
    let frame = 0
    const tick = (now) => {
      const t = ms ? Math.min((now - start) / ms, 1) : 1
      const eased = 1 - (1 - t) ** 3
      current.current = from + (target - from) * eased
      setValue(current.current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

/** A number that counts up; screen readers get the final value only. */
export function AnimatedNumber({ value, format = defaultFormat, duration }) {
  const shown = useAnimatedNumber(value, duration)
  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        {format(shown)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  )
}
