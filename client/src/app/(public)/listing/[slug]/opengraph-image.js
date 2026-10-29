import { ImageResponse } from 'next/og'
import { publicGet } from '@/lib/serverApi'
import { isSlug } from '@/lib/slug'
import { SITE_NAME } from '@/lib/site'

export const alt = 'Listing on All Things Kathmandu'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600

const BRICK = '#a3302a'
const PAPER = '#fbf9f6'
const INK = '#1f2328'
const MUTED = '#6b6560'

/** Share image: name, category and area on warm paper, with the logo when there is one. */
export default async function Image({ params }) {
  const { slug } = await params
  const listing = isSlug(slug)
    ? ((await publicGet(`/listings/${slug}`, { tags: [`listing:${slug}`] }))?.data ?? null)
    : null
  const name = listing?.name ?? SITE_NAME
  const where = [listing?.category?.nameEn, listing?.area?.nameEn].filter(Boolean).join(' · ')
  const logo = listing?.logoUrl?.replace('/image/upload/', '/image/upload/f_png,c_pad,w_240,h_240/')
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: PAPER,
        padding: 72,
        borderTop: `16px solid ${BRICK}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
        {logo ? (
          <img src={logo} width={200} height={200} alt="" style={{ borderRadius: 24 }} />
        ) : (
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: 24,
              background: '#f7e4e0',
              color: '#8a2a24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 88,
              fontWeight: 700,
            }}
          >
            {initials}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{
              fontSize: name.length > 34 ? 60 : 76,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.1,
            }}
          >
            {name}
          </div>
          {where && <div style={{ fontSize: 38, color: MUTED, marginTop: 20 }}>{where}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 34, color: BRICK, fontWeight: 700 }}>{SITE_NAME}</div>
        {listing?.shortDesc && (
          <div style={{ fontSize: 28, color: MUTED, maxWidth: 640, textAlign: 'right' }}>
            {listing.shortDesc}
          </div>
        )}
      </div>
    </div>,
    size,
  )
}
