// Labels and options shared by the admin listings table, editor and import page.

export const STATUS_TABS = [
  { key: '', label: 'All', count: 'ALL' },
  { key: 'PENDING', label: 'Pending', count: 'PENDING' },
  { key: 'LIVE', label: 'Live', count: 'LIVE' },
  { key: 'SUSPENDED', label: 'Suspended', count: 'SUSPENDED' },
  { key: 'DRAFT', label: 'Draft', count: 'DRAFT' },
  { key: 'TRASH', label: 'Trash', count: 'TRASH' },
]

export const STATUS = {
  LIVE: { label: 'Live', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
}

export const TYPES = {
  BUSINESS: 'Business',
  PLACE: 'Place',
  APP: 'App',
  HOTLINE: 'Hotline',
}

export const MISSING = [
  { key: 'phone', label: 'No phone' },
  { key: 'hours', label: 'No hours' },
  { key: 'location', label: 'No map pin' },
  { key: 'logo', label: 'No logo' },
  { key: 'description', label: 'No description' },
  { key: 'area', label: 'No area' },
]

export const VERIFICATION = [
  { key: 'phone', label: 'Phone number confirmed with the business' },
  { key: 'hours', label: 'Opening hours confirmed' },
  { key: 'location', label: 'Map pin checked on the ground or with the owner' },
  { key: 'logo', label: 'Logo is the official one' },
  { key: 'description', label: 'Description checked' },
]

const KATHMANDU = 'Asia/Kathmandu'
export const formatWhen = (iso) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: KATHMANDU,
  }).format(new Date(iso))

export const formatDay = (iso) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: KATHMANDU }).format(
    new Date(iso),
  )
