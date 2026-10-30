import { clsx } from 'clsx'
import { CloudImage } from '@/components/ui/CloudImage'

const TINTS = 8

/** Stable tint (1 to 8) for a category, so every card in a category shares a colour. */
export function tintFor(key = '') {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (hash % TINTS) + 1
}

const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

/**
 * Square logo, or a monogram tile tinted by the listing's category when there is no logo.
 * Decorative next to the name, so alt is empty unless `alt` is given.
 */
export function ListingLogo({
  name,
  logoUrl,
  tintKey,
  size = 56,
  priority = false,
  alt = '',
  className,
}) {
  const box = clsx('shrink-0 overflow-hidden rounded-box', className)
  if (logoUrl) {
    return (
      <CloudImage
        src={logoUrl}
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className={clsx(box, 'border border-border bg-surface object-contain')}
        style={{ width: size, height: size }}
      />
    )
  }
  const tint = tintFor(tintKey ?? name)
  return (
    <span
      aria-hidden={alt ? undefined : true}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      className={clsx(box, 'inline-flex items-center justify-center font-display font-bold')}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `var(--tint-${tint}-bg)`,
        color: `var(--tint-${tint}-fg)`,
      }}
    >
      {initials(name)}
    </span>
  )
}
