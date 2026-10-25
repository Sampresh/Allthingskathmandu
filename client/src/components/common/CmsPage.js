import { notFound } from 'next/navigation'
import { pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'

export const loadCmsPage = async (slug) =>
  (await publicGet(`/pages/${slug}`, { tags: [`page:${slug}`] }))?.data ?? null

export async function cmsMetadata(slug) {
  const page = await loadCmsPage(slug)
  if (!page) return {}
  return pageMetadata({
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
    path: `/${slug}`,
  })
}

/** A published CMS page; 404 until Admin publishes it. */
export async function CmsPage({ slug, children }) {
  const page = await loadCmsPage(slug)
  if (!page) notFound()
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-3xl font-semibold">{page.title}</h1>
      {/* Sanitized with sanitize-html when Admin saved it (CLAUDE.md security defaults). */}
      <div className="cms-body" dangerouslySetInnerHTML={{ __html: page.body }} />
      {children}
    </article>
  )
}
