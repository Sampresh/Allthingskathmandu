'use client'

import { usePathname } from 'next/navigation'
import { findNavItem } from './adminNav'

/** Page title, one-line description (defaults to the sidebar's) and actions on the right. */
export function PageHeader({ title, description, actions }) {
  const pathname = usePathname()
  const nav = findNavItem(pathname)
  const isSectionRoot = nav?.item.href === pathname
  const subtitle = description ?? (isSectionRoot ? nav.item.description : undefined)

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}
