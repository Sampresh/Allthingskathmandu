'use client'

import { useId } from 'react'
import { clsx } from 'clsx'

const control = 'rounded-box border border-text-muted bg-surface px-3 text-base text-text'

export function TextField({ label, error, hint, className, ...props }) {
  const id = useId()
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        className={clsx(control, 'min-h-11')}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}

export function TextArea({ label, error, hint, className, rows = 3, ...props }) {
  const id = useId()
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        className={clsx(control, 'py-2')}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}

export function SelectField({ label, error, className, children, ...props }) {
  const id = useId()
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select id={id} className={clsx(control, 'min-h-11')} {...props}>
        {children}
      </select>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}

export function Checkbox({ label, className, ...props }) {
  return (
    <label
      className={clsx('inline-flex min-h-11 items-center gap-2 text-sm font-semibold', className)}
    >
      <input type="checkbox" className="size-5 accent-[var(--atk-brand)]" {...props} />
      {label}
    </label>
  )
}
