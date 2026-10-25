'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useLang, useT } from '@/hooks/useLang'
import { Button } from '@/components/ui/Button'
import { FormError, FormSuccess } from './FormStatus'
import { T } from './T'

const Turnstile = dynamic(() => import('@marsidev/react-turnstile').then((m) => m.Turnstile), {
  ssr: false,
})
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

const field = 'rounded-box border border-text-muted bg-surface px-3 text-base'

/** Contact form (Turnstile when configured); the message is emailed via the API's queue. */
export function ContactForm() {
  const t = useT()
  const lang = useLang()
  const [values, setValues] = useState({ name: '', email: '', message: '' })
  const [turnstileToken, setTurnstileToken] = useState()
  const [state, setState] = useState('idle')
  const [error, setError] = useState(null)
  const [tooShort, setTooShort] = useState(false)
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    if (values.message.trim().length < 10) return setTooShort(true)
    setTooShort(false)
    setError(null)
    setState('sending')
    try {
      const { sendContact } = await import('@/services/public.service')
      await sendContact({ ...values, turnstileToken })
      setState('done')
    } catch (err) {
      setError(err)
      setState('idle')
    }
  }

  if (state === 'done') return <FormSuccess k="contact.done" />

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FormError error={error} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <T k="contact.name" />
        <input
          required
          maxLength={100}
          autoComplete="name"
          value={values.name}
          onChange={set('name')}
          className={`${field} min-h-11`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <T k="contact.email" />
        <input
          required
          type="email"
          maxLength={254}
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          className={`${field} min-h-11`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        <T k="contact.message" />
        <textarea
          required
          rows={6}
          maxLength={2000}
          value={values.message}
          onChange={set('message')}
          aria-invalid={tooShort || undefined}
          aria-describedby={tooShort ? 'contact-message-error' : undefined}
          className={`${field} py-2`}
        />
        {tooShort && (
          <span id="contact-message-error" className="font-normal text-danger">
            {t('v.messageMin')}
          </span>
        )}
      </label>
      {TURNSTILE_SITE_KEY && (
        <Turnstile
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(undefined)}
          options={{ language: lang, size: 'flexible' }}
        />
      )}
      <div>
        <Button
          type="submit"
          loading={state === 'sending'}
          disabled={Boolean(TURNSTILE_SITE_KEY) && !turnstileToken}
        >
          <T k="contact.submit" />
        </Button>
      </div>
    </form>
  )
}
