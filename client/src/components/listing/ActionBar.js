import { clsx } from 'clsx'
import { Download, Globe, MessageCircle, Navigation, Phone } from 'lucide-react'
import { ST as T } from '@/components/common/ST'
import { directionsHref, telHref, whatsappHref } from '@/lib/format'
import { TrackedLink } from './TrackedLink'

/** Call, WhatsApp, Directions, Website; apps: Play Store and App Store first. */
function actionsFor(listing) {
  const { contact } = listing
  const actions = []
  if (listing.type === 'APP') {
    if (contact.playStoreUrl)
      actions.push({
        href: contact.playStoreUrl,
        kind: 'website',
        label: 'listing.playStore',
        Icon: Download,
      })
    if (contact.appStoreUrl)
      actions.push({
        href: contact.appStoreUrl,
        kind: 'website',
        label: 'listing.appStore',
        Icon: Download,
      })
  }
  if (contact.phone)
    actions.push({
      href: telHref(contact.phone),
      kind: 'call',
      label: 'listing.call',
      Icon: Phone,
      internal: true,
    })
  if (contact.whatsapp)
    actions.push({
      href: whatsappHref(contact.whatsapp),
      kind: 'whatsapp',
      label: 'listing.whatsapp',
      Icon: MessageCircle,
    })
  if (listing.type !== 'APP' && listing.type !== 'HOTLINE' && (listing.location || listing.address))
    actions.push({
      href: directionsHref(listing),
      kind: 'map',
      label: 'listing.directions',
      Icon: Navigation,
    })
  if (contact.website)
    actions.push({ href: contact.website, kind: 'website', label: 'listing.website', Icon: Globe })
  return actions
}

/**
 * The listing's actions. `inline` (tablet and up): a row of buttons, the first one filled.
 * `sticky` (phones): fixed above the bottom bar, up to four compact buttons.
 */
export function ActionBar({ listing, variant = 'inline' }) {
  const actions = actionsFor(listing)
  if (!actions.length) return null

  if (variant === 'sticky') {
    const shown = actions.slice(0, 4)
    return (
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-3 py-2 backdrop-blur sm:hidden">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
        >
          {shown.map(({ href, kind, label, Icon, internal }, i) => (
            <TrackedLink
              key={label}
              businessId={listing.id}
              kind={kind}
              href={href}
              external={!internal}
              className={clsx(
                'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-box text-xs font-semibold',
                i === 0
                  ? 'bg-brand text-brand-contrast'
                  : 'border border-border bg-surface text-text',
              )}
            >
              <Icon aria-hidden="true" className="size-5" />
              <T k={label} />
            </TrackedLink>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="hidden flex-wrap gap-2 sm:flex">
      {actions.map(({ href, kind, label, Icon, internal }, i) => (
        <TrackedLink
          key={label}
          businessId={listing.id}
          kind={kind}
          href={href}
          external={!internal}
          className={clsx(
            'inline-flex min-h-11 items-center justify-center gap-2 rounded-box px-4 font-semibold transition-colors',
            i === 0
              ? 'bg-brand text-brand-contrast hover:opacity-90'
              : 'border border-border bg-surface text-text hover:border-brand/40 hover:text-brand',
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
          <T k={label} />
          {kind === 'call' && listing.type === 'HOTLINE' && ` ${listing.contact.phone}`}
        </TrackedLink>
      ))}
    </div>
  )
}
