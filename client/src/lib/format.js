// Copy rules (Part 4 §10): prices in NPR ("Rs 1,500"), times in 12-hour Nepal time.

const nprFormat = new Intl.NumberFormat('en-IN')

export const formatNpr = (amount) => `Rs ${nprFormat.format(amount)}`

/** Price level 1 to 4 as "Rs" … "Rs Rs Rs Rs". */
export const priceLevelText = (level) => Array.from({ length: level }, () => 'Rs').join(' ')

export function formatDistance(meters) {
  if (meters == null) return null
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}

/** "18:30" → "6:30 PM"; "24:00" → "12:00 AM". */
export function formatTime12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h < 12 || h === 24 ? 'AM' : 'PM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

export const formatDate = (iso) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kathmandu',
  }).format(new Date(iso))

// ---------- Action links ----------

export const telHref = (phone) => `tel:${phone.replace(/[^\d+]/g, '')}`

/** wa.me link; 10-digit Nepali mobiles (98…) get the 977 country code. */
export function whatsappHref(number) {
  let digits = number.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('9')) digits = `977${digits}`
  return `https://wa.me/${digits}`
}

export function directionsHref({ location, name, address, area }) {
  const destination = location
    ? `${location.lat},${location.lng}`
    : [name, address, area?.nameEn, 'Kathmandu'].filter(Boolean).join(', ')
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

export const listingHref = (slug) => `/listing/${slug}`
export const eventHref = (slug) => `/events/${slug}`
export const marketHref = (slug) => `/market/${slug}`
export const categoryHref = (category) => `/${category.groupSlug}/${category.slug}`

/** Google Maps page for a place id (the only Google data we store). */
export const googlePlaceHref = (placeId) =>
  `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`
