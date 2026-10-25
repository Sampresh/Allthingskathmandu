'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { useT } from '@/hooks/useLang'

/**
 * Modal built on <dialog>: focus moves in and back, Escape closes, background is inert.
 * `variant="sheet"` docks to the bottom on small screens (mobile filters).
 */
export function Dialog({ open, onClose, title, variant = 'dialog', children, footer }) {
  const ref = useRef(null)
  const t = useT()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={typeof title === 'string' ? title : undefined}
      className={clsx(
        'm-auto w-full max-w-lg rounded-box border border-border bg-surface p-0 text-text shadow-overlay backdrop:bg-[rgb(0_0_0/0.5)]',
        variant === 'sheet' &&
          'mb-0 max-w-none rounded-b-none sm:mb-auto sm:max-w-lg sm:rounded-b-box',
      )}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="inline-flex size-11 items-center justify-center rounded-box hover:bg-surface-raised"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-border p-4">{footer}</div>}
      </div>
    </dialog>
  )
}
