import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { translate } from '@/lib/i18n'
import { allPublicMessages } from './ST'

/** items: [{ href?, label }] — the last item is the current page. */
export function Breadcrumbs({ items }) {
  return (
    <nav
      aria-label={translate('common.breadcrumb', 'en', allPublicMessages)}
      className="text-sm text-text-muted"
    >
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden="true" className="size-4" />}
            {item.href ? (
              <Link href={item.href} className="inline-flex min-h-11 items-center hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
