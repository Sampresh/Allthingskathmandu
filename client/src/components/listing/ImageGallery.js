'use client'

import { useState } from 'react'
import { CloudImage } from '@/components/ui/CloudImage'
import { Dialog } from '@/components/ui/Dialog'

/** Photo grid; a photo opens larger in a dialog. Images below the fold load lazily. */
export function ImageGallery({ photos, title }) {
  const [open, setOpen] = useState(null)

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="block w-full overflow-hidden rounded-box border border-border"
            >
              <CloudImage
                src={photo.url}
                alt={photo.altText}
                width={480}
                height={360}
                widths={[240, 360, 480, 720, 960]}
                sizes="(min-width: 640px) 33vw, 50vw"
                className="aspect-[4/3] w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={open !== null} onClose={() => setOpen(null)} title={title}>
        {open !== null && (
          <CloudImage
            src={photos[open].url}
            alt={photos[open].altText}
            width={1200}
            height={900}
            widths={[480, 768, 1024, 1200]}
            priority
            sizes="(min-width: 640px) 512px, 100vw"
            className="h-auto w-full rounded-box"
          />
        )}
      </Dialog>
    </>
  )
}
