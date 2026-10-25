import { clsx } from 'clsx'

/** Toggle chip for filters. 44 px tall for touch. */
export function Chip({ selected = false, className, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={clsx(
        'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-pill border px-4 text-sm font-semibold',
        selected
          ? 'border-brand bg-brand text-brand-contrast'
          : 'border-border bg-surface text-text hover:bg-surface-raised',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
