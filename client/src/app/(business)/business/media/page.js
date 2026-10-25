'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmButton } from '@/components/admin/ConfirmButton'
import { TextField } from '@/components/admin/Fields'
import { SortableList } from '@/components/admin/SortableList'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { FeaturedGate } from '@/components/business/FeaturedGate'
import { Button } from '@/components/ui/Button'
import { CloudImage } from '@/components/ui/CloudImage'
import { Skeleton } from '@/components/ui/Skeleton'
import { Uploader } from '@/components/ui/Uploader'
import { useBusinessListing } from '@/hooks/useBusinessListing'
import {
  addMedia,
  deleteMedia,
  getListing,
  reorderMedia,
  signMedia,
} from '@/services/business.service'

export default function MediaPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { listingId } = useBusinessListing()
  const key = ['business', 'listing', listingId]
  const { data, isPending } = useQuery({
    queryKey: key,
    queryFn: () => getListing(listingId),
    enabled: Boolean(listingId),
  })
  const [video, setVideo] = useState({ url: '', altText: '' })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  if (isPending) return <Skeleton className="h-96 w-full" />
  const limits = data.plan?.features?.featured ? data.plan.features : null
  if (!limits) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">Photos & videos</h1>
        <FeaturedGate listingId={listingId} what="Photos and videos" />
      </div>
    )
  }

  const photos = data.media.filter((m) => m.type === 'PHOTO')
  const videos = data.media.filter((m) => m.type === 'VIDEO')

  const remove = async (m) => {
    try {
      await deleteMedia(listingId, m.id)
      toast('Removed')
      refresh()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const reorder = async (items) => {
    queryClient.setQueryData(key, { ...data, media: items })
    try {
      await reorderMedia(
        listingId,
        items.map((m) => m.id),
      )
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
    refresh()
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">Photos & videos</h1>
      <p className="text-sm text-text-muted">
        Your plan allows {limits.maxPhotos} photos ({photos.length} used) and {limits.maxVideos}{' '}
        videos ({videos.length} used). Drag to set the order on your page.
      </p>

      {data.media.length > 0 && (
        <SortableList
          items={data.media}
          label={(m) => m.altText}
          onReorder={reorder}
          renderItem={(m) => (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {m.type === 'PHOTO' ? (
                  <CloudImage
                    src={m.url}
                    alt={m.altText}
                    width={96}
                    height={72}
                    className="aspect-[4/3] w-24 rounded-box object-cover"
                  />
                ) : (
                  <span className="inline-flex h-18 w-24 items-center justify-center rounded-box bg-surface-raised text-xs">
                    Video
                  </span>
                )}
                <span className="text-sm">{m.altText}</span>
              </div>
              <ConfirmButton
                title="Remove"
                message="Remove this from your page?"
                confirmLabel="Remove"
                onConfirm={() => remove(m)}
              >
                Remove
              </ConfirmButton>
            </div>
          )}
        />
      )}

      {photos.length < limits.maxPhotos && (
        <Uploader
          label="Add a photo (JPG, PNG or WebP, up to 5 MB)"
          requireAlt
          sign={() => signMedia(listingId)}
          onUploaded={async ({ publicId, altText }) => {
            await addMedia(listingId, { type: 'PHOTO', publicId, altText })
            toast('Photo added')
            refresh()
          }}
        />
      )}

      {videos.length < limits.maxVideos && (
        <section className="flex flex-col gap-3 rounded-box border border-dashed border-border p-4">
          <h2 className="font-semibold">Add a video</h2>
          <TextField
            label="YouTube or Instagram Reels link"
            type="url"
            value={video.url}
            onChange={(e) => setVideo((v) => ({ ...v, url: e.target.value }))}
          />
          <TextField
            label="Title"
            value={video.altText}
            onChange={(e) => setVideo((v) => ({ ...v, altText: e.target.value }))}
          />
          <div>
            <Button
              disabled={!video.url.trim() || !video.altText.trim()}
              onClick={async () => {
                try {
                  await addMedia(listingId, {
                    type: 'VIDEO',
                    url: video.url.trim(),
                    altText: video.altText.trim(),
                  })
                  setVideo({ url: '', altText: '' })
                  toast('Video added')
                  refresh()
                } catch (err) {
                  toast(errorMessage(err), 'error')
                }
              }}
            >
              Add video
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
