'use client'

import { useRef } from 'react'
import { clsx } from 'clsx'

// Glow colours come from the theme, so cards follow light/dark mode and the admin blue brand.
const TONES = {
  brand: 'var(--atk-brand)',
  success: 'var(--atk-success)',
  warning: 'var(--atk-warning)',
  danger: 'var(--atk-danger)',
  featured: 'var(--atk-featured)',
}

/**
 * A card whose border, face and a faint grid light up around the pointer (`.glow-card` in
 * globals.css). The pointer position is written to CSS variables on the element, so moving the
 * mouse never re-renders React. Pass `as={Link}` (with href) for a card that is a link.
 */
export function GlowCard({
  as: Tag = 'div',
  tone = 'brand',
  className,
  bodyClassName = 'p-5',
  style,
  children,
  ...props
}) {
  const ref = useRef(null)

  const follow = (event) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--glow-x', `${event.clientX - rect.left}px`)
    el.style.setProperty('--glow-y', `${event.clientY - rect.top}px`)
  }

  return (
    <Tag
      ref={ref}
      onPointerMove={follow}
      onPointerDown={follow}
      className={clsx('glow-card', className)}
      style={{ '--glow': TONES[tone] ?? TONES.brand, ...style }}
      {...props}
    >
      <span aria-hidden="true" className="glow-card-face" />
      <div className={clsx('relative flex h-full flex-col', bodyClassName)}>{children}</div>
    </Tag>
  )
}
