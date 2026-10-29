'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Lock,
  LockOpen,
  MapPinned,
  X,
} from 'lucide-react'
import { HoursEditor } from '@/components/business/HoursEditor'
import { ListingCard } from '@/components/listing/ListingCard'
import { LocationPicker } from '@/components/map/LocationPicker'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { googlePlaceHref, listingHref } from '@/lib/format'
import {
  DESCRIPTION_MAX,
  LISTING_TYPES,
  PUBLISH_RULES_ENFORCED,
  SHORT_DESC_MAX,
  listingCreate,
  listingUpdate,
  profileScore,
  publishProblems,
} from '@/lib/listingSchema'
import { areas, categories, listings, tags } from '@/services/admin.service'
import { Checkbox, SelectField, TextArea, TextField } from '../Fields'
import { errorMessage, useToast } from '../Toast'
import { MediaSection } from './MediaSection'
import { HistorySection, OwnerSection } from './OwnerHistory'
import { STATUS, TYPES, VERIFICATION } from './listingMeta'

const SECTIONS = [
  ['basics', 'Basics'],
  ['description', 'Description'],
  ['contact', 'Contact'],
  ['location', 'Location'],
  ['hours', 'Hours'],
  ['media', 'Media'],
  ['featured', 'Featured'],
  ['seo', 'SEO'],
  ['owner', 'Owner and claims'],
  ['verification', 'Verification'],
  ['note', 'Admin note'],
  ['history', 'History'],
]

// Which section shows each field's error.
const FIELD_SECTION = {
  name: 'basics',
  nameNe: 'basics',
  type: 'basics',
  slug: 'basics',
  categoryIds: 'basics',
  tagIds: 'basics',
  priceLevel: 'basics',
  shortDesc: 'description',
  description: 'description',
  phone: 'contact',
  whatsapp: 'contact',
  email: 'contact',
  website: 'contact',
  playStoreUrl: 'contact',
  appStoreUrl: 'contact',
  address: 'location',
  areaId: 'location',
  location: 'location',
  googlePlaceId: 'location',
  hours: 'hours',
  logoUrl: 'media',
  featuredUntil: 'featured',
  seoTitle: 'seo',
  seoDescription: 'seo',
  verification: 'verification',
  adminNote: 'note',
}

const TEXT = [
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
  'address',
  'googlePlaceId',
  'seoTitle',
  'seoDescription',
  'adminNote',
]

// Nepal is UTC+05:45; <input type="datetime-local"> works in Nepal time.
const NPT_MS = (5 * 60 + 45) * 60 * 1000
const toLocalInput = (iso) =>
  iso ? new Date(new Date(iso).getTime() + NPT_MS).toISOString().slice(0, 16) : ''
const fromLocalInput = (value) => (value ? new Date(`${value}:00+05:45`).toISOString() : null)

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

function toState(listing) {
  return {
    ...Object.fromEntries(TEXT.map((f) => [f, listing?.[f] ?? ''])),
    type: listing?.type ?? 'BUSINESS',
    slug: listing?.slug ?? '',
    slugLocked: true,
    status: listing?.status ?? 'DRAFT',
    primaryCategoryId: listing?.categoryIds?.[0] ?? '',
    extraCategoryIds: listing?.categoryIds?.slice(1) ?? [],
    tagIds: listing?.tagIds ?? [],
    areaId: listing?.areaId ?? '',
    priceLevel: listing?.priceLevel ? String(listing.priceLevel) : '',
    location: listing?.location ?? null,
    hours: listing?.hours ?? null,
    featuredUntil: toLocalInput(listing?.featuredUntil),
    isVerified: listing?.isVerified ?? false,
    verification: Object.fromEntries(
      VERIFICATION.map(({ key }) => [key, listing?.verification?.[key] === true]),
    ),
  }
}

const validPoint = (p) =>
  p && Number.isFinite(Number.parseFloat(p.lat)) && Number.isFinite(Number.parseFloat(p.lng))

/** Form state → API body: blanks become null; the slug is sent only when unlocked. */
function toBody(state, isNew) {
  const body = Object.fromEntries(
    TEXT.map((f) => {
      const value = state[f].trim()
      return [f, value === '' ? (f === 'shortDesc' ? '' : null) : value]
    }),
  )
  if (isNew) for (const f of TEXT) if (body[f] === null) delete body[f]
  return {
    ...body,
    type: state.type,
    ...(!state.slugLocked && { slug: state.slug.trim() }),
    categoryIds: [state.primaryCategoryId, ...state.extraCategoryIds].filter(Boolean),
    tagIds: state.tagIds,
    areaId: state.areaId || null,
    priceLevel: state.priceLevel ? Number(state.priceLevel) : null,
    location: validPoint(state.location)
      ? { lat: Number.parseFloat(state.location.lat), lng: Number.parseFloat(state.location.lng) }
      : null,
    hours: state.hours,
    featuredUntil: fromLocalInput(state.featuredUntil),
    isVerified: state.isVerified,
    verification: state.verification,
  }
}

/** API and Zod errors → { field: message } (first message per field). */
function errorsFrom(details) {
  const errors = {}
  for (const d of details ?? []) {
    const path = Array.isArray(d.path) ? d.path.join('.') : String(d.path ?? '')
    const field = path.split('.')[0] || 'form'
    errors[field] ??= d.message
  }
  return errors
}

export function ListingEditor({ listing, canEdit }) {
  const router = useRouter()
  const toast = useToast()
  const queryClient = useQueryClient()
  const isNew = !listing
  const [state, setState] = useState(() => toState(listing))
  const [saved, setSaved] = useState(() => toState(listing))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(null)
  const [leaveTo, setLeaveTo] = useState(null)
  const [active, setActive] = useState('basics')

  const taxonomy = useQuery({ queryKey: ['admin', 'categories'], queryFn: categories.list })
  const tagList = useQuery({ queryKey: ['admin', 'tags'], queryFn: tags.list })
  const areaList = useQuery({ queryKey: ['admin', 'areas'], queryFn: areas.list })
  const groups = taxonomy.data?.groups ?? []
  const allCategories = groups.flatMap((g) => g.children.map((c) => ({ ...c, group: g })))
  const categoryById = new Map(allCategories.map((c) => [c.id, c]))

  const set = (patch) => setState((s) => ({ ...s, ...patch }))
  const field = (name) => ({
    value: state[name],
    onChange: (e) => set({ [name]: e.target.value }),
    error: errors[name],
    disabled: !canEdit,
  })

  const body = useMemo(() => toBody(state, isNew), [state, isNew])
  const dirty = useMemo(
    () => JSON.stringify(body) !== JSON.stringify(toBody(saved, isNew)),
    [body, saved, isNew],
  )
  const featured = Boolean(listing?.featuredUntil && new Date(listing.featuredUntil) > new Date())
  const rules = {
    ...body,
    logoUrl: listing?.logoUrl ?? null,
    categoryIds: body.categoryIds,
    location: body.location,
  }
  const problems = publishProblems(rules)
  const score = profileScore(rules)

  // Warn before leaving with unsaved changes: closing the tab, or any in-app link.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e) => {
      const link = e.target.closest?.('a[href]')
      if (!link || link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname) return
      e.preventDefault()
      e.stopPropagation()
      setLeaveTo(url.pathname + url.search)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])

  // Highlight the section in view in the side nav.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length) setActive(visible[0].target.id.replace('section-', ''))
      },
      { rootMargin: '-80px 0px -65% 0px' },
    )
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(`section-${id}`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const showErrors = (next) => {
    setErrors(next)
    const first = SECTIONS.find(([id]) =>
      Object.keys(next).some((f) => (FIELD_SECTION[f] ?? 'basics') === id),
    )
    if (first)
      document.getElementById(`section-${first[0]}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  const refresh = async (id = listing?.id) => {
    const fresh = await listings.get(id)
    queryClient.setQueryData(['admin', 'listing', id], fresh)
    await queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'listing-history', id] })
    return fresh
  }

  const save = async (status, label) => {
    const payload = { ...body, ...(status && { status }) }
    const parsed = (isNew ? listingCreate : listingUpdate).safeParse(payload)
    if (!parsed.success) {
      toast('Check the highlighted fields', 'error')
      return showErrors(errorsFrom(parsed.error.issues))
    }
    const goingLive = (status ?? state.status) === 'LIVE'
    if (PUBLISH_RULES_ENFORCED && goingLive && problems.length) {
      toast('Not ready to publish yet', 'error')
      return showErrors(errorsFrom(problems.map((p) => ({ path: p.field, message: p.message }))))
    }
    setBusy(label)
    try {
      const result = isNew
        ? await listings.create(payload)
        : await listings.update(listing.id, payload)
      setErrors({})
      const next = toState(result)
      setState(next)
      setSaved(next)
      queryClient.setQueryData(['admin', 'listing', result.id], result)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'listing-history', result.id] })
      toast(status === 'LIVE' ? 'Published' : 'Saved')
      if (isNew) router.replace(`/admin/listings/${result.id}`)
    } catch (err) {
      toast(errorMessage(err), 'error')
      if (err.details?.length) showErrors(errorsFrom(err.details))
    } finally {
      setBusy(null)
    }
  }

  const applicableTags = (tagList.data ?? []).filter(
    (t) => !t.categoryId || body.categoryIds.includes(t.categoryId),
  )
  const area = areaList.data?.find((a) => a.id === state.areaId)
  const primary = categoryById.get(state.primaryCategoryId)

  return (
    <div className="flex flex-col gap-6 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/listings"
            className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Listings
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold lg:text-3xl">
            {isNew ? 'New listing' : state.name || listing.name}
          </h1>
          {!isNew && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {listing.deletedAt ? (
                <Badge tone="danger">In Trash</Badge>
              ) : (
                <Badge tone={STATUS[listing.status].tone}>{STATUS[listing.status].label}</Badge>
              )}
              {listing.isVerified && <Badge tone="brand">Verified</Badge>}
              {featured && <Badge tone="featured">Featured</Badge>}
              {listing.status === 'LIVE' && (
                <a
                  href={listingHref(listing.slug)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 font-semibold text-brand"
                >
                  View on site <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] xl:grid-cols-[11rem_minmax(0,1fr)_20rem]">
        {/* Section nav */}
        <nav aria-label="Form sections" className="hidden lg:block">
          <ul className="sticky top-24 flex flex-col gap-0.5 text-sm">
            {SECTIONS.map(([id, label]) => {
              const hasError = Object.keys(errors).some(
                (f) => (FIELD_SECTION[f] ?? 'basics') === id,
              )
              return (
                <li key={id}>
                  <a
                    href={`#section-${id}`}
                    aria-current={active === id ? 'location' : undefined}
                    className={clsx(
                      'flex min-h-9 items-center justify-between rounded-box px-3',
                      active === id
                        ? 'bg-brand/10 font-semibold text-brand'
                        : 'text-text-muted hover:bg-surface-raised hover:text-text',
                    )}
                  >
                    {label}
                    {hasError && (
                      <CircleAlert aria-label="has errors" className="size-4 text-danger" />
                    )}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Form */}
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            save(undefined, 'save')
          }}
          className="flex min-w-0 flex-col gap-6"
        >
          <fieldset disabled={!canEdit} className="contents">
            <Section id="basics" title="Basics">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Type"
                  value={state.type}
                  onChange={(e) => set({ type: e.target.value })}
                  error={errors.type}
                >
                  {LISTING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPES[t]}
                    </option>
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
                <TextField label="Name" maxLength={120} {...field('name')} />
                <TextField
                  label="Nepali name"
                  lang="ne"
                  maxLength={120}
                  hint="Shown when the site is in Nepali"
                  {...field('nameNe')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold" id="slug-label">
                  Web address
                </span>
                <div className="flex items-stretch gap-2">
                  <span className="hidden items-center text-sm text-text-muted sm:flex">
                    /listing/
                  </span>
                  <input
                    aria-labelledby="slug-label"
                    value={state.slugLocked && isNew ? slugify(state.name) : state.slug}
                    onChange={(e) => set({ slug: e.target.value })}
                    readOnly={state.slugLocked}
                    aria-invalid={errors.slug ? true : undefined}
                    className={clsx(
                      'min-h-11 min-w-0 flex-1 rounded-box border border-text-muted bg-surface px-3',
                      state.slugLocked && 'bg-surface-raised text-text-muted',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set({
                        slugLocked: !state.slugLocked,
                        slug: state.slug || slugify(state.name),
                      })
                    }
                    aria-pressed={!state.slugLocked}
                    className="inline-flex min-h-11 items-center gap-1 rounded-box border border-border px-3 text-sm font-semibold hover:bg-surface-raised"
                  >
                    {state.slugLocked ? (
                      <>
                        <Lock aria-hidden="true" className="size-4" /> Unlock
                      </>
                    ) : (
                      <>
                        <LockOpen aria-hidden="true" className="size-4" /> Lock
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-text-muted">
                  {state.slugLocked
                    ? isNew
                      ? 'Made from the name when you save.'
                      : 'Locked so links keep working. Unlock only to fix a mistake; the old address is revalidated.'
                    : 'Lower-case letters, numbers and dashes.'}
                </p>
                {errors.slug && <p className="text-sm text-danger">{errors.slug}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Primary category"
                  value={state.primaryCategoryId}
                  onChange={(e) =>
                    set({
                      primaryCategoryId: e.target.value,
                      extraCategoryIds: state.extraCategoryIds.filter(
                        (id) => id !== e.target.value,
                      ),
                    })
                  }
                  error={errors.categoryIds}
                >
                  <option value="">Choose…</option>
                  {groups.map((g) => (
                    <optgroup key={g.id} label={g.nameEn}>
                      {g.children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameEn}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </SelectField>
                <SelectField
                  label="Also list in"
                  value=""
                  disabled={!state.primaryCategoryId || state.extraCategoryIds.length >= 4}
                  onChange={(e) =>
                    e.target.value &&
                    set({ extraCategoryIds: [...state.extraCategoryIds, e.target.value] })
                  }
                >
                  <option value="">Add a category…</option>
                  {groups.map((g) => (
                    <optgroup key={g.id} label={g.nameEn}>
                      {g.children
                        .filter(
                          (c) =>
                            c.id !== state.primaryCategoryId &&
                            !state.extraCategoryIds.includes(c.id),
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameEn}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </SelectField>
              </div>
              {state.extraCategoryIds.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Other categories">
                  {state.extraCategoryIds.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() =>
                          set({ extraCategoryIds: state.extraCategoryIds.filter((c) => c !== id) })
                        }
                        className="inline-flex min-h-9 items-center gap-1 rounded-pill border border-border px-3 text-sm hover:bg-surface-raised"
                      >
                        {categoryById.get(id)?.nameEn ?? 'Category'}
                        <X aria-label="remove" className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold">Tags (filter chips)</legend>
                {applicableTags.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    No tags for these categories yet. Add them under Directory → Tags.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {applicableTags.map((t) => {
                      const on = state.tagIds.includes(t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            set({
                              tagIds: on
                                ? state.tagIds.filter((id) => id !== t.id)
                                : [...state.tagIds, t.id],
                            })
                          }
                          className={clsx(
                            'inline-flex min-h-9 items-center rounded-pill border px-3 text-sm',
                            on
                              ? 'border-brand bg-brand/10 font-semibold text-brand'
                              : 'border-border hover:bg-surface-raised',
                          )}
                        >
                          {t.nameEn}
                        </button>
                      )
                    })}
                  </div>
                )}
              </fieldset>
            </Section>

            <Section id="description" title="Description">
              <Counted value={state.shortDesc} max={SHORT_DESC_MAX}>
                <TextField
                  label="One-line description (on cards)"
                  maxLength={SHORT_DESC_MAX}
                  hint="What it is and why to pick it. No marketing filler."
                  {...field('shortDesc')}
                />
              </Counted>
              <Counted value={state.description} max={DESCRIPTION_MAX}>
                <TextArea
                  label="Full description (listing page)"
                  rows={5}
                  maxLength={DESCRIPTION_MAX}
                  {...field('description')}
                />
              </Counted>
            </Section>

            <Section id="contact" title="Contact">
              {state.type === 'APP' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Website" type="url" {...field('website')} />
                  <TextField label="Play Store link" type="url" {...field('playStoreUrl')} />
                  <TextField label="App Store link" type="url" {...field('appStoreUrl')} />
                </div>
              ) : state.type === 'HOTLINE' ? (
                <TextField
                  label="Number"
                  inputMode="tel"
                  hint="Short codes such as 100 or 1144 are fine for hotlines."
                  {...field('phone')}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Phone" inputMode="tel" hint="+977…" {...field('phone')} />
                  <TextField label="WhatsApp" inputMode="tel" {...field('whatsapp')} />
                  <TextField label="Email" type="email" {...field('email')} />
                  <TextField label="Website" type="url" {...field('website')} />
                </div>
              )}
            </Section>

            <Section id="location" title="Location">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Address" maxLength={200} {...field('address')} />
                <SelectField
                  label="Area"
                  value={state.areaId}
                  onChange={(e) => set({ areaId: e.target.value })}
                  error={errors.areaId}
                >
                  <option value="">Choose…</option>
                  {(areaList.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nameEn}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Map pin</span>
                <LocationPicker
                  value={state.location}
                  onChange={(location) => set({ location })}
                  hint="Use your location while at the business."
                  showCoordinates={false}
                />
                {errors.location && <p className="text-sm text-danger">{errors.location}</p>}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <TextField
                  label="Google place id"
                  hint="From the import; used only to open Google Maps for comparison."
                  className="min-w-64 flex-1"
                  {...field('googlePlaceId')}
                />
                {state.googlePlaceId && (
                  <Button
                    variant="secondary"
                    href={googlePlaceHref(state.googlePlaceId)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPinned aria-hidden="true" className="size-4" />
                    Open in Google Maps
                  </Button>
                )}
              </div>
            </Section>

            <Section id="hours" title="Opening hours">
              <p className="text-sm text-text-muted">
                Nepal time. A range that closes after midnight (16:00 to 02:00) belongs to the day
                it opens.
              </p>
              <HoursEditor value={state.hours} onChange={(hours) => set({ hours })} />
            </Section>

            <Section id="media" title="Logo, photos and videos">
              <MediaSection
                listing={listing}
                featured={featured}
                onChanged={() => refresh(listing.id)}
              />
            </Section>

            <Section id="featured" title="Featured">
              <p className="text-sm text-text-muted">
                Featured listings sit at the top of their category (labelled) and may show photos,
                videos and offers. Paid plans set this automatically; set it here by hand only for
                agreed exceptions.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <TextField
                  type="datetime-local"
                  label="Featured until (Nepal time)"
                  {...field('featuredUntil')}
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    set({
                      featuredUntil: toLocalInput(
                        new Date(Date.now() + 30 * 86_400_000).toISOString(),
                      ),
                    })
                  }
                >
                  30 days from now
                </Button>
                {state.featuredUntil && (
                  <Button variant="ghost" onClick={() => set({ featuredUntil: '' })}>
                    Clear
                  </Button>
                )}
              </div>
              {listing?.subscriptions?.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm text-text-muted">
                  {listing.subscriptions.map((s) => (
                    <li key={s.id}>
                      {s.plan.name} plan · {s.status.toLowerCase()}
                      {s.endsAt && ` · ends ${new Date(s.endsAt).toLocaleDateString('en-GB')}`}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section id="seo" title="SEO">
              <Counted value={state.seoTitle} max={70}>
                <TextField
                  label="Search title"
                  maxLength={70}
                  hint="Leave empty to use the name and area."
                  {...field('seoTitle')}
                />
              </Counted>
              <Counted value={state.seoDescription} max={160}>
                <TextArea
                  label="Search description"
                  rows={2}
                  maxLength={160}
                  hint="Leave empty to use the one-line description."
                  {...field('seoDescription')}
                />
              </Counted>
              <SearchPreview
                title={
                  state.seoTitle ||
                  `${state.name || 'Listing name'}${area ? `, ${area.nameEn}` : ''}`
                }
                slug={state.slugLocked && isNew ? slugify(state.name) : state.slug}
                description={state.seoDescription || state.shortDesc}
              />
            </Section>

            <Section id="owner" title="Owner and claims">
              <OwnerSection
                listing={listing}
                canEdit={canEdit}
                onChanged={() => refresh(listing.id)}
              />
            </Section>

            <Section id="verification" title="Verification">
              <p className="text-sm text-text-muted">
                Tick each item once confirmed with the business.
              </p>
              <div className="flex flex-col">
                {VERIFICATION.map(({ key, label }) => (
                  <Checkbox
                    key={key}
                    label={label}
                    checked={state.verification[key]}
                    onChange={(e) =>
                      set({ verification: { ...state.verification, [key]: e.target.checked } })
                    }
                  />
                ))}
              </div>
              {errors.verification && <p className="text-sm text-danger">{errors.verification}</p>}
              <div className="border-t border-border pt-3">
                <Checkbox
                  label="Show the Verified badge on the public site"
                  checked={state.isVerified}
                  onChange={(e) => set({ isVerified: e.target.checked })}
                />
              </div>
            </Section>

            <Section id="note" title="Admin note">
              <TextArea
                label="Note for the team (never public)"
                rows={4}
                maxLength={2000}
                {...field('adminNote')}
              />
            </Section>
          </fieldset>

          <Section id="history" title="History">
            <HistorySection listingId={listing?.id} />
          </Section>
        </form>

        {/* Preview and checklist */}
        <aside
          className="flex flex-col gap-4 lg:col-start-2 xl:col-start-auto"
          aria-label="Preview"
        >
          <div className="sticky top-24 flex flex-col gap-4">
            <div className="rounded-box border border-border bg-surface-raised p-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
                Card preview
              </p>
              <div inert className="pointer-events-none">
                <ListingCard
                  card={{
                    id: listing?.id ?? 'new',
                    slug: body.slug ?? listing?.slug ?? 'preview',
                    name: state.name || 'Listing name',
                    nameNe: state.nameNe || null,
                    type: state.type,
                    shortDesc: state.shortDesc || 'One-line description',
                    logoUrl: listing?.logoUrl ?? null,
                    contact: {
                      phone: body.phone ?? null,
                      whatsapp: body.whatsapp ?? null,
                      website: body.website ?? null,
                      playStoreUrl: body.playStoreUrl ?? null,
                      appStoreUrl: body.appStoreUrl ?? null,
                    },
                    priceLevel: body.priceLevel,
                    rating: {
                      average: Number(listing?.ratingAvg ?? 0),
                      count: listing?.ratingCount ?? 0,
                    },
                    isVerified: state.isVerified,
                    featured: Boolean(
                      body.featuredUntil && new Date(body.featuredUntil) > new Date(),
                    ),
                    openNow: null,
                    hours: state.hours,
                    area: area
                      ? { slug: area.slug, nameEn: area.nameEn, nameNe: area.nameNe }
                      : null,
                    category: primary
                      ? {
                          slug: primary.slug,
                          nameEn: primary.nameEn,
                          groupSlug: primary.group.slug,
                        }
                      : null,
                  }}
                />
              </div>
            </div>

            <div className="rounded-box border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">
                  {PUBLISH_RULES_ENFORCED ? 'Ready to publish?' : 'Profile'}
                </p>
                <span className="text-sm text-text-muted">{score}% complete</span>
              </div>
              <div
                className="mb-3 h-1.5 overflow-hidden rounded-pill bg-surface-raised"
                role="meter"
                aria-label="Profile complete"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score}
              >
                <span
                  className="block h-full rounded-pill bg-brand"
                  style={{ width: `${score}%` }}
                />
              </div>
              {problems.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CircleCheck aria-hidden="true" className="size-4" /> Has everything a{' '}
                  {TYPES[state.type].toLowerCase()} listing usually shows.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {problems.map((p) => (
                    <li key={p.field}>
                      <a
                        href={`#section-${FIELD_SECTION[p.field.split('.')[0]] ?? 'basics'}`}
                        className="flex items-start gap-2 text-text-muted hover:text-text"
                      >
                        <CircleAlert
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-warning"
                        />
                        {p.message}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Save bar */}
      {canEdit && !listing?.deletedAt && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:left-[var(--admin-sidebar,16rem)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 lg:px-8">
            <p className="mr-auto flex items-center gap-2 text-sm" aria-live="polite">
              {dirty ? (
                <>
                  <span aria-hidden="true" className="size-2 rounded-pill bg-warning" />
                  Unsaved changes
                </>
              ) : (
                <span className="text-text-muted">
                  {isNew ? 'Not saved yet' : 'All changes saved'}
                </span>
              )}
            </p>
            {(isNew || state.status !== 'DRAFT') && (
              <Button
                variant="secondary"
                loading={busy === 'draft'}
                onClick={() => save('DRAFT', 'draft')}
              >
                Save draft
              </Button>
            )}
            {!isNew && state.status !== 'SUSPENDED' && (
              <Button
                variant="secondary"
                className="text-danger"
                loading={busy === 'suspend'}
                onClick={() => save('SUSPENDED', 'suspend')}
              >
                Suspend
              </Button>
            )}
            {!isNew && (
              <Button
                variant="secondary"
                loading={busy === 'save'}
                onClick={() => save(undefined, 'save')}
              >
                Save
              </Button>
            )}
            {state.status !== 'LIVE' && (
              <Button loading={busy === 'publish'} onClick={() => save('LIVE', 'publish')}>
                Publish
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(leaveTo)}
        onClose={() => setLeaveTo(null)}
        title="Leave without saving?"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setLeaveTo(null)}>
              Stay
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const to = leaveTo
                setSaved(state) // so the guard lets this navigation through
                setLeaveTo(null)
                router.push(to)
              }}
            >
              Leave
            </Button>
          </div>
        }
      >
        <p>Your changes to this listing will be lost.</p>
      </Dialog>
    </div>
  )
}

function Section({ id, title, children }) {
  return (
    <section
      id={`section-${id}`}
      aria-labelledby={`heading-${id}`}
      className="flex scroll-mt-24 flex-col gap-4 rounded-box border border-border bg-surface p-5"
    >
      <h2 id={`heading-${id}`} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Counted({ value, max, children }) {
  const left = max - value.length
  return (
    <div className="relative">
      {children}
      <span
        className={clsx(
          'absolute top-0 right-0 text-xs',
          left < 10 ? 'font-semibold text-warning' : 'text-text-muted',
        )}
        aria-live="polite"
      >
        {value.length}/{max}
      </span>
    </div>
  )
}

function SearchPreview({ title, slug, description }) {
  return (
    <div className="rounded-box border border-border p-4" aria-label="Search result preview">
      <p className="text-xs text-text-muted">allthingskathmandu.com › listing › {slug || '…'}</p>
      <p className="mt-1 truncate text-lg text-brand">{title}</p>
      <p className="line-clamp-2 text-sm text-text-muted">
        {description || 'Add a description so search engines show something useful.'}
      </p>
    </div>
  )
}
