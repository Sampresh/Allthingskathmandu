import { telHref, whatsappHref } from '@/lib/format'

// One main action per card (Part 4 §4): Download for apps, tap-to-call for hotlines,
// otherwise Call, then WhatsApp, then Website. Text only: cards render in the client bundle
// on results pages, which has a tight size budget (Part 4 §9).
export function mainAction(card) {
  const { contact } = card
  if (card.type === 'APP') {
    const store = contact.playStoreUrl ?? contact.appStoreUrl
    if (store) return { href: store, kind: 'website', label: 'listing.download' }
    if (contact.website) return { href: contact.website, kind: 'website', label: 'listing.website' }
    return null
  }
  if (contact.phone) {
    return {
      href: telHref(contact.phone),
      kind: 'call',
      label: 'listing.call',
      internal: true,
      // Hotlines show the number itself: it is what people need to see.
      number: card.type === 'HOTLINE' ? contact.phone : null,
    }
  }
  if (contact.whatsapp) {
    return {
      href: whatsappHref(contact.whatsapp),
      kind: 'whatsapp',
      label: 'listing.whatsapp',
    }
  }
  if (contact.website) return { href: contact.website, kind: 'website', label: 'listing.website' }
  return null
}
