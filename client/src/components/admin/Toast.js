'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { clsx } from 'clsx'

const ToastContext = createContext(() => {})

/** Short confirmations and errors, announced politely to screen readers. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const show = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((list) => [...list, { id, message, tone }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <p
            key={t.id}
            className={clsx(
              'rounded-box border bg-surface px-4 py-3 text-sm shadow-overlay',
              t.tone === 'error' ? 'border-danger text-danger' : 'border-success text-success',
            )}
          >
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

/** Message for a failed admin API call. */
export const errorMessage = (error) =>
  error?.details?.length
    ? error.details.map((d) => `${d.path || 'value'}: ${d.message}`).join('; ')
    : error?.message || 'Something went wrong'
