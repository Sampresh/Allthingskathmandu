'use client'

import { useRef, useState } from 'react'
import { ImagePlus, PlayCircle, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { CloudImage } from '@/components/ui/CloudImage'
import { Uploader, uploadSigned } from '@/components/ui/Uploader'
import { listings } from '@/services/admin.service'
import { TextField } from '../Fields'
import { SortableList } from '../SortableList'
import { errorMessage, useToast } from '../Toast'
import { LogoCropDialog } from './LogoCropDialog'

/**
 * Logo (square, cropped in the browser), and for Featured listings a photo gallery with
 * required alt text and drag reorder, plus YouTube / Reels links. Changes save at once.
 */
export function MediaSection({ listing, featured, onChanged }) {
  const toast = useToast()
  const fileRef = useRef(null)
  const [cropFile, setCropFile] = useState(null)
  const [video, setVideo] = useState({ url: '', altText: '' })
  const [busy, setBusy] = useState(null)

  if (!listing) {
    return (
      <p className="text-sm text-text-muted">Save the listing once to add a logo and photos.</p>
    )
  }

  const run = async (key, fn, message) => {
    setBusy(key)
    try {
      await fn()
      if (message) toast(message)
      await onChanged()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const uploadLogo = (blob) =>
    run(
      'logo',
      async () => {
        const params = await listings.signLogo(listing.id)
        if (blob.size > params.maxBytes) throw new Error('The cropped logo is too large')
        const result = await uploadSigned(params, blob)
        await listings.setLogo(listing.id, result.public_id)
        setCropFile(null)
      },
      'Logo updated',
    )

  const photos = listing.media.filter((m) => m.type === 'PHOTO')
  const videos = listing.media.filter((m) => m.type === 'VIDEO')

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={listing.logoUrl} name={listing.name} size={96} alt={`${listing.name} logo`} />
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">Square, at least 256 px. JPG, PNG or WebP.</p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Choose a logo image"
              onChange={(e) => {
                setCropFile(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <ImagePlus aria-hidden="true" className="size-4" />
              {listing.logoUrl ? 'Replace logo' : 'Upload logo'}
            </Button>
            {listing.logoUrl && (
              <Button
                variant="ghost"
                className="text-danger"
                loading={busy === 'remove-logo'}
                onClick={() =>
                  run('remove-logo', () => listings.setLogo(listing.id, null), 'Logo removed')
                }
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <LogoCropDialog file={cropFile} onClose={() => setCropFile(null)} onCropped={uploadLogo} />

      <div className="flex flex-col gap-3">
        <h3 className="font-semibold">Photo gallery</h3>
        {!featured ? (
          <p className="rounded-box border border-dashed border-border p-4 text-sm text-text-muted">
            Photos and videos are part of Featured. Set &ldquo;Featured until&rdquo; below to add
            them.
          </p>
        ) : (
          <>
            {photos.length > 0 && (
              <SortableList
                items={photos}
                label={(m) => m.altText}
                onReorder={(items) =>
                  run('order', () =>
                    listings.reorderMedia(
                      listing.id,
                      [...items, ...videos].map((m) => m.id),
                    ),
                  )
                }
                renderItem={(m) => (
                  <MediaRow listingId={listing.id} media={m} onChanged={onChanged} />
                )}
              />
            )}
            <Uploader
              label="Add a photo"
              requireAlt
              buttonLabel="Upload photo"
              sign={() => listings.signMedia(listing.id)}
              onUploaded={({ publicId, altText }) =>
                run(
                  'photo',
                  () => listings.addMedia(listing.id, { type: 'PHOTO', publicId, altText }),
                  'Photo added',
                )
              }
            />
          </>
        )}
      </div>

      {featured && (
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">Videos</h3>
          {videos.length > 0 && (
            <ul className="flex flex-col gap-2">
              {videos.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-box border border-border p-2"
                >
                  <PlayCircle aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.altText}</p>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-xs text-brand"
                    >
                      {m.url}
                    </a>
                  </div>
                  <DeleteMedia listingId={listing.id} media={m} onChanged={onChanged} />
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              label="YouTube or Instagram Reels link"
              value={video.url}
              onChange={(e) => setVideo({ ...video, url: e.target.value })}
              className="min-w-64 flex-1"
            />
            <TextField
              label="Title"
              value={video.altText}
              onChange={(e) => setVideo({ ...video, altText: e.target.value })}
              className="min-w-48"
            />
            <Button
              variant="secondary"
              disabled={!video.url.trim() || !video.altText.trim()}
              loading={busy === 'video'}
              onClick={() =>
                run(
                  'video',
                  async () => {
                    await listings.addMedia(listing.id, {
                      type: 'VIDEO',
                      url: video.url.trim(),
                      altText: video.altText.trim(),
                    })
                    setVideo({ url: '', altText: '' })
                  },
                  'Video added',
                )
              }
            >
              Add video
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function MediaRow({ listingId, media, onChanged }) {
  const toast = useToast()
  const [alt, setAlt] = useState(media.altText)
  const save = async () => {
    const value = alt.trim()
    if (!value) {
      setAlt(media.altText)
      toast('Every photo needs a description', 'error')
      return
    }
    if (value === media.altText) return
    try {
      await listings.updateMedia(listingId, media.id, value)
      await onChanged()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }
  return (
    <div className="flex items-center gap-3">
      <CloudImage
        src={media.url}
        alt={media.altText}
        width={64}
        height={64}
        className="size-16 shrink-0 rounded-box object-cover"
      />
      <label className="flex min-w-0 flex-1 flex-col text-xs font-semibold">
        Description (alt text)
        <input
          value={alt}
          maxLength={150}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={save}
          className="mt-1 min-h-10 rounded-box border border-text-muted bg-surface px-2 text-sm font-normal"
        />
      </label>
      <DeleteMedia listingId={listingId} media={media} onChanged={onChanged} />
    </div>
  )
}

function DeleteMedia({ listingId, media, onChanged }) {
  const toast = useToast()
  return (
    <button
      type="button"
      aria-label={`Remove ${media.altText}`}
      onClick={async () => {
        try {
          await listings.removeMedia(listingId, media.id)
          await onChanged()
        } catch (err) {
          toast(errorMessage(err), 'error')
        }
      }}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-box text-danger hover:bg-surface-raised"
    >
      <Trash2 aria-hidden="true" className="size-4" />
    </button>
  )
}
