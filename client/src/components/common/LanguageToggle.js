'use client'

import { Languages } from 'lucide-react'
import { setLang, useLang } from '@/hooks/useLang'

/**
 * Switches between English and Nepali. The visible label is the other language's own name,
 * marked with its language so screen readers pronounce it correctly; it is also the
 * button's accessible name (WCAG 2.5.3).
 */
export function LanguageToggle() {
  const lang = useLang()
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'ne' ? 'en' : 'ne')}
      className="inline-flex min-h-11 items-center gap-2 rounded-box px-3 text-sm font-semibold text-text hover:bg-surface-raised"
    >
      <Languages aria-hidden="true" className="hidden size-4 sm:block" />
      <span className="i18n-en" lang="ne">
        नेपाली
      </span>
      <span className="i18n-ne" lang="en">
        English
      </span>
    </button>
  )
}
