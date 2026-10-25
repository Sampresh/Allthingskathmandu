'use client'

import { useQuery } from '@tanstack/react-query'
import { CrudPage } from '@/components/admin/CrudPage'
import { categories, tags } from '@/services/admin.service'

export default function TagsPage() {
  const { data: tree } = useQuery({ queryKey: ['admin', 'categories'], queryFn: categories.list })
  const categoryOptions = [
    ['', 'Any category'],
    ...(tree?.groups ?? []).flatMap((g) =>
      g.children.map((c) => [c.id, `${g.nameEn} › ${c.nameEn}`]),
    ),
  ]

  return (
    <CrudPage
      title="Tags"
      queryKey="tags"
      api={tags}
      itemLabel={(t) => t.nameEn}
      deleteMessage={(t) =>
        `Delete ${t.nameEn}? It is removed from ${t._count?.businesses ?? 0} listings.`
      }
      columns={[
        { key: 'nameEn', header: 'Name' },
        { key: 'nameNe', header: 'Nepali' },
        { key: 'slug', header: 'Slug' },
        { key: 'category', header: 'Category', render: (t) => t.category?.nameEn ?? 'Any' },
        { key: 'count', header: 'Listings', render: (t) => t._count?.businesses ?? 0 },
      ]}
      fields={[
        { name: 'nameEn', label: 'Name' },
        { name: 'nameNe', label: 'Name in Nepali' },
        { name: 'slug', label: 'Slug', hint: 'Leave empty to make one from the name' },
        { name: 'categoryId', label: 'Shown on', type: 'select', options: categoryOptions },
        { name: 'sortOrder', label: 'Order', type: 'number' },
      ]}
      toForm={(t) => ({
        nameEn: t?.nameEn ?? '',
        nameNe: t?.nameNe ?? '',
        slug: t?.slug ?? '',
        categoryId: t?.categoryId ?? '',
        sortOrder: t?.sortOrder ?? 0,
      })}
      toBody={(f) => ({
        nameEn: f.nameEn.trim(),
        nameNe: f.nameNe.trim() || null,
        categoryId: f.categoryId || null,
        sortOrder: Number(f.sortOrder) || 0,
        ...(f.slug.trim() && { slug: f.slug.trim() }),
      })}
    />
  )
}
