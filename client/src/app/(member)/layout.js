import { BottomBar } from '@/components/common/BottomBar'
import { Footer } from '@/components/common/Footer'
import { Header } from '@/components/common/Header'
import { OfflineNotice } from '@/components/common/OfflineNotice'
import { publicGet } from '@/lib/serverApi'

export const metadata = {
  title: { default: 'Your account', template: '%s · Your account' },
  robots: { index: false, follow: false },
}

/** Member area (Part 4 §3): the public header, footer and bottom bar around /account. */
export default async function MemberLayout({ children }) {
  const settings = await publicGet('/settings', { tags: ['settings'] })
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineNotice />
      <Header />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        {children}
      </main>
      <Footer settings={settings?.data} />
      <BottomBar />
    </div>
  )
}
