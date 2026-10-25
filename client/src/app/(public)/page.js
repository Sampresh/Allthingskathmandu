import Link from 'next/link'
import { GroupIcon } from '@/components/common/GroupIcon'
import { SectionTitle } from '@/components/common/SectionTitle'
import { ST as T } from '@/components/common/ST'
import { CardGrid } from '@/components/listing/ListingCard'
import { OpenNowSection } from '@/components/listing/OpenNowSection'
import { MarketCard } from '@/components/market/MarketCard'
import { SearchBar } from '@/components/search/SearchBar'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'
import { pageMetadata } from '@/lib/seo'
import { publicGet } from '@/lib/serverApi'
import { SITE_NAME } from '@/lib/site'

export const revalidate = 3600

export const metadata = {
  ...pageMetadata({
    title: `${SITE_NAME}: local businesses, services and apps in Kathmandu`,
    description:
      'Compare local businesses, services, places and apps across Kathmandu Valley, then call, message or get directions in one tap.',
    path: '/',
  }),
  title: { absolute: `${SITE_NAME}: local businesses, services and apps in Kathmandu` },
}

function Groups({ groups }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {groups.map((group) => (
        <li key={group.slug}>
          <Link
            href={`/${group.slug}`}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-box border border-border bg-surface p-3 text-center font-semibold hover:bg-surface-raised"
          >
            <span className="text-brand">
              <GroupIcon name={group.icon} className="size-7" />
            </span>
            <T en={group.nameEn} ne={group.nameNe} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Events({ events }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {events.map((event) => (
        <li key={event.id} className="rounded-box border border-border p-4">
          <p className="text-sm font-semibold text-brand">{formatDate(event.startsAt)}</p>
          <h3 className="font-semibold">{event.title}</h3>
          {(event.venue || event.area) && (
            <p className="text-sm text-text-muted">
              {event.venue}
              {event.venue && event.area && ' · '}
              {event.area && <T en={event.area.nameEn} ne={event.area.nameNe} />}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

function Banner({ section }) {
  const config = section.config ?? {}
  return (
    <div className="flex flex-col items-start gap-3 rounded-box border border-brand p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">
          <SectionTitle section={section} />
        </h2>
        {config.body && <p className="text-text-muted">{config.body}</p>}
      </div>
      <Button href={config.href ?? '/business'}>
        {config.ctaLabel ?? <T k="nav.listBusiness" />}
      </Button>
    </div>
  )
}

function Section({ section, seeAll, children }) {
  return (
    <section aria-labelledby={`s-${section.id}`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`s-${section.id}`} className="text-xl font-semibold">
          <SectionTitle section={section} />
        </h2>
        {seeAll && (
          <Link
            href={seeAll}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-brand"
          >
            <T k="home.seeAll" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function renderSection(section) {
  const items = section.items ?? []
  switch (section.type) {
    case 'BANNER':
      return <Banner key={section.id} section={section} />
    case 'GROUPS':
      return items.length ? (
        <Section key={section.id} section={section}>
          <Groups groups={items} />
        </Section>
      ) : null
    case 'OPEN_NOW':
      return items.length ? (
        <Section key={section.id} section={section}>
          <OpenNowSection sectionId={section.id} initialItems={items} />
        </Section>
      ) : null
    case 'EVENTS':
      return items.length ? (
        <Section key={section.id} section={section} seeAll="/events">
          <Events events={items} />
        </Section>
      ) : null
    case 'MARKET':
      return items.length ? (
        <Section key={section.id} section={section} seeAll="/market">
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((item) => (
              <li key={item.id}>
                <MarketCard item={item} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null
    default:
      return items.length ? (
        <Section key={section.id} section={section}>
          <CardGrid cards={items} priorityCount={0} />
        </Section>
      ) : null
  }
}

export default async function HomePage() {
  const [home, areas] = await Promise.all([
    publicGet('/home', { tags: ['home', 'groups'] }),
    publicGet('/areas', { tags: ['areas'] }),
  ])
  const sections = home?.data ?? []
  const hasListings = sections.some((s) => s.type !== 'BANNER' && s.items?.length)

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 pt-2">
        <h1 className="text-3xl font-semibold">
          <T k="home.title" />
        </h1>
        <p className="max-w-2xl text-text-muted">
          <T k="home.subtitle" />
        </p>
        <SearchBar areas={areas?.data ?? []} />
        {!hasListings && (
          <p className="text-text-muted">
            <T k="home.empty" />
          </p>
        )}
      </section>
      {sections.map(renderSection)}
    </div>
  )
}
