import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GroupIcon } from '@/components/common/GroupIcon'
import { HeroArt } from '@/components/common/HeroArt'
import { SectionTitle } from '@/components/common/SectionTitle'
import { ST as T } from '@/components/common/ST'
import { FeatureGrid } from '@/components/listing/FeatureCard'
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

const TILE_TINTS = 8

function Groups({ groups }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
      {groups.map((group, i) => {
        // In turn rather than by name, so neighbouring tiles never match.
        const tint = (i % TILE_TINTS) + 1
        return (
          <li key={group.slug}>
            <Link
              href={`/${group.slug}`}
              className="gtile"
              style={{ background: `var(--tint-${tint}-bg)`, color: `var(--tint-${tint}-fg)` }}
            >
              <span className="leading-snug font-bold">
                <T en={group.nameEn} ne={group.nameNe} />
              </span>
              {group.liveCount > 0 && (
                <span className="mt-1 text-sm opacity-80">
                  {group.liveCount} <T en="places" ne="ठाउँ" />
                </span>
              )}
              <GroupIcon name={group.icon} className="gtile-icon" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** The busiest categories, as one-tap starting points under the search box. */
function QuickLinks({ groups }) {
  const top = groups
    .flatMap((g) => g.categories.map((c) => ({ ...c, group: g.slug })))
    .sort((a, b) => b.liveCount - a.liveCount)
    .slice(0, 4)
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {top.map((c) => (
        <li key={c.slug}>
          <Link href={`/${c.group}/${c.slug}`} className="hero-link">
            <T en={c.nameEn} ne={c.nameNe} />
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
    <div className="ridge relative flex flex-col items-start gap-4 overflow-hidden rounded-panel bg-brand p-6 text-brand-contrast sm:flex-row sm:items-center sm:justify-between sm:p-10">
      <div>
        <h2 className="text-2xl font-bold">
          <SectionTitle section={section} />
        </h2>
        {config.body && <p className="mt-1 opacity-90">{config.body}</p>}
      </div>
      <Link
        href={config.href ?? '/business'}
        className="relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill bg-surface px-5 font-semibold text-text hover:opacity-90"
      >
        {config.ctaLabel ?? <T k="nav.listBusiness" />}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  )
}

function Section({ section, seeAll, children }) {
  return (
    <section aria-labelledby={`s-${section.id}`} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`s-${section.id}`} className="text-2xl font-bold">
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
          <FeatureGrid cards={items} />
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
  const groups = sections.find((s) => s.type === 'GROUPS')?.items ?? []
  const hasListings = sections.some((s) => s.type !== 'BANNER' && s.items?.length)

  return (
    <div className="flex flex-col gap-14">
      <section className="hero">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <h1 className="text-[clamp(2.25rem,6vw,4rem)] leading-[1.05] font-bold text-balance">
            <T k="home.title" />
          </h1>
          <p className="max-w-xl text-lg text-text-muted">
            <T k="home.subtitle" />
          </p>
          <SearchBar areas={areas?.data ?? []} />
          <QuickLinks groups={groups} />
          {!hasListings && (
            <p className="text-text-muted">
              <T k="home.empty" />
            </p>
          )}
        </div>
        <HeroArt className="hero-art" />
      </section>
      {sections.map(renderSection)}
    </div>
  )
}
