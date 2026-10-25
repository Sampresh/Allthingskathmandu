import { BottomBar } from '@/components/common/BottomBar'
import { Footer } from '@/components/common/Footer'
import { Header } from '@/components/common/Header'
import { OfflineNotice } from '@/components/common/OfflineNotice'
import { publicGet } from '@/lib/serverApi'

export default async function PublicLayout({ children }) {
  const settings = await publicGet('/settings', { tags: ['settings'] })
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineNotice />
      <Header />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <Footer settings={settings?.data} />
      <BottomBar />
    </div>
  )
}
