import { Download, Globe, MessageCircle, Navigation, Phone } from 'lucide-react'
import { ST as T } from '@/components/common/ST'
import { directionsHref, telHref, whatsappHref } from '@/lib/format'
import { TrackedLink } from './TrackedLink'

const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-box px-4 font-semibold'

/** Call, WhatsApp, Directions, Website (apps: Play Store and App Store). Full width on mobile. */
export function ActionBar({ listing }) {
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
  if (listing.type !== 'APP' && listing.type !== 'HOTLINE') {
    actions.push({
      href: directionsHref(listing),
      kind: 'map',
      label: 'listing.directions',
      Icon: Navigation,
    })
  }
  if (contact.website)
    actions.push({ href: contact.website, kind: 'website', label: 'listing.website', Icon: Globe })

  if (!actions.length) return null
  return (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
      {actions.map(({ href, kind, label, Icon, internal }, i) => (
        <TrackedLink
          key={label}
          businessId={listing.id}
          kind={kind}
          href={href}
          external={!internal}
          className={
            i === 0
              ? `${buttonClass} bg-brand text-brand-contrast hover:opacity-90`
              : `${buttonClass} border border-border bg-surface text-text hover:bg-surface-raised`
          }
        >
          <Icon aria-hidden="true" className="size-5" />
          <T k={label} />
        </TrackedLink>
      ))}
    </div>
  )
}
