'use client'

import { useId } from 'react'
import { clsx } from 'clsx'

/** Labelled text input with hint and error text wired up for screen readers. */
export function Input({ label, hint, error, className, id, ...props }) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={clsx(
          'min-h-11 rounded-box border bg-surface px-3 text-base text-text placeholder:text-text-muted',
          error ? 'border-danger' : 'border-text-muted/40',
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
