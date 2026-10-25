'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from '@/components/admin/DataTable'
import { Badge } from '@/components/ui/Badge'
import { CMS_PAGES } from '@/lib/cmsPages'
import { formatDate } from '@/lib/format'
import { pages } from '@/services/admin.service'

export default function PagesPage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'pages'],
    queryFn: pages.list,
  })
  const rows = CMS_PAGES.map(([slug, label]) => {
    const page = data?.find((p) => p.slug === slug)
    return { id: slug, slug, label, page }
  })

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Pages</h1>
      <DataTable
        caption="Pages"
        loading={isPending}
        error={isError}
        onRetry={refetch}
        rows={rows}
        columns={[
          {
            key: 'label',
            header: 'Page',
            render: (r) => (
              <Link
                href={`/admin/pages/${r.slug}`}
                className="font-semibold text-brand hover:underline"
              >
                {r.label}
              </Link>
            ),
          },
          { key: 'path', header: 'Address', render: (r) => `/${r.slug}` },
          {
            key: 'status',
            header: 'Status',
            render: (r) =>
              !r.page ? (
                <Badge>Not written</Badge>
              ) : r.page.isPublished ? (
                <Badge tone="success">Published</Badge>
              ) : (
                <Badge>Draft</Badge>
              ),
          },
          {
            key: 'updated',
            header: 'Updated',
            render: (r) => (r.page ? formatDate(r.page.updatedAt) : '—'),
          },
        ]}
      />
    </div>
  )
}
