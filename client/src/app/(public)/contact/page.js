import { ContactForm } from '@/components/common/ContactForm'
import { ST as T } from '@/components/common/ST'
import { loadCmsPage } from '@/components/common/CmsPage'
import { pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'
import { telHref } from '@/lib/format'

export const revalidate = 3600

export async function generateMetadata() {
  const page = await loadCmsPage('contact')
  return pageMetadata({
    title: page?.seoTitle ?? page?.title ?? 'Contact us',
    description:
      page?.seoDescription ?? 'Questions, corrections or partnerships: send us a message.',
    path: '/contact',
  })
}

/** The contact form always works; the CMS page adds text above it when published. */
export default async function ContactPage() {
  const [page, settings] = await Promise.all([
    loadCmsPage('contact'),
    publicGet('/settings', { tags: ['settings'] }),
  ])
  const contact = settings?.data.contact ?? {}

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-semibold">{page?.title ?? <T k="contact.title" />}</h1>
      {page && <div className="cms-body" dangerouslySetInnerHTML={{ __html: page.body }} />}
      <ContactForm />
      {(contact.email || contact.phone || contact.address) && (
        <section className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            <T k="contact.reach" />
          </h2>
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="text-brand underline">
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={telHref(contact.phone)} className="text-brand underline">
              {contact.phone}
            </a>
          )}
          {contact.address && <p>{contact.address}</p>}
        </section>
      )}
    </div>
  )
}
