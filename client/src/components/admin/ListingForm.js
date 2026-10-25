'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HoursEditor } from '@/components/business/HoursEditor'
import { Button } from '@/components/ui/Button'
import { areas, categories, listings, tags } from '@/services/admin.service'
import { ConfirmButton } from './ConfirmButton'
import { Checkbox, SelectField, TextArea, TextField } from './Fields'
import { errorMessage, useToast } from './Toast'

const TYPES = ['BUSINESS', 'APP', 'PLACE', 'HOTLINE']
const STATUSES = ['DRAFT', 'PENDING', 'LIVE', 'SUSPENDED']
const TEXT_FIELDS = [
  'name',
  'nameNe',
  'slug',
  'shortDesc',
  'description',
  'logoUrl',
  'phone',
  'whatsapp',
  'email',
  'website',
  'playStoreUrl',
  'appStoreUrl',
  'address',
  'seoTitle',
  'seoDescription',
]

function initialState(listing) {
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, listing?.[f] ?? ''])),
    type: listing?.type ?? 'BUSINESS',
    status: listing?.status ?? 'DRAFT',
    isVerified: listing?.isVerified ?? false,
    areaId: listing?.areaId ?? '',
    priceLevel: listing?.priceLevel ?? '',
    lat: listing?.location?.lat ?? '',
    lng: listing?.location?.lng ?? '',
    hours: listing?.hours ?? null,
    categoryIds: listing?.categoryIds ?? [],
    tagIds: listing?.tagIds ?? [],
  }
}

/** Form state → API body: blanks become null, numbers are parsed. */
function toBody(state, isNew) {
  const body = {}
  for (const f of TEXT_FIELDS) {
    const value = state[f].trim()
    if (f === 'slug') {
      if (value) body.slug = value
    } else body[f] = value || (isNew && ['name', 'shortDesc'].includes(f) ? '' : null)
  }
  if (isNew) for (const f of TEXT_FIELDS) if (body[f] === null) delete body[f]
  return {
    ...body,
    type: state.type,
    status: state.status,
    isVerified: state.isVerified,
    areaId: state.areaId || null,
    priceLevel: state.priceLevel ? Number(state.priceLevel) : null,
    location:
      state.lat !== '' && state.lng !== ''
        ? { lat: Number(state.lat), lng: Number(state.lng) }
        : null,
    hours: state.hours,
    categoryIds: state.categoryIds,
    tagIds: state.tagIds,
  }
}

export function ListingForm({ listing }) {
  const router = useRouter()
  const toast = useToast()
  const queryClient = useQueryClient()
  const isNew = !listing
  const [state, setState] = useState(() => initialState(listing))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState('')

  const { data: tree } = useQuery({ queryKey: ['admin', 'categories'], queryFn: categories.list })
  const { data: areaList } = useQuery({ queryKey: ['admin', 'areas'], queryFn: areas.list })
  const { data: tagList } = useQuery({ queryKey: ['admin', 'tags'], queryFn: tags.list })

  const set = (patch) => setState((s) => ({ ...s, ...patch }))
  const field = (name) => ({
    value: state[name],
    onChange: (e) => set({ [name]: e.target.value }),
    error: errors[name],
  })

  const toggleCategory = (id) =>
    set({
      categoryIds: state.categoryIds.includes(id)
        ? state.categoryIds.filter((c) => c !== id)
        : [...state.categoryIds, id],
    })
  const tagOptions = (tagList ?? []).filter(
    (t) => !t.categoryId || state.categoryIds.includes(t.categoryId),
  )

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const body = toBody(state, isNew)
      const saved = isNew ? await listings.create(body) : await listings.update(listing.id, body)
      toast(isNew ? 'Listing created' : 'Listing saved')
      queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] })
      if (isNew) router.replace(`/admin/listings/${saved.id}`)
      else setState(initialState(saved))
    } catch (err) {
      setErrors(
        Object.fromEntries((err.details ?? []).map((d) => [d.path.split('.')[0], d.message])),
      )
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await listings.remove(listing.id)
      toast('Listing deleted')
      queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] })
      router.replace('/admin/listings')
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const assignOwner = async () => {
    try {
      const updated = await listings.assignOwner(listing.id, ownerEmail.trim())
      toast(`Owner set to ${updated.owner.email}`)
      setOwnerEmail('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'listing', listing.id] })
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <form onSubmit={save} className="flex max-w-3xl flex-col gap-8" noValidate>
      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Basics</h2>
        <TextField label="Name" required {...field('name')} />
        <TextField label="Name in Nepali" {...field('nameNe')} />
        <SelectField
          label="Type"
          value={state.type}
          onChange={(e) => set({ type: e.target.value })}
        >
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </SelectField>
        <TextField label="Slug" hint="Leave empty to make one from the name" {...field('slug')} />
        <TextArea
          label={`Short description (${state.shortDesc.length}/120)`}
          maxLength={120}
          rows={2}
          className="sm:col-span-2"
          {...field('shortDesc')}
        />
        <TextArea
          label={`Full description (${state.description.length}/600)`}
          maxLength={600}
          rows={5}
          className="sm:col-span-2"
          {...field('description')}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Categories</h2>
        <p className="text-sm text-text-muted">
          The first one ticked is the primary category.{' '}
          {errors.categoryIds && <span className="text-danger">{errors.categoryIds}</span>}
        </p>
        {state.categoryIds.length > 0 && (
          <p className="text-sm">
            Primary:{' '}
            <strong>
              {
                tree?.groups.flatMap((g) => g.children).find((c) => c.id === state.categoryIds[0])
                  ?.nameEn
              }
            </strong>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {tree?.groups.map((group) => (
            <fieldset key={group.id} className="flex flex-col">
              <legend className="font-semibold">{group.nameEn}</legend>
              {group.children.map((c) => (
                <label key={c.id} className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={state.categoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                  />
                  {c.nameEn}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        {tagOptions.length > 0 && (
          <fieldset className="flex flex-wrap gap-x-4">
            <legend className="font-semibold">Tags</legend>
            {tagOptions.map((t) => (
              <label key={t.id} className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={state.tagIds.includes(t.id)}
                  onChange={() =>
                    set({
                      tagIds: state.tagIds.includes(t.id)
                        ? state.tagIds.filter((x) => x !== t.id)
                        : [...state.tagIds, t.id],
                    })
                  }
                />
                {t.nameEn}
              </label>
            ))}
          </fieldset>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Contact</h2>
        <TextField label="Phone" type="tel" {...field('phone')} />
        <TextField label="WhatsApp" type="tel" {...field('whatsapp')} />
        <TextField label="Email" type="email" {...field('email')} />
        <TextField label="Website" type="url" {...field('website')} />
        <TextField label="Play Store link" type="url" {...field('playStoreUrl')} />
        <TextField label="App Store link" type="url" {...field('appStoreUrl')} />
        <TextField
          label="Logo (Cloudinary URL)"
          type="url"
          className="sm:col-span-2"
          {...field('logoUrl')}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Location</h2>
        <SelectField
          label="Area"
          value={state.areaId}
          onChange={(e) => set({ areaId: e.target.value })}
        >
          <option value="">No area (app or hotline)</option>
          {areaList?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameEn}
            </option>
          ))}
        </SelectField>
        <TextField label="Address" {...field('address')} />
        <TextField
          label="Latitude"
          type="number"
          step="any"
          {...field('lat')}
          error={errors.location}
        />
        <TextField label="Longitude" type="number" step="any" {...field('lng')} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Opening hours (Nepal time)</h2>
        <HoursEditor value={state.hours} onChange={(hours) => set({ hours })} />
        {errors.hours && <p className="text-sm text-danger">{errors.hours}</p>}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Publishing</h2>
        <SelectField
          label="Status"
          value={state.status}
          onChange={(e) => set({ status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <SelectField
          label="Price level"
          value={state.priceLevel}
          onChange={(e) => set({ priceLevel: e.target.value })}
        >
          <option value="">Not set</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {'Rs '.repeat(n).trim()}
            </option>
          ))}
        </SelectField>
        <Checkbox
          label="Verified"
          checked={state.isVerified}
          onChange={(e) => set({ isVerified: e.target.checked })}
        />
        <TextField
          label="SEO title"
          maxLength={70}
          className="sm:col-span-2"
          {...field('seoTitle')}
        />
        <TextArea
          label="SEO description"
          maxLength={160}
          rows={2}
          className="sm:col-span-2"
          {...field('seoDescription')}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={saving}>
          {isNew ? 'Create listing' : 'Save changes'}
        </Button>
        {!isNew && listing.status === 'LIVE' && (
          <Button href={`/listing/${listing.slug}`} variant="secondary" target="_blank">
            View on site
          </Button>
        )}
        {!isNew && (
          <ConfirmButton
            title="Delete listing"
            message={`Delete ${listing.name}? It disappears from the site.`}
            confirmLabel="Delete"
            onConfirm={remove}
          >
            Delete
          </ConfirmButton>
        )}
      </div>

      {!isNew && (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-lg font-semibold">Owner</h2>
          <p className="text-sm">
            {listing.owner ? `${listing.owner.name} (${listing.owner.email})` : 'No owner yet.'}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              label="Give this listing to (email)"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="min-w-72"
            />
            <Button variant="secondary" onClick={assignOwner} disabled={!ownerEmail.trim()}>
              Assign owner
            </Button>
          </div>
        </section>
      )}
    </form>
  )
}
