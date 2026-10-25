'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleUserRound } from 'lucide-react'
import { T } from '@/components/common/T'
import { useT } from '@/hooks/useLang'
import { homeFor } from '@/lib/authRoutes'
import { useAuthStore } from '@/store/authStore'

/** "Log in", or the signed-in person's menu (their area and Log out). */
export function AccountMenu({ compact = false }) {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const escape = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  if (!user) {
    return compact ? (
      <Link
        href="/login"
        aria-label={t('nav.login')}
        className="inline-flex size-11 items-center justify-center rounded-box hover:bg-surface-raised"
      >
        <CircleUserRound aria-hidden="true" className="size-6" />
      </Link>
    ) : (
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center rounded-box px-3 font-semibold hover:bg-surface-raised"
      >
        <T k="nav.login" />
      </Link>
    )
  }

  const area = homeFor(user)
  const areaLabel = area.startsWith('/admin')
    ? 'nav.admin'
    : area.startsWith('/business')
      ? 'nav.dashboard'
      : 'nav.account'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('nav.account')}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-box px-3 font-semibold hover:bg-surface-raised"
      >
        <CircleUserRound aria-hidden="true" className="size-6" />
        {!compact && <span className="max-w-32 truncate">{user.name.split(/\s+/)[0]}</span>}
      </button>
      {open && (
        <ul className="absolute right-0 z-40 mt-1 min-w-48 rounded-box border border-border bg-surface py-1 shadow-overlay">
          <li>
            <Link
              href={area}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center px-4 hover:bg-surface-raised"
            >
              <T k={areaLabel} />
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={async () => {
                setOpen(false)
                const { logout } = await import('@/services/auth.service')
                await logout().catch(() => {})
                router.refresh()
              }}
              className="flex min-h-11 w-full items-center px-4 text-left hover:bg-surface-raised"
            >
              <T k="nav.logout" />
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
