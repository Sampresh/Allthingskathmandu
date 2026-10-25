'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SelectField, TextArea, TextField } from '@/components/admin/Fields'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { HoursEditor } from '@/components/business/HoursEditor'
import { LocationPicker } from '@/components/map/LocationPicker'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Uploader } from '@/components/ui/Uploader'
import { useBusinessListing } from '@/hooks/useBusinessListing'
import {
  getListing,
  publicAreas,
  publicGroups,
  putHours,
  putLocation,
  signLogo,
  updateListing,
} from '@/services/business.service'

const FIELDS = [
  'name',
  'nameNe',
  'shortDesc',
  'description',
  'phone',
  'whatsapp',
  'email',
  'website',
  'playStoreUrl',
  'appStoreUrl',
]

function Details({ listing, onSaved }) {
  const toast = useToast()
  const { data: groups } = useQuery({ queryKey: ['public', 'groups'], queryFn: publicGroups })
  const [form, setForm] = useState(() => ({
    ...Object.fromEntries(FIELDS.map((f) => [f, listing[f] ?? ''])),
    priceLevel: listing.priceLevel ?? '',
    categoryId: listing.categoryIds[0] ?? '',
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
    error: errors[name],
  })

  // The owner picks the primary category; other categories set by Admin are kept.
  const categoryIds = form.categoryId
    ? [form.categoryId, ...listing.categoryIds.filter((id) => id !== form.categoryId)]
    : listing.categoryIds

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await updateListing(listing.id, {
        ...Object.fromEntries(
          FIELDS.map((f) => [
            f,
            form[f].trim() || (['name', 'shortDesc'].includes(f) ? form[f].trim() : null),
          ]),
        ),
        priceLevel: form.priceLevel ? Number(form.priceLevel) : null,
        categoryIds,
      })
      toast('Saved. The public page updates within a minute.')
      onSaved()
    } catch (err) {
      setErrors(
        Object.fromEntries((err.details ?? []).map((d) => [d.path.split('.')[0], d.message])),
      )
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
      <TextField label="Business name" {...field('name')} />
      <TextField label="Name in Nepali" {...field('nameNe')} />
      <TextArea
        label={`One-line description (${form.shortDesc.length}/120)`}
        maxLength={120}
        rows={2}
        className="sm:col-span-2"
        {...field('shortDesc')}
      />
      <TextArea
        label={`About (${form.description.length}/600)`}
        maxLength={600}
        rows={5}
        className="sm:col-span-2"
        {...field('description')}
      />
      <SelectField
        label="Main category"
        value={form.categoryId}
        onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
      >
        {groups?.map((g) => (
          <optgroup key={g.id} label={g.nameEn}>
            {g.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </optgroup>
        ))}
        {/* Keep the current category even if it is not public yet. */}
        {!groups?.some((g) => g.categories.some((c) => c.id === form.categoryId)) &&
          form.categoryId && (
            <option value={form.categoryId}>{listing.categories[0]?.category.nameEn}</option>
          )}
      </SelectField>
      <SelectField
        label="Price level"
        value={form.priceLevel}
        onChange={(e) => setForm((f) => ({ ...f, priceLevel: e.target.value }))}
      >
        <option value="">Not set</option>
        {[1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>
            {'Rs '.repeat(n).trim()}
          </option>
        ))}
      </SelectField>
      <TextField label="Phone" type="tel" {...field('phone')} />
      <TextField label="WhatsApp" type="tel" {...field('whatsapp')} />
      <TextField label="Email" type="email" {...field('email')} />
      <TextField label="Website" type="url" {...field('website')} />
      {listing.type === 'APP' && (
        <>
          <TextField label="Play Store link" type="url" {...field('playStoreUrl')} />
          <TextField label="App Store link" type="url" {...field('appStoreUrl')} />
        </>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" loading={saving}>
          Save details
        </Button>
      </div>
    </form>
  )
}

function Logo({ listing, onSaved }) {
  const toast = useToast()
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Logo</h2>
      <div className="flex items-center gap-4">
        <Avatar src={listing.logoUrl} name={listing.name} alt={`${listing.name} logo`} size={72} />
        {listing.logoUrl && (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await updateListing(listing.id, { logoPublicId: null })
                onSaved()
              } catch (err) {
                toast(errorMessage(err), 'error')
              }
            }}
          >
            Remove logo
          </Button>
        )}
      </div>
      <Uploader
        label="Upload a square logo (JPG, PNG or WebP, up to 2 MB)"
        sign={() => signLogo(listing.id)}
        onUploaded={async ({ publicId }) => {
          await updateListing(listing.id, { logoPublicId: publicId })
          toast('Logo updated')
          onSaved()
        }}
      />
    </section>
  )
}

function Hours({ listing, onSaved }) {
  const toast = useToast()
  const [hours, setHours] = useState(listing.hours)
  const [saving, setSaving] = useState(false)
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Opening hours (Nepal time)</h2>
      <HoursEditor value={hours} onChange={setHours} />
      <div>
        <Button
          loading={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await putHours(listing.id, hours)
              toast('Hours saved')
              onSaved()
            } catch (err) {
              toast(errorMessage(err), 'error')
            } finally {
              setSaving(false)
            }
          }}
        >
          Save hours
        </Button>
      </div>
    </section>
  )
}

function Location({ listing, onSaved }) {
  const toast = useToast()
  const { data: areas } = useQuery({ queryKey: ['public', 'areas'], queryFn: publicAreas })
  const [point, setPoint] = useState(listing.location)
  const [address, setAddress] = useState(listing.address ?? '')
  const [areaId, setAreaId] = useState(listing.areaId ?? '')
  const ready = point && point.lat !== '' && point.lng !== ''
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Location</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Choose…</option>
          {areas?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameEn}
            </option>
          ))}
        </SelectField>
        <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <LocationPicker value={point} onChange={setPoint} />
      <div>
        <Button
          disabled={!ready}
          onClick={async () => {
            try {
              await putLocation(listing.id, {
                lat: Number(point.lat),
                lng: Number(point.lng),
                address: address.trim() || null,
                areaId: areaId || null,
              })
              toast('Location saved')
              onSaved()
            } catch (err) {
              toast(errorMessage(err), 'error')
            }
          }}
        >
          Save location
        </Button>
      </div>
    </section>
  )
}

export default function ListingDetailsPage() {
  const queryClient = useQueryClient()
  const { listingId } = useBusinessListing()
  const { data, isPending } = useQuery({
    queryKey: ['business', 'listing', listingId],
    queryFn: () => getListing(listingId),
    enabled: Boolean(listingId),
  })
  if (isPending) return <Skeleton className="h-96 w-full" />
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['business'] })
  }
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <h1 className="text-2xl font-semibold">Listing details</h1>
      <Details key={`d-${data.updatedAt}`} listing={data} onSaved={refresh} />
      <Logo listing={data} onSaved={refresh} />
      <Hours key={`h-${data.updatedAt}`} listing={data} onSaved={refresh} />
      <Location key={`l-${data.updatedAt}`} listing={data} onSaved={refresh} />
    </div>
  )
}
