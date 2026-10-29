import '@/styles/globals.css'
import { Fraunces, Source_Sans_3 } from 'next/font/google'
import { SITE_NAME, SITE_URL } from '@/lib/site'
import { ERROR_BUFFER_SCRIPT } from '@/lib/errorBuffer'
import { LANG_COOKIE } from '@/lib/i18n'
import { Providers } from './providers'

// Self-hosted at build time (no request to Google from the browser). Headings use one
// static weight of Fraunces; body text the Source Sans 3 variable font.
const heading = Fraunces({
  subsets: ['latin'],
  weight: '600',
  display: 'swap',
  variable: '--font-heading',
})
const body = Source_Sans_3({ subsets: ['latin'], display: 'swap', variable: '--font-body' })

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description:
    'Compare local businesses, services, places and apps across Kathmandu Valley, then call, message or get directions in one tap.',
  applicationName: SITE_NAME,
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#15120f' },
  ],
}

// Applies the saved language before first paint, so cached English-default HTML never
// flashes the wrong language.
const LANG_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${LANG_COOKIE}=(ne|en)(?:;|$)/);var l=m?m[1]:'en';var d=document.documentElement;d.dataset.lang=l;d.lang=l}catch(e){}})()`

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-lang="en"
      className={`${heading.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} />
        {ERROR_BUFFER_SCRIPT && (
          <script dangerouslySetInnerHTML={{ __html: ERROR_BUFFER_SCRIPT }} />
        )}
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-box focus:bg-surface focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
