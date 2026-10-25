import Link from 'next/link'
import { clsx } from 'clsx'

const variants = {
  primary: 'bg-brand text-brand-contrast hover:opacity-90',
  secondary: 'border border-border bg-surface text-text hover:bg-surface-raised',
  ghost: 'text-text hover:bg-surface-raised',
  danger: 'bg-danger text-brand-contrast hover:opacity-90',
}

/** Verb-labelled action. Renders a link when `href` is given. Minimum 44 px tall. */
export function Button({
  variant = 'primary',
  href,
  className,
  fullWidth = false,
  loading = false,
  disabled,
  type = 'button',
  children,
  ...props
}) {
  const classes = clsx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-box px-4 text-base font-semibold transition-opacity',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variants[variant],
    fullWidth && 'w-full',
    className,
  )

  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    )
  }
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  )
}
