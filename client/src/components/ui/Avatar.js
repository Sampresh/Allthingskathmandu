import { clsx } from 'clsx'
import { isCloudinaryUrl } from '@/lib/cloudinaryLoader'
import { CloudImage } from './CloudImage'

const initials = (name) =>
  (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

/** Image when there is one, otherwise initials. `alt` describes the image. */
export function Avatar({ src, name, alt = '', size = 56, className, priority = false }) {
  const box = clsx(
    'shrink-0 overflow-hidden rounded-box border border-border bg-surface-raised',
    className,
  )
  if (isCloudinaryUrl(src)) {
    return (
      <CloudImage
        src={src}
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className={clsx(box, 'object-contain')}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={clsx(box, 'inline-flex items-center justify-center font-semibold text-text-muted')}
      style={{ width: size, height: size, fontSize: size / 2.8 }}
    >
      {initials(name)}
    </span>
  )
}
