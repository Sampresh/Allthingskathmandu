'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TextArea, TextField } from '@/components/admin/Fields'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import { errorMessage, useToast } from '@/components/admin/Toast'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { pages } from '@/services/admin.service'
import { CMS_PAGES } from '@/lib/cmsPages'
import { PageHeader } from '@/components/admin/PageHeader'

function Editor({ slug, label, existing }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(existing)
  const [title, setTitle] = useState(existing?.title ?? label)
  const [body, setBody] = useState(existing?.body ?? '')
  const [seoTitle, setSeoTitle] = useState(existing?.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(existing?.seoDescription ?? '')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  const save = async (isPublished) => {
    setSaving(true)
    const data = {
      title: title.trim(),
      body,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      isPublished,
    }
    try {
      const saved = page ? await pages.update(page.id, data) : await pages.create({ slug, ...data })
      setPage(saved)
      setBody(saved.body)
      queryClient.invalidateQueries({ queryKey: ['admin', 'pages'] })
      toast(isPublished ? 'Published' : 'Saved as draft')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <PageHeader title={label} />
        {page &&
          (page.isPublished ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>)}
      </div>
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      {preview ? (
        <section
          aria-label="Preview"
          className="rounded-box border border-dashed border-border p-4"
        >
          <p className="mb-2 text-xs text-text-muted uppercase">
            Preview of the last saved version
          </p>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {/* Server-sanitized HTML (sanitize-html on save). */}
          <div className="cms-body" dangerouslySetInnerHTML={{ __html: page?.body ?? '' }} />
        </section>
      ) : (
        <RichTextEditor label="Content" value={body} onChange={setBody} />
      )}
      <TextField
        label="SEO title"
        maxLength={70}
        value={seoTitle}
        onChange={(e) => setSeoTitle(e.target.value)}
      />
      <TextArea
        label="SEO description"
        maxLength={160}
        rows={2}
        value={seoDescription}
        onChange={(e) => setSeoDescription(e.target.value)}
      />
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => save(false)} loading={saving}>
          Save draft
        </Button>
        <Button variant="secondary" onClick={() => setPreview((v) => !v)} disabled={!page}>
          {preview ? 'Back to editing' : 'Preview'}
        </Button>
        <Button onClick={() => save(true)} loading={saving}>
          Publish
        </Button>
        {page?.isPublished && (
          <Button variant="ghost" href={`/${slug}`} target="_blank">
            View on site
          </Button>
        )}
      </div>
    </div>
  )
}

export default function PageEditorRoute({ params }) {
  const { slug } = use(params)
  const entry = CMS_PAGES.find(([s]) => s === slug)
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'pages'],
    queryFn: pages.list,
    enabled: Boolean(entry),
  })
  const summary = data?.find((p) => p.slug === slug)
  const { data: full, isPending: loadingFull } = useQuery({
    queryKey: ['admin', 'page', summary?.id],
    queryFn: () => pages.get(summary.id),
    enabled: Boolean(summary),
  })
  if (!entry) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/pages" className="text-sm font-semibold text-brand">
        ← Pages
      </Link>
      {isPending || (summary && loadingFull) ? (
        <Skeleton className="h-96 w-full max-w-3xl" />
      ) : (
        <Editor
          key={full?.updatedAt ?? 'new'}
          slug={slug}
          label={entry[1]}
          existing={full ?? null}
        />
      )}
    </div>
  )
}
