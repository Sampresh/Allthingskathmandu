'use client'

import { useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { FormError, FormSuccess } from '@/components/common/FormStatus'
import { T } from '@/components/common/T'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useLang, useT } from '@/hooks/useLang'
import { sendReport } from '@/services/public.service'

const REASONS = [
  'closed',
  'wrong_contact',
  'wrong_location',
  'wrong_hours',
  'wrong_details',
  'inappropriate',
  'spam',
  'other',
]
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

/** The report form itself; loaded only when the dialog is first opened. */
export default function ReportForm({ entityType, entityId }) {
  const t = useT()
  const lang = useLang()
  const [reason, setReason] = useState('wrong_contact')
  const [details, setDetails] = useState('')
  const [turnstileToken, setTurnstileToken] = useState()
  const [state, setState] = useState('idle') // idle | sending | done
  const [error, setError] = useState(null)
  const [detailsMissing, setDetailsMissing] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (reason === 'other' && !details.trim()) {
      setDetailsMissing(true)
      return
    }
    setDetailsMissing(false)
    setError(null)
    setState('sending')
    try {
      await sendReport({
        entityType,
        entityId,
        reason,
        details: details.trim() || undefined,
        turnstileToken,
      })
      setState('done')
    } catch (err) {
      setError(err)
      setState('idle')
    }
  }

  if (state === 'done') return <FormSuccess k="report.done" />

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FormError error={error} />
      <Select
        label={<T k="report.reason" />}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      >
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {t(`report.reason.${r}`)}
          </option>
        ))}
      </Select>
      <div className="flex flex-col gap-1">
        <label htmlFor="report-details" className="text-sm font-semibold">
          <T k="report.details" />
        </label>
        <textarea
          id="report-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={4}
          aria-invalid={detailsMissing || undefined}
          aria-describedby={detailsMissing ? 'report-details-error' : undefined}
          className="rounded-box border border-text-muted bg-surface p-3 text-base"
        />
        {detailsMissing && (
          <p id="report-details-error" className="text-sm text-danger">
            <T k="v.reportDetails" />
          </p>
        )}
      </div>
      {TURNSTILE_SITE_KEY && (
        <Turnstile
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(undefined)}
          options={{ language: lang, size: 'flexible' }}
        />
      )}
      <Button
        type="submit"
        loading={state === 'sending'}
        disabled={Boolean(TURNSTILE_SITE_KEY) && !turnstileToken}
        fullWidth
      >
        <T k="report.submit" />
      </Button>
    </form>
  )
}
