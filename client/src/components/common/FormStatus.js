import { CircleAlert, CircleCheck } from 'lucide-react'
import { errorText } from '@/lib/i18n'
import { T } from './T'

/** Error from a failed API call, announced to screen readers. */
export function FormError({ error, children }) {
  if (!error) return null
  const text = errorText(error)
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-box border border-danger p-3 text-sm text-danger"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        <T en={text.en} ne={text.ne} />
        {children}
      </div>
    </div>
  )
}

export function FormSuccess({ k, children }) {
  return (
    <div
      role="status"
      className="flex gap-2 rounded-box border border-success p-3 text-sm text-success"
    >
      <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        {k && <T k={k} />}
        {children}
      </div>
    </div>
  )
}
