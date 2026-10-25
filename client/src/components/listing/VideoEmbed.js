'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import { T } from '@/components/common/T'

// YouTube (privacy-enhanced domain) and Instagram Reels links → embed URLs.
export function embedUrl(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`
    if (host === 'youtube.com') {
      const id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1]
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    if (host === 'instagram.com') {
      const id = u.pathname.match(/^\/(?:reel|reels|p)\/([\w-]+)/)?.[1]
      return id ? `https://www.instagram.com/reel/${id}/embed` : null
    }
  } catch {
    return null
  }
  return null
}

/**
 * Click-to-load video: the third-party player (and its script weight) loads only after
 * the visitor asks for it.
 */
export function VideoEmbed({ url, title }) {
  const [playing, setPlaying] = useState(false)
  const src = embedUrl(url)
  if (!src) return null

  return (
    <div className="aspect-video w-full overflow-hidden rounded-box border border-border bg-surface-raised">
      {playing ? (
        <iframe
          src={`${src}${src.includes('youtube') ? '?autoplay=1' : ''}`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="flex size-full flex-col items-center justify-center gap-2 font-semibold"
        >
          <span className="inline-flex size-14 items-center justify-center rounded-pill bg-brand text-brand-contrast">
            <Play aria-hidden="true" className="size-6" />
          </span>
          <T k="listing.playVideo" />
        </button>
      )}
    </div>
  )
}
