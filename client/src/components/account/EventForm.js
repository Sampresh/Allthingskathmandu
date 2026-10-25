'use client'

import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AccountT as T } from '@/components/common/AccountT'
import { FormError, FormSuccess } from '@/components/common/FormStatus'
import { LocationPicker } from '@/components/map/LocationPicker'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Uploader } from '@/components/ui/Uploader'
import { allAccountMessages, useAccountT } from '@/hooks/useAccountT'
import { isoToNepalInput, nepalInputToIso } from '@/lib/dates'
import { areas as fetchAreas } from '@/services/member.service'

const URL_RE = /^https?:\/\/\S+$/
// The picker allows half-typed coordinates; only a complete pin is sent.
const completePin = (p) =>
  Number.isFinite(p?.lat) && Number.isFinite(p?.lng) ? { lat: p.lat, lng: p.lng } : null

const fromEvent = (e) => ({
  title: e?.title ?? '',
  description: e?.description ?? '',
  startsAt: isoToNepalInput(e?.startsAt),
  endsAt: isoToNepalInput(e?.endsAt),
  venue: e?.venue ?? '',
  areaId: e?.areaId ?? '',
  ticketUrl: e?.ticketUrl ?? '',
  location: e?.location ?? null,
})

/**
 * Event details (Part 5 events). Members and owners submit for moderation; Admin edits with
 * `allowPast`. Times are entered and shown in Kathmandu time whatever the device's zone.
 * `onSubmit(body)` sends it; `signCover` (submissions only) enables the cover upload.
 */
export function EventForm({ event, onSubmit, signCover, allowPast = false, submitKey }) {
  const id = useId()
  const t = useAccountT()
  const [values, setValues] = useState(() => fromEvent(event))
  const [cover, setCover] = useState(null)
  // An edit only sends the map pin when it was changed (the list has no coordinates).
  const [pinTouched, setPinTouched] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const areaList = useQuery({ queryKey: ['public', 'areas'], queryFn: fetchAreas })
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))

  if (done && !allowPast) {
    return (
      <FormSuccess>
        <T k="events.form.done" />
      </FormSuccess>
    )
  }

  const validate = () => {
    const next = {}
    if (values.title.trim().length < 3) next.title = 'v.title'
    const start = values.startsAt && new Date(nepalInputToIso(values.startsAt))
    if (!start || (!allowPast && start <= new Date())) next.startsAt = 'v.startsAt'
    if (values.endsAt && start && new Date(nepalInputToIso(values.endsAt)) < start)
      next.endsAt = 'v.endsAt'
    if (values.ticketUrl && !URL_RE.test(values.ticketUrl.trim())) next.ticketUrl = 'v.url'
    return next
  }

  const submit = async (e) => {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        title: values.title.trim(),
        description: values.description.trim() || null,
        startsAt: nepalInputToIso(values.startsAt),
        endsAt: nepalInputToIso(values.endsAt),
        venue: values.venue.trim() || null,
        areaId: values.areaId || null,
        ticketUrl: values.ticketUrl.trim() || null,
        ...((!event || pinTouched) && { location: completePin(values.location) }),
        ...(signCover && { coverPublicId: cover }),
      })
      setDone(true)
    } catch (err) {
      // Field errors from the API (Zod paths) show next to their fields.
      const fields = Object.fromEntries((err.details ?? []).map((d) => [d.path, d.message]))
      if (Object.keys(fields).length) setErrors(fields)
      else setError(err)
    } finally {
      setBusy(false)
    }
  }

  const fieldError = (key) =>
    errors[key] && (errors[key].startsWith('v.') ? <T k={errors[key]} /> : errors[key])

  return (
    <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-4">
      <FormError error={error} messages={allAccountMessages} />
      {done && (
        <FormSuccess>
          <T k="account.savedChanges" />
        </FormSuccess>
      )}
      <Input
        label={<T k="events.form.title" />}
        value={values.title}
        maxLength={120}
        onChange={set('title')}
        error={fieldError('title')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={<T k="events.form.startsAt" />}
          type="datetime-local"
          value={values.startsAt}
          onChange={set('startsAt')}
          error={fieldError('startsAt')}
        />
        <Input
          label={<T k="events.form.endsAt" />}
          type="datetime-local"
          value={values.endsAt}
          onChange={set('endsAt')}
          error={fieldError('endsAt')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={<T k="events.form.venue" />}
          value={values.venue}
          maxLength={120}
          onChange={set('venue')}
          error={fieldError('venue')}
        />
        <Select label={<T k="events.form.area" />} value={values.areaId} onChange={set('areaId')}>
          <option value="">{t('market.form.noArea')}</option>
          {areaList.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameEn}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label={<T k="events.form.ticketUrl" />}
        type="url"
        inputMode="url"
        value={values.ticketUrl}
        onChange={set('ticketUrl')}
        error={fieldError('ticketUrl')}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-description`} className="text-sm font-semibold">
          <T k="events.form.description" />
        </label>
        <textarea
          id={`${id}-description`}
          value={values.description}
          maxLength={1000}
          rows={5}
          onChange={set('description')}
          className="rounded-box border border-text-muted bg-surface px-3 py-2 text-base text-text"
        />
      </div>
      {signCover &&
        (cover ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">
              <T k="events.form.cover" />: ✓
            </span>
            <Button variant="ghost" onClick={() => setCover(null)}>
              <T k="market.form.removePhoto" />
            </Button>
          </div>
        ) : (
          <Uploader
            label={<T k="events.form.cover" />}
            sign={signCover}
            onUploaded={({ publicId }) => setCover(publicId)}
            buttonLabel={<T k="upload.button" />}
          />
        ))}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">
          <T k="events.form.location" />
        </legend>
        <LocationPicker
          value={values.location}
          onChange={(location) => {
            setPinTouched(true)
            setValues((v) => ({ ...v, location }))
          }}
          hint={<T k="events.form.locationHint" />}
        />
      </fieldset>
      <Button type="submit" loading={busy} className="self-start">
        <T k={submitKey ?? 'events.form.submit'} />
      </Button>
    </form>
  )
}
