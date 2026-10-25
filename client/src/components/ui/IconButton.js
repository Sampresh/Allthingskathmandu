import Link from 'next/link'
import { clsx } from 'clsx'

/** Square 44 px icon control; `label` is required for screen readers. */
export function IconButton({ label, href, className, children, ...props }) {
  const classes = clsx(
    'inline-flex size-11 items-center justify-center rounded-box text-text hover:bg-surface-raised',
    className,
  )
  if (href) {
    return (
      <Link href={href} aria-label={label} className={classes} {...props}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" aria-label={label} className={classes} {...props}>
      {children}
    </button>
  )
}
