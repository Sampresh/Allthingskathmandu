'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'
import { useLang } from '@/hooks/useLang'

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

/** Google Identity Services button. Renders nothing when Google sign-in is not configured. */
export function GoogleSignInButton({ onCredential }) {
  const container = useRef(null)
  const callback = useRef(onCredential)
  const lang = useLang()

  useEffect(() => {
    callback.current = onCredential
  }, [onCredential])

  const render = () => {
    const google = window.google?.accounts?.id
    if (!google || !container.current) return
    google.initialize({
      client_id: CLIENT_ID,
      callback: (response) => callback.current(response.credential),
    })
    container.current.replaceChildren()
    google.renderButton(container.current, {
      theme: 'outline',
      size: 'large',
      width: container.current.offsetWidth || 320,
      text: 'continue_with',
      locale: lang,
    })
  }

  useEffect(render, [lang]) // re-render the button in the new language

  if (!CLIENT_ID) return null
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" onLoad={render} />
      <div ref={container} className="flex min-h-11 justify-center" />
    </>
  )
}
