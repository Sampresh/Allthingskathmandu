import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GroupIcon } from '@/components/common/GroupIcon'
import { SectionTitle } from '@/components/common/SectionTitle'
import { ST as T } from '@/components/common/ST'
import { CardGrid } from '@/components/listing/ListingCard'
import { tintFor } from '@/components/listing/ListingLogo'
import { OpenNowSection } from '@/components/listing/OpenNowSection'
import { EventCard } from '@/components/events/EventCard'
import { MarketCard } from '@/components/market/MarketCard'
import { SearchBar } from '@/components/search/SearchBar'
import { Button } from '@/components/ui/Button'
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
      {groups.map((group) => {
        const tint = tintFor(group.slug)
        return (
          <li key={group.slug}>
            <Link
              href={`/${group.slug}`}
              className="group flex h-full min-h-28 flex-col items-start justify-between gap-3 rounded-panel border border-border bg-surface p-4 shadow-card transition-colors hover:border-brand/40"
            >
              <span
                className="inline-flex size-11 items-center justify-center rounded-box transition-transform group-hover:scale-105"
                style={{ background: `var(--tint-${tint}-bg)`, color: `var(--tint-${tint}-fg)` }}
              >
                <GroupIcon name={group.icon} className="size-6" />
              </span>
              <span className="leading-snug font-semibold group-hover:text-brand">
                <T en={group.nameEn} ne={group.nameNe} />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Events({ events }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {events.map((event) => (
        <li key={event.id}>
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  )
}

function Banner({ section }) {
  const config = section.config ?? {}
  return (
    <div className="flex flex-col items-start gap-4 rounded-panel bg-brand p-6 text-brand-contrast sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div>
        <h2 className="text-2xl font-semibold">
          <SectionTitle section={section} />
        </h2>
        {config.body && <p className="mt-1 opacity-90">{config.body}</p>}
      </div>
      <Link
        href={config.href ?? '/business'}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-box bg-surface px-5 font-semibold text-text hover:opacity-90"
      >
        {config.ctaLabel ?? <T k="nav.listBusiness" />}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  )
}

function Section({ section, seeAll, children }) {
  return (
    <section aria-labelledby={`s-${section.id}`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`s-${section.id}`} className="text-2xl font-semibold">
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
    <div className="flex flex-col gap-12">
      <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-border bg-surface px-4 pt-10 pb-8 sm:mx-0 sm:mt-0 sm:rounded-panel sm:border sm:px-8 sm:pt-12 sm:pb-10">
        <div className="flex max-w-3xl flex-col gap-4">
          <h1 className="text-3xl leading-tight font-semibold text-balance sm:text-[2.5rem]">
            <T k="home.title" />
          </h1>
          <p className="max-w-2xl text-lg text-text-muted">
            <T k="home.subtitle" />
          </p>
          <SearchBar areas={areas?.data ?? []} />
          {!hasListings && (
            <p className="text-text-muted">
              <T k="home.empty" />
            </p>
          )}
        </div>
        {/* A quiet nod to the valley's skyline: stupa and hills, drawn in the border colour. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 320 120"
          className="pointer-events-none absolute right-0 bottom-0 hidden h-36 w-auto text-border md:block"
          fill="currentColor"
        >
          <path
            d="M0 120 L40 82 L78 104 L120 66 L168 100 L214 70 L262 96 L320 60 L320 120 Z"
            opacity="0.6"
          />
          <path d="M236 120 V98 h52 v22 Z M244 98 q18 -30 36 0 Z M258 70 h8 v6 h-8 Z M261 50 h2 v20 h-2 Z" />
        </svg>
      </section>
      {sections.map(renderSection)}
    </div>
  )
}
