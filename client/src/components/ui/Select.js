'use client'

import { useId } from 'react'
import { clsx } from 'clsx'

/** Native select with a visible or screen-reader-only label. */
export function Select({ label, hideLabel = false, className, children, ...props }) {
  const id = useId()
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-sm font-semibold'}>
        {label}
      </label>
      <select
        id={id}
        className="min-h-11 rounded-box border border-text-muted bg-surface px-3 text-base text-text"
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
