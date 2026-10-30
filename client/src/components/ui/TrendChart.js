'use client'

import { useId, useState } from 'react'
import { clsx } from 'clsx'

const clamp = (n, min, max) => Math.min(Math.max(n, min), max)

// Smooth line through the chart points.
function smoothPath(points) {
  return points.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = points[i - 1]
    const mid = (prev.x + p.x) / 2
    return `${d} C ${mid} ${prev.y}, ${mid} ${p.y}, ${p.x} ${p.y}`
  }, '')
}

/**
 * Area chart for a daily series: points [{ label, value }]. Hover, touch or arrow keys read a
 * single day. Colour follows `currentColor` (set it with a text-* class).
 */
export function TrendChart({ points, name, className }) {
  const gradientId = `trend-${useId().replace(/[^\w-]/g, '')}`
  const [hover, setHover] = useState(null)
  if (!points.length) return null

  const max = Math.max(...points.map((p) => p.value), 1)
  const last = points.length - 1
  const coords = points.map((p, i) => ({
    x: last ? (i / last) * 100 : 50,
    y: 92 - (p.value / max) * 82,
  }))
  const line = smoothPath(coords)
  const shown = hover ?? last

  const readAt = (clientX, el) => {
    const rect = el.getBoundingClientRect()
    setHover(Math.round(clamp((clientX - rect.left) / rect.width, 0, 1) * last))
  }
  const onKeyDown = (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
    if (event.key === 'Home') setHover(0)
    else if (event.key === 'End') setHover(last)
    else if (step) setHover(clamp((hover ?? last) + step, 0, last))
    else return
    event.preventDefault()
  }

  return (
    <div
      className={clsx(
        'relative min-h-36 flex-1 cursor-crosshair rounded-box outline-offset-4',
        className,
      )}
      tabIndex={0}
      role="group"
      aria-label={`${name} per day. Use the arrow keys to read each day.`}
      onPointerMove={(e) => readAt(e.clientX, e.currentTarget)}
      onPointerDown={(e) => readAt(e.clientX, e.currentTarget)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      onBlur={() => setHover(null)}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y}
            y2={y}
            stroke="var(--atk-border)"
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={`${line} L 100 100 L 0 100 Z`} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover !== null && (
          <line
            x1={coords[hover].x}
            x2={coords[hover].x}
            y1="0"
            y2="100"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute size-3 -translate-1/2 rounded-pill border-2 border-surface bg-current"
        style={{ left: `${coords[shown].x}%`, top: `${coords[shown].y}%` }}
      />
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-box border border-border bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap text-text shadow-overlay"
          style={{
            left: `clamp(3rem, ${coords[hover].x}%, calc(100% - 3rem))`,
            top: `calc(${coords[hover].y}% - 0.875rem)`,
          }}
          role="status"
        >
          <span className="block text-text-muted">{points[hover].label}</span>
          <span className="font-semibold">
            {points[hover].value.toLocaleString('en-US')} {name.toLowerCase()}
          </span>
        </div>
      )}
    </div>
  )
}

/** Small bar strip for a series of numbers; the latest bar is highlighted. */
export function MiniBars({ values, className }) {
  const max = Math.max(...values, 1)
  return (
    <span aria-hidden="true" className={clsx('flex h-12 items-end gap-0.5', className)}>
      {values.map((v, i) => (
        <span
          key={i}
          className={clsx(
            'rounded-sm flex-1 bg-current transition-[height] duration-700 ease-out',
            i === values.length - 1 ? 'opacity-100' : 'opacity-30',
          )}
          style={{ height: `${Math.max((v / max) * 100, 6)}%` }}
        />
      ))}
    </span>
  )
}
