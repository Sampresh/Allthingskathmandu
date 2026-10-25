import Link from 'next/link'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { T } from '@/components/common/T'

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-raised">
      <header className="flex items-center justify-between gap-4 px-4 py-2">
        <Link href="/" className="inline-flex min-h-11 items-center text-lg font-semibold">
          <T k="site.name" />
        </Link>
        <LanguageToggle />
      </header>
      <main id="main" className="flex flex-1 justify-center px-4 py-6 sm:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
