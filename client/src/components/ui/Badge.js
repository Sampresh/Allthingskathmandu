import { clsx } from 'clsx'

const tones = {
  neutral: 'border-border text-text-muted',
  success: 'border-success text-success',
  featured: 'border-featured text-featured',
  brand: 'border-brand text-brand',
  danger: 'border-danger text-danger',
}

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
