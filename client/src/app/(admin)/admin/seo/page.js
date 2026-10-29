'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { PageHeader } from '@/components/admin/PageHeader'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { categories } from '@/services/admin.service'

function SeoRow({ category, depth }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(category.seoTitle ?? '')
  const [description, setDescription] = useState(category.seoDescription ?? '')
  const dirty =
    title !== (category.seoTitle ?? '') || description !== (category.seoDescription ?? '')

  const save = async () => {
    try {
      await categories.update(category.id, {
        seoTitle: title.trim() || null,
        seoDescription: description.trim() || null,
      })
      toast(`${category.nameEn} saved`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] })
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <tr className="border-t border-border align-top">
      <th
        scope="row"
        className={`px-3 py-2 text-left font-semibold ${depth ? 'pl-8 font-normal' : ''}`}
      >
        {category.nameEn}
      </th>
      <td className="px-3 py-2">
        <label className="sr-only" htmlFor={`t-${category.id}`}>
          SEO title for {category.nameEn}
        </label>
        <input
          id={`t-${category.id}`}
          maxLength={70}
          value={title}
          placeholder={`${category.nameEn} in Kathmandu`}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-11 w-full rounded-box border border-text-muted bg-surface px-2"
        />
        <p className="text-xs text-text-muted">{title.length}/70</p>
      </td>
      <td className="px-3 py-2">
        <label className="sr-only" htmlFor={`d-${category.id}`}>
          SEO description for {category.nameEn}
        </label>
        <textarea
          id={`d-${category.id}`}
          maxLength={160}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-box border border-text-muted bg-surface p-2"
        />
        <p className="text-xs text-text-muted">{description.length}/160</p>
      </td>
      <td className="px-3 py-2">
        <Button variant="secondary" onClick={save} disabled={!dirty}>
          Save
        </Button>
      </td>
    </tr>
  )
}

/** Search titles and descriptions for group and category pages (listings and pages have their own). */
export default function SeoPage() {
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: categories.list,
  })
  if (isPending) return <Skeleton className="h-96 w-full" />
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="SEO" />
      <p className="text-sm text-text-muted">
        Empty fields use a default from the name. Listings and pages have SEO fields in their own
        editors.
      </p>
      <div className="overflow-x-auto rounded-box border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">SEO for groups and categories</caption>
          <thead className="bg-surface-raised text-left">
            <tr>
              <th scope="col" className="px-3 py-2">
                Page
              </th>
              <th scope="col" className="px-3 py-2">
                Title
              </th>
              <th scope="col" className="px-3 py-2">
                Description
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Save</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.groups.flatMap((g) => [
              <SeoRow key={g.id} category={g} depth={0} />,
              ...g.children.map((c) => <SeoRow key={c.id} category={c} depth={1} />),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  )
}
