'use client'

import { track } from '@/services/track.service'

/** External action link that counts a call / WhatsApp / map / website click. */
export function TrackedLink({ businessId, kind, href, external = true, children, ...props }) {
  return (
    <a
      href={href}
      onClick={() => track(businessId, kind)}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
      {...props}
    >
      {children}
    </a>
  )
}
