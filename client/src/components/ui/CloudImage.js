import cloudinaryLoader, { isAllowedImageUrl } from '@/lib/cloudinaryLoader'

/**
 * Responsive image rendered as plain HTML (no image runtime in the browser, for the Part 4 §9
 * JS budget). The host (Cloudinary, or Unsplash for stock photos) picks format and quality;
 * the browser picks a width from srcSet. Lazy unless `priority`. Renders nothing for a URL
 * from a host we do not serve.
 */
export function CloudImage({
  src,
  alt,
  width,
  height,
  widths,
  sizes,
  priority = false,
  className,
  style,
}) {
  if (!isAllowedImageUrl(src)) return null
  const candidates = widths ?? [width, width * 2, width * 3]
  return (
    // eslint-disable-next-line @next/next/no-img-element -- server-rendered srcSet, see above
    <img
      src={cloudinaryLoader({ src, width })}
      srcSet={candidates.map((w) => `${cloudinaryLoader({ src, width: w })} ${w}w`).join(', ')}
      sizes={sizes ?? `${width}px`}
      width={width}
      height={height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={className}
      style={style}
    />
  )
}
