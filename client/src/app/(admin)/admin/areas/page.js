'use client'

import { CrudPage } from '@/components/admin/CrudPage'
import { Badge } from '@/components/ui/Badge'
import { areas } from '@/services/admin.service'

const DISTRICTS = ['Kathmandu', 'Lalitpur', 'Bhaktapur']

export default function AreasPage() {
  return (
    <CrudPage
      title="Areas"
      queryKey="areas"
      api={areas}
      itemLabel={(a) => a.nameEn}
      deleteMessage={(a) =>
        `Delete ${a.nameEn}? Areas in use cannot be deleted; hide them instead.`
      }
      columns={[
        { key: 'nameEn', header: 'Name' },
        { key: 'nameNe', header: 'Nepali' },
        { key: 'district', header: 'District' },
        {
          key: 'center',
          header: 'Centre',
          render: (a) => (a.lat == null ? '—' : `${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}`),
        },
        { key: 'listingCount', header: 'Listings' },
        {
          key: 'isVisible',
          header: 'Visible',
          render: (a) => (a.isVisible ? 'Yes' : <Badge>Hidden</Badge>),
        },
      ]}
      fields={[
        { name: 'nameEn', label: 'Name' },
        { name: 'nameNe', label: 'Name in Nepali' },
        { name: 'slug', label: 'Slug', hint: 'Leave empty to make one from the name' },
        {
          name: 'district',
          label: 'District',
          type: 'select',
          options: DISTRICTS.map((d) => [d, d]),
        },
        { name: 'lat', label: 'Centre latitude', type: 'number' },
        { name: 'lng', label: 'Centre longitude', type: 'number' },
        { name: 'sortOrder', label: 'Order', type: 'number' },
        { name: 'isVisible', label: 'Visible on the site', type: 'checkbox' },
      ]}
      toForm={(a) => ({
        nameEn: a?.nameEn ?? '',
        nameNe: a?.nameNe ?? '',
        slug: a?.slug ?? '',
        district: a?.district ?? 'Kathmandu',
        lat: a?.lat ?? '',
        lng: a?.lng ?? '',
        sortOrder: a?.sortOrder ?? 0,
        isVisible: a?.isVisible ?? true,
      })}
      toBody={(f) => ({
        nameEn: f.nameEn.trim(),
        nameNe: f.nameNe.trim() || null,
        district: f.district,
        center: f.lat !== '' && f.lng !== '' ? { lat: Number(f.lat), lng: Number(f.lng) } : null,
        sortOrder: Number(f.sortOrder) || 0,
        isVisible: f.isVisible,
        ...(f.slug.trim() && { slug: f.slug.trim() }),
      })}
    />
  )
}
