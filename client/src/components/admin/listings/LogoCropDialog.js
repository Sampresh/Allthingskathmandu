'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

const VIEW = 288 // crop window, CSS px
const OUTPUT = 512 // saved logo, px square
const MAX_ZOOM = 4

/** Image position that keeps the square fully covered. */
function clamp(offset, scale, image) {
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale
  return {
    x: Math.min(0, Math.max(VIEW - w, offset.x)),
    y: Math.min(0, Math.max(VIEW - h, offset.y)),
  }
}

/**
 * Square crop for a logo: drag (or arrow keys) to move, slider (or +/-) to zoom. onCropped
 * receives a 512 px WebP Blob.
 */
export function LogoCropDialog({ file, onClose, onCropped }) {
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const drag = useRef(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImage(img)
      setZoom(1)
      const base = VIEW / Math.min(img.naturalWidth, img.naturalHeight)
      setOffset({
        x: (VIEW - img.naturalWidth * base) / 2,
        y: (VIEW - img.naturalHeight * base) / 2,
      })
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const base = image ? VIEW / Math.min(image.naturalWidth, image.naturalHeight) : 1
  const scale = base * zoom

  // Zoom around the centre of the crop window.
  const zoomTo = (next) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, next))
    const centre = { x: (VIEW / 2 - offset.x) / scale, y: (VIEW / 2 - offset.y) / scale }
    const s = base * z
    setZoom(z)
    setOffset(clamp({ x: VIEW / 2 - centre.x * s, y: VIEW / 2 - centre.y * s }, s, image))
  }
  const move = (dx, dy) => setOffset((o) => clamp({ x: o.x + dx, y: o.y + dy }, scale, image))

  const save = async () => {
    setBusy(true)
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    const ratio = OUTPUT / VIEW
    ctx.drawImage(
      image,
      offset.x * ratio,
      offset.y * ratio,
      image.naturalWidth * scale * ratio,
      image.naturalHeight * scale * ratio,
    )
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
    try {
      await onCropped(blob)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={Boolean(file)}
      onClose={onClose}
      title="Crop the logo"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!image}>
            Upload logo
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          role="application"
          aria-label="Crop area. Arrow keys move the image, plus and minus zoom."
          tabIndex={0}
          className="relative cursor-grab touch-none overflow-hidden rounded-box border border-border bg-surface-raised active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { x: e.clientX, y: e.clientY }
          }}
          onPointerMove={(e) => {
            if (!drag.current) return
            move(e.clientX - drag.current.x, e.clientY - drag.current.y)
            drag.current = { x: e.clientX, y: e.clientY }
          }}
          onPointerUp={() => (drag.current = null)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 5
            const keys = {
              ArrowLeft: () => move(step, 0),
              ArrowRight: () => move(-step, 0),
              ArrowUp: () => move(0, step),
              ArrowDown: () => move(0, -step),
              '+': () => zoomTo(zoom + 0.1),
              '=': () => zoomTo(zoom + 0.1),
              '-': () => zoomTo(zoom - 0.1),
            }
            if (keys[e.key]) {
              e.preventDefault()
              keys[e.key]()
            }
          }}
        >
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of a file not yet uploaded
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="absolute top-0 left-0 max-w-none select-none"
              style={{
                width: image.naturalWidth * scale,
                height: image.naturalHeight * scale,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>
        <div className="flex w-full max-w-72 items-center gap-2">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomTo(zoom - 0.25)}
            className="inline-flex size-10 items-center justify-center rounded-box hover:bg-surface-raised"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => zoomTo(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-[var(--atk-brand)]"
          />
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomTo(zoom + 0.25)}
            className="inline-flex size-10 items-center justify-center rounded-box hover:bg-surface-raised"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
        <p className="text-center text-xs text-text-muted">
          Saved as a {OUTPUT} × {OUTPUT} square. Use the business&apos;s own logo.
        </p>
      </div>
    </Dialog>
  )
}
