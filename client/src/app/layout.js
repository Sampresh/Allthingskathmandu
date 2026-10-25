import '@/styles/globals.css'
import { SITE_NAME, SITE_URL } from '@/lib/site'
import { LANG_COOKIE } from '@/lib/i18n'
import { Providers } from './providers'

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
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1216' },
  ],
}

// Applies the saved language before first paint, so cached English-default HTML never
// flashes the wrong language.
const LANG_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${LANG_COOKIE}=(ne|en)(?:;|$)/);var l=m?m[1]:'en';var d=document.documentElement;d.dataset.lang=l;d.lang=l}catch(e){}})()`

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} />
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
