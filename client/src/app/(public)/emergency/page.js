import Link from 'next/link'
import { Phone, Siren } from 'lucide-react'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { ST as T } from '@/components/common/ST'
import { CardGrid } from '@/components/listing/ListingCard'
import { categoryHref, telHref } from '@/lib/format'
import { pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'

export const revalidate = 3600

export const metadata = pageMetadata({
  title: 'Emergency numbers in Kathmandu',
  description:
    'Police, fire, ambulance and tourist police numbers for Kathmandu Valley, plus 24-hour hospitals. Tap a number to call.',
  path: '/emergency',
})

/** Hotlines as large tap-to-call buttons, then the emergency group's other categories. */
export default async function EmergencyPage() {
  const res = await publicGet('/emergency', { tags: ['emergency'] })
  const { hotlines = [], sections = [] } = res?.data ?? {}

  return (
    <div className="flex flex-col gap-10">
      <Breadcrumbs
        items={[
          { href: '/', label: <T k="nav.home" /> },
          { label: <T en="Emergency" ne="आपतकालीन" /> },
        ]}
      />
      <header className="flex flex-col gap-3">
        <span className="inline-flex size-12 items-center justify-center rounded-panel bg-danger text-surface">
          <Siren aria-hidden="true" className="size-6" />
        </span>
        <h1 className="text-3xl font-semibold">
          <T en="Emergency numbers" ne="आपतकालीन नम्बरहरू" />
        </h1>
        <p className="max-w-2xl text-lg text-text-muted">
          <T
            en="Free to call from any phone in Nepal. Tap a number to call it now."
            ne="नेपालका जुनसुकै फोनबाट निःशुल्क। अहिले नै कल गर्न नम्बर थिच्नुहोस्।"
          />
        </p>
      </header>

      {hotlines.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Hotlines">
          {hotlines.map((line) => (
            <li key={line.id}>
              <a
                href={telHref(line.contact.phone)}
                className="group flex min-h-24 items-center gap-4 rounded-panel border-2 border-danger/30 bg-surface p-4 shadow-card transition-colors hover:border-danger focus-visible:border-danger"
              >
                <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-pill bg-danger text-surface transition-transform group-hover:scale-105">
                  <Phone aria-hidden="true" className="size-6" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-3xl leading-none font-semibold tabular-nums">
                    {line.contact.phone}
                  </span>
                  <span className="mt-1 font-semibold">
                    <T en={line.name} ne={line.nameNe} />
                  </span>
                  {line.shortDesc && (
                    <span className="text-sm text-text-muted">{line.shortDesc}</span>
                  )}
                </span>
                <span className="sr-only">
                  <T en="Call" ne="कल गर्नुहोस्" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-muted">
          <T
            en="Hotline numbers will appear here once they are confirmed."
            ne="नम्बरहरू पुष्टि भएपछि यहाँ देखिनेछन्।"
          />
        </p>
      )}

      {sections.map(({ category, items }) => (
        <section
          key={category.slug}
          aria-labelledby={`s-${category.slug}`}
          className="flex flex-col gap-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`s-${category.slug}`} className="text-2xl font-semibold">
              <T en={category.nameEn} ne={category.nameNe} />
            </h2>
            <Link
              href={categoryHref({ groupSlug: category.groupSlug, slug: category.slug })}
              className="text-sm font-semibold text-brand hover:underline"
            >
              <T en="See all" ne="सबै हेर्नुहोस्" />
            </Link>
          </div>
          <CardGrid cards={items} priorityCount={0} headingLevel={3} />
        </section>
      ))}
    </div>
  )
}
