'use client'

import { useId, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { AccountT as T } from '@/components/common/AccountT'
import { FormError } from '@/components/common/FormStatus'
import { Button } from '@/components/ui/Button'
import { CloudImage } from '@/components/ui/CloudImage'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Uploader } from '@/components/ui/Uploader'
import { allAccountMessages, useAccountT } from '@/hooks/useAccountT'
import {
  areas as fetchAreas,
  createMarketItem,
  marketCategories,
  signMarketPhoto,
  updateMarketItem,
} from '@/services/member.service'

const MAX_PHOTOS = 6
const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']

const fromItem = (item, phone) => ({
  title: item?.title ?? '',
  categoryId: item?.categoryId ?? '',
  condition: item?.condition ?? '',
  priceNpr: item ? String(item.priceNpr) : '',
  isNegotiable: item?.isNegotiable ?? false,
  areaId: item?.areaId ?? '',
  description: item?.description ?? '',
  contactPhone: item?.contactPhone ?? phone ?? '',
  contactWhatsapp: item?.contactWhatsapp ?? '',
})

/**
 * New item or an edit (any edit goes back to moderation). Photos upload straight to
 * Cloudinary with alt text; the API checks each one when the item is saved.
 */
export function MarketItemForm({ item, phone, onDone }) {
  const id = useId()
  const t = useAccountT()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => fromItem(item, phone))
  const [photos, setPhotos] = useState(item?.photos ?? [])
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const categories = useQuery({ queryKey: ['market', 'categories'], queryFn: marketCategories })
  const areaList = useQuery({ queryKey: ['public', 'areas'], queryFn: fetchAreas })
  const set = (key) => (e) =>
    setValues((v) => ({
      ...v,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))
  const name = (row) => row.nameEn

  const validate = () => {
    const next = {}
    if (values.title.trim().length < 3) next.title = 'v.title'
    if (!values.categoryId) next.categoryId = 'v.pick'
    if (!values.condition) next.condition = 'v.pick'
    if (!/^\d{1,8}$/.test(values.priceNpr)) next.priceNpr = 'v.price'
    if (!values.contactPhone.trim() && !values.contactWhatsapp.trim())
      next.contactPhone = 'v.contact'
    return next
  }

  const submit = async (e) => {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    setError(null)
    const body = {
      title: values.title.trim(),
      categoryId: values.categoryId,
      condition: values.condition,
      priceNpr: Number(values.priceNpr),
      isNegotiable: values.isNegotiable,
      areaId: values.areaId || null,
      description: values.description.trim() || null,
      contactPhone: values.contactPhone.trim() || null,
      contactWhatsapp: values.contactWhatsapp.trim() || null,
      photos: photos.map(({ publicId, altText }) => ({ publicId, altText })),
    }
    try {
      if (item) await updateMarketItem(item.id, body)
      else await createMarketItem(body)
      queryClient.invalidateQueries({ queryKey: ['account', 'market'] })
      onDone()
    } catch (err) {
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
      <Input
        label={<T k="market.form.title" />}
        value={values.title}
        maxLength={100}
        onChange={set('title')}
        error={fieldError('title')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Select
            label={<T k="market.form.category" />}
            value={values.categoryId}
            onChange={set('categoryId')}
            aria-invalid={errors.categoryId ? true : undefined}
          >
            <option value="">{t('market.form.pick')}</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {name(c)}
              </option>
            ))}
          </Select>
          {errors.categoryId && <p className="text-sm text-danger">{fieldError('categoryId')}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Select
            label={<T k="market.form.condition" />}
            value={values.condition}
            onChange={set('condition')}
            aria-invalid={errors.condition ? true : undefined}
          >
            <option value="">{t('market.form.pick')}</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {t(`market.condition.${c}`)}
              </option>
            ))}
          </Select>
          {errors.condition && <p className="text-sm text-danger">{fieldError('condition')}</p>}
        </div>
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <Input
          label={<T k="market.form.price" />}
          inputMode="numeric"
          value={values.priceNpr}
          onChange={set('priceNpr')}
          error={fieldError('priceNpr')}
        />
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={values.isNegotiable}
            onChange={set('isNegotiable')}
            className="size-5"
          />
          <T k="market.form.negotiable" />
        </label>
      </div>
      <Select label={<T k="market.form.area" />} value={values.areaId} onChange={set('areaId')}>
        <option value="">{t('market.form.noArea')}</option>
        {areaList.data?.map((a) => (
          <option key={a.id} value={a.id}>
            {name(a)}
          </option>
        ))}
      </Select>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-description`} className="text-sm font-semibold">
          <T k="market.form.description" />
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
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm text-text-muted">
          <T k="market.form.contactHint" />
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={<T k="market.form.phone" />}
            type="tel"
            value={values.contactPhone}
            onChange={set('contactPhone')}
            error={fieldError('contactPhone')}
          />
          <Input
            label={<T k="market.form.whatsapp" />}
            type="tel"
            value={values.contactWhatsapp}
            onChange={set('contactWhatsapp')}
            error={fieldError('contactWhatsapp')}
          />
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">
          <T k="market.form.photos" />
        </legend>
        {photos.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <li key={photo.publicId} className="flex flex-col gap-1 text-sm">
                {photo.url ? (
                  <CloudImage
                    src={photo.url}
                    alt={photo.altText}
                    width={240}
                    height={180}
                    widths={[240, 480]}
                    sizes="240px"
                    className="aspect-[4/3] w-full rounded-box object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-box bg-surface-raised p-2 text-center text-text-muted">
                    ✓ {photo.altText}
                  </div>
                )}
                <Button
                  variant="ghost"
                  onClick={() => setPhotos((list) => list.filter((p) => p !== photo))}
                >
                  <X aria-hidden="true" className="size-4" />
                  <T k="market.form.removePhoto" />
                  <span className="sr-only">: {photo.altText}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_PHOTOS && (
          <Uploader
            label={<T k="market.form.addPhoto" />}
            sign={signMarketPhoto}
            requireAlt
            altLabel={<T k="upload.alt" />}
            buttonLabel={<T k="upload.button" />}
            onUploaded={({ publicId, altText }) =>
              setPhotos((list) => [...list, { publicId, altText }])
            }
          />
        )}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>
          <T k="market.form.submit" />
        </Button>
        <Button variant="secondary" onClick={onDone}>
          <T k="account.cancel" />
        </Button>
      </div>
    </form>
  )
}
