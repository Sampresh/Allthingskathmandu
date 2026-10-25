'use client'

import { Languages } from 'lucide-react'
import { setLang, useLang, useT } from '@/hooks/useLang'
import { T } from './T'

export function LanguageToggle() {
  const lang = useLang()
  const t = useT()
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'ne' ? 'en' : 'ne')}
      aria-label={t('common.switchLanguageLabel')}
      className="inline-flex min-h-11 items-center gap-2 rounded-box px-3 text-sm font-semibold text-text hover:bg-surface-raised"
    >
      <Languages aria-hidden="true" className="size-4" />
      <T k="common.switchLanguage" />
    </button>
  )
}
